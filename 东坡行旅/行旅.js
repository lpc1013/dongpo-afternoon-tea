/* 东坡行旅 · 黄州章
   一个循环（六个时辰）+ 三种关卡（堂上/灶前/上街）+ 两本册子（食单/清欢册）+ 五根条。
   约束：file:// 双击直跑 —— 不用 module、不用 fetch、不用外链，图全部走相对路径。 */
(function () {
  "use strict";

  var S = {
    screen: "hub",
    shichen: 0,
    maxShichen: DATA.chapter.shichen,
    bars: {},
    court: null,
    stove: null,
    street: null,
    got: {},        // 食单：菜名 -> true
    verses: {},     // 清欢册：句 id -> true
    kongYin: 0,     // 空印：定州章攒下的债，跨章不清零
    seals: {},      // 各章盖下的章，跨章不清零 —— 终局那一屏要并排盖在一张纸上
    debt: 0,        // 这笔债在本章折成多少点人情（惠州章才算得出来）
    dongpoName: false,  // 「东坡居士」这个号一旦取上就不回退 —— 所以它不在 flags 里（换章会清）
    /* 新手引导走到第几步：-1 ＝ 看过或跳过。它**不在 reset() 里清** ——
       「再来」与换章都不该把已经讲过的话再讲一遍；要重看走 ?fresh（那是清档，不是重开一局）。 */
    tut: 0,
    flags: {},      // 成就用的一格一格的痕：成锅／散席／借过人……
    // 信这三样是**这一屏的临时态**，不进存档：翻页、挑一句、按人筛，重开该回到原样
    // （`bpage` 是册子那一叶，同一条规矩：新开一张纸从头一叶起）
    lpage: 0, lpicking: false, wallBy: "", bookWhich: "dishes", rechap: "", bpage: 0,
    coverAsk: 0,     // 封面上「开始」按下第一下要确认——只在封面这一屏有效，不进档
    mapFace: "trip",   // 舆图屏的两面：trip＝整条行旅，chap＝本章那一幅。切面不改章、不掉时辰
    dial: {},          // 尝菜屏算盘上拨到的读数：也是临时态，重开该回到量程中段
    /* 录方（尝菜屏）的两格是要**跨锅、跨章记住**的：尝出来的"夹"被清掉等于把玩家挣来的信息退货。
       `notes` 每道菜存四个数（不足的最高读数／正好那一段／过头的最低读数），
       `recipes` 是"这一味我自己尝定了"——它和食谱自带的 `known`（帖里本来就写了方子）是两回事。 */
    notes: {}, recipes: {},
    /* zao 是灶前那一锅的流水（zn() 往它 unshift）。尝菜屏那两口也走 zn，
       而它原来只在起锅那一路赋值 —— 新开的页面没起过锅，点「尝这口」就是
       undefined.unshift。放在字面量里，是为了不依赖「谁先到过灶前」。 */
    zao: [],
    log: []
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function reset() {
    S.screen = "hub"; S.shichen = 0; S.bars = clone(DATA.bars);
    S.court = null; S.stove = null; S.street = null; S.banquet = null;
    S.got = {}; S.verses = {}; S.log = []; S.replied = {}; S.tone = {};
    S.aside = 0; S.quips = []; S.flags = {}; S.read = {};
    S.zao = [];        // 锅里的流水是这一锅的事：换章/重开都该空（与 S.log 同一条规矩）
    // 信是**本章的**事：换章要把「看到过哪封」清干净，否则第二章开局一块提醒匾都没有。
    S.mailSeen = {}; S.mailAsked = false; S.mailTo = null;
    S.maxShichen = DATA.chapter.shichen;   // 换章＝换一把尺：不刷新就沿用上一章那个数
    // 换章＝换一把尺：不重置基线的话，进下一章第一屏会弹一条「银钱 −250 文」的假账
    POP_BASE = null; seedAchv();
  }
  /* 切章只换本章的摊子；空印是跨章的债，不清零，而是在**有 repay 的那一章**扣人情。 */
  function switchChapter(k) {
    if (!useChapter(k)) return false;
    S.kongYin = S.kongYin || 0;
    reset();
    repay();
    S.arrive = true;
    saveGame();
    return true;
  }

  // ── 存档：单档自动续玩 ──────────────────────────────
  /* 规格 §0 第 4 条从第一天就写着「存档用 localStorage，单档可覆盖」，一直没做：
     四章一遍坐不完，刷新就退回 45 岁。
     关卡内的局面（S.court／S.stove／S.banquet）**故意不存** —— 写档的点都在一关结算之后，
     那时它们本来就是空的；半途那一锅烧到几分续玩时不带走，这是取舍不是遗漏。
     护栏与 Audio 同一条规矩：桩里没有 localStorage 就整体静默跳过，
     存档不许有能力弄崩游戏（不包这层，engine_harness 第一步就崩）。 */
  var SAVE_KEY = "dp_xinglv_save_v1", NO_SAVE = false;
  var SAVE_F = ["shichen", "bars", "got", "verses", "replied", "tone", "aside", "quips",
    "read", "flags", "kongYin", "seals", "debt", "mailSeen", "mailAsked", "dongpoName",
    /* 引导走到哪一步也要进档：不然刷新一次就把刚讲过的话再讲一遍。 */
    "tut",
    /* 尝出来的"夹"与录定的方子：与空印、称号同一类 —— 是玩家挣来的**跨章**知识，
       `reset()` 不清它。清掉就等于换一章把上一章尝出来的东西全部退货。 */
    "notes", "recipes"];
  function saveGame() {
    if (NO_SAVE) return;
    /* 封面**没有可存的进度**：起机第一屏就是它，而 `layer()` 每屏都顺手存一次 ——
       不挡掉的话，一个从没玩过的玩家点开封面会看见「继续」亮着，
       按「开始」还要他确认覆盖一份自己根本没写过的档。 */
    if (S.screen === "cover") return;
    var o = { v: 1, chapter: CHAPTER_KEY }, i;
    for (i = 0; i < SAVE_F.length; i++) o[SAVE_F[i]] = S[SAVE_F[i]];
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(SAVE_KEY, JSON.stringify(o));
    } catch (e) { }
  }
  /* 读到档就返回 true 并把 S 摆回那一章的「今日」；档坏了（版本号不对、章名没了）
     一律当作没档，从黄州重开 —— 不许因为一个旧档把游戏弄成白屏。 */
  function loadGame() {
    var o = null, i;
    try {
      if (typeof localStorage === "undefined") return false;
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      o = JSON.parse(raw);
    } catch (e) { return false; }
    if (!o || o.v !== 1 || !CHAPTERS[o.chapter]) return false;
    reset();
    useChapter(o.chapter);
    for (i = 0; i < SAVE_F.length; i++) if (o[SAVE_F[i]] !== undefined) S[SAVE_F[i]] = o[SAVE_F[i]];
    S.screen = "hub";
    S.court = S.stove = S.street = S.banquet = null;
    POP_BASE = null; seedAchv();
    return true;
  }

  // ── 对话：逐句推进的一屏一句 ────────────────────────
  /* 布局是定稿过的（用户给过参考图）：
       背景整体压暗 → **只有开口的那位出现**，另一位退场
       → 黑话盒不透明、右下角斜切 → 斜切平行四边形名牌跟着人所在那一侧
       → 右下 ▼ 表示还有下一句 → 左上「跳过剧情」、右上「返回」
     位置规则：**左＝永远是我（子瞻），右＝永远是客**，不换边。
     每句自带 `p`（这一句他是什么动作/脸色）—— 同一场戏里立绘必须跟着台词换，
     不许一张图站到底。
     插入点全部列在 DATA.dlg 的键上，见 开发规格.md §十六 的核对表。 */
  var DLG = { key: "", i: 0, then: null, src: "hub" };
  /* 返回 true ＝ 这一段确实播出去了，调用方**必须立刻 return**，
     把后续交给 dlgDone() 里那个 then。 */
  var NODLG = false;                        // 验收开关：见文件末尾的哈希路由
  function say(key, then) {
    var L = (DATA.dlg || {})[key];
    if (!L || !L.length) return false;
    // #章/屏/nodlg —— 一次性过场白（章首／上堂／第一次开火／入席）全部跳过。
    // 不加这个，凡是被开场白挡住的屏就永远拍不到：#dingzhou 只能拍到章首对话，
    // 想验 hub 的标题落在匾上没有，就只能靠人肉点过去。
    if (NODLG) return false;
    if (S.screen !== "dlg") _dlgFrom = S.screen;   // 「‹ 返回」要回的是**打开对话前那一屏**
    DLG.key = key; DLG.i = 0; DLG.then = then || null;
    S.screen = "dlg";
    renderDlg();
    return true;
  }
  /* 几何全部照 tools/dialog_mock.py 量出来的数：
     话盒 x104 y486 1072×200、右下斜切 46；名牌 152×48 骑在盒顶、随人那一侧；
     立绘高 500、顶 150、左右各留 40；背景 brightness .46 + saturate .82；
     对方那一侧的立绘**水平镜像**（mock 就是这么做的）。 */
  /* 每一场对话得演在**它自己的地方**：堂上的戏不能在书房里演，灶前的不能在堂上演。
     键名前缀就是舞台名，不再为每一句单独标。 */
  var DLG_STAGE = {
    court: "hall", stove: "stove", tie: "stove", dish: "stove",
    seat: "banquet", banquet: "banquet", street: "street", mail: "hub",
    arrive: "hub", seal: "end2",
    // 话本层的对白演在绣像那一张上（只有墨色与纸色），不与正史的厚涂场景混
    hb: "huaben"
  };
  function dlgStage(key) {
    for (var k in DLG_STAGE) if (key.indexOf(k) === 0) return DLG_STAGE[k];
    return "hub";
  }
  /* 名牌上那个名字会换一次：第一锅东坡肉做成之前他自报「子瞻」，之后换号。
     规格 §5.5 的点睛就在这儿 —— 不解释、不回退，玩家自己看见那三个字变了。 */
  function myName() { return S.dongpoName ? "东坡居士" : "子　瞻"; }
  function renderDlg() {
    var L = (DATA.dlg || {})[DLG.key], i = DLG.i, ln = L && L[i];
    if (!ln) { dlgDone(); return; }
    var me = ln.w === "我";
    set(bg(dlgStage(DLG.key), "hubbg2-1.webp"));
    document.getElementById("bg").className = "dimmed";
    // 无名小吏**不给脸**（p:"none"）：龙套没有自己的立绘，宁可空着，
    // 也绝不能借主角那张 —— 观众只会读成「苏轼在跟自己说话」。
    var face = ln.p || "pot-4";
    var h = ln.p === "none" ? "" :
      '<div class="talker ' + (me ? "left" : "right") + '">' + faceTag(face, ln.e) + "</div>";
    // 斜切只能切「盒子本体」：clip-path 会把骑在盒顶的名牌一起裁掉（第一版就踩了）
    h += '<div class="dbox"><div class="dboxbg"></div>' +
      '<div class="name3 ' + (me ? "l" : "r") + '">' + (me ? myName() : ln.w) + "</div>" +
      '<div class="txt">' + ln.t + "</div>" +
      (ln.src ? '<div class="fr">' + ln.src + "</div>" : "") +
      '<div class="caret"></div></div>';
    h += '<div class="skip" data-act="dskip">跳过剧情</div>';
    h += '<div class="dback" data-act="dback">‹ 返回</div>';
    h += '<div class="dtap" data-act="dnext"></div>';
    layer(h);
    /* 「这一屏播的是哪一场、第几句」也钉出去：`data-screen` 只说得出它是 dlg，
       而 65 条对话路由曾经**全部**静默退回 arrive 那一句，验收一路绿。 */
    document.getElementById("stage").setAttribute("data-dlg", DLG.key + "#" + DLG.i);
  }
  function dlgNext() {
    sfx("paper");
    var L = (DATA.dlg || {})[DLG.key] || [];
    DLG.i++;
    if (DLG.i >= L.length) dlgDone(); else renderDlg();
  }
  /* 单句插播：席间每巡上完菜，被伺候那位必须当场给反应。
     不写进 DLG.key 表，因为这一句是**按客人现拼的**，不是按关卡键查的。 */
  /* 现拼的句子没有自带立绘 —— 谁在说话就用谁的站姿图。 */
  function withArt(g, line) {
    if (!line || !line.t) return line;
    var o = clone(line);
    if (!o.p) o.p = g.art;
    if (!o.e) o.e = line === g.hit ? "xiao" : "leng";   // 尽欢＝笑，冷场＝冷脸
    return o;
  }
  function sayOne(line, then) {
    if (!line || !line.t) return false;
    DATA.dlg = DATA.dlg || {};
    DATA.dlg.__one = [line];
    DLG.key = "__one"; DLG.i = 0; DLG.then = then || null;
    S.screen = "dlg"; renderDlg();
    return true;
  }
  function dlgDone() {
    var th = DLG.then, was = DLG.key;
    DLG.then = null; DLG.key = "";
    /* 章首白读完，那一行就进册：定州「今年中山去，白首归无期」、儋州「我本海南民」
       本来就是这一章开篇当着他面念出来的句子 —— 读到就是得到。
       以前这两行在册上挂着「待触发」，可全引擎没有任何一条路拿到它（审计 P2-16／问22）。 */
    if (was === "arrive" && DATA.lines.arrive &&
        ((DATA.book || {}).verses || []).indexOf("arrive") >= 0)
      S.verses.arrive = true;
    // then 写成 "go/stove" 这种两段式，act(a, arg) 是两个参数 —— 不拆就会静默什么都不做
    if (th) { var s = String(th).split("/"); act(s[0], s[1] || ""); }
    else { S.screen = "hub"; renderHub(); }
  }

  // ── 缩放 ────────────────────────────────────────────
  function scale() {
    var k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    var e = document.getElementById("scaler");
    e.style.transform = "translate(-50%,-50%) scale(" + k + ")";
  }

  // ── 公共件 ──────────────────────────────────────────
  /* 一格 = 木架上的一个格槽。slot 序号 1~6 对应实测出来的六个 y 区间。 */
  /* ── 檐下一列木牌 ────────────────────────────────────
     9-27 用户否掉了右边那座深色博古格（`hold-hang2-1`：一件家具压在画面上，
     格口大小不一，字挤在里面），先换成 `alt-hang-3`（横长，右栏容不下），
     最后落到这张 —— `hangv-col-1`：一根立柱上自上而下五枚横长空白木牌。
     牌面是横的，所以字**横排**：两字名目 + 一个数，比竖排 33 px 宽从容得多。
     五个格位是 `python tools/cutout.py hangv-col-1` 之后逐行扫亮段量出来的
     （452×1080 里的 y 区间 196/380/548/690/854，各高 ~93 px），
     折成百分比写在这儿；x 取 5%~77%，右端那 10% 是绳结，不写字。**量出来的，不是估的。** */
  var HANG_Y = [[18.1, 8.7], [35.2, 8.5], [50.7, 8.3], [63.9, 8.9], [79.1, 9.3]];
  /* 名目左边那一枚小图标。`素材/图标/ico-*.png` 早就产好也早就抠好了图，一直闲着，
     记的理由是「要落在量出来的可写面上」—— 那条只对**背景上的匾**成立。
     木牌是我们自己的 CSS 件，格位是 cutout.py 量出来的，往里塞一枚图标不用新量任何东西。
     第五枚随屏换（结绝／已圈／最欢…），所以按名目查表，不按格位。 */
  var TAG_IC = {
    "银钱": "图标/ico-money.png", "人情": "图标/ico-tea.png", "身体": "图标/ico-body.png",
    "结绝": "图标/ico-rule.png", "已圈": "图标/ico-brush.png", "余钱": "图标/ico-tongqian.png",
    "最欢": "图标/ico-wine.png", "已回": "图标/ico-mail.png",
    "得句": "图标/ico-qinghuan.png", "食单": "图标/ico-menu.png",
    "乡望": "图标/ico-chengjiu.png", "三印": "图标/ico-seal.png", "已盖": "图标/ico-seal.png",
    // 开场那一屏的第五枚是「名目 · 待盖／空印」—— 用那枚空心朱框本身当图标，别拿实印凑
    "名目": "图标/ico-kongyin.png",
    "卷宗": "图标/ico-case.png",
    // 成就墙那一枚：织金圆徽垂朱绦本来就是为"成就"产的（产图交付 §ico-chengjiu），
    // 与章末那枚「乡望」同图不同屏 —— 两处都是"功过凭这个记"的意思。
    "成就": "图标/ico-chengjiu.png"
  };
  /* 时辰那一枚按**还剩几个时辰**换四张天色：日头初升 → 白盘当顶 → 落红 → 月。
     倒计时是个抽象数，「还剩 2」看不出什么，一片落红看得出来。
     四张路径写全，不拼 `"图标/ico-chen-" + 档 + ".png"` —— 拼出来的文件名清点器点不到，
     而"点不到"在这个项目里从来不等于"没有"（§14 那条 47→54 就是这么来的）。 */
  var CHEN_IC = {
    mao: "图标/ico-chen-mao.png", wu: "图标/ico-chen-wu.png",
    you: "图标/ico-chen-you.png", ye: "图标/ico-chen-ye.png"
  };
  /* 堂上四章四种代价各有一枚角标，2026-09-26 就产好了、一直闲着。
     这一屏把代价说得很多（匾上、意图框里、提示行里各一遍），可**四章的堂上看上去是同一屏** ——
     说的部分早就做到缺的是"一眼"。牌子放在提示行最前面，给后面那一整行代价数字当主语。 */
  var MODE_IC = {
    "质证": "图标/ico-zhizheng.png", "空印": "图标/ico-kongyin.png",
    "借印": "图标/ico-jieyin.png", "问字": "图标/ico-wenzi.png"
  };
  function modeBadge() {
    var ic = MODE_IC[DATA.court.mode];
    return ic ? '<img class="mic" src="' + artSrc(ic) + '" alt="' + DATA.court.mode + '">' : "";
  }
  function chenIc(n) { return CHEN_IC[n >= 5 ? "mao" : n >= 3 ? "wu" : n >= 1 ? "you" : "ye"]; }
  /* 右栏那五枚木札：名字与数值本来就常驻，这里补的是"它被什么改动"。
     文案一律照代码写死的事实，不许为了好听编一条：
       时辰 —— `S.shichen++` 出现在堂上质证、灶前开火/弃锅、上街、席间那几处；显示的是 `maxShichen - shichen`
       银钱 —— 街面 `-= st.price`；尝菜 `-= REC_FEE(6)`；归零则 `poor`
       人情 —— 定州空印在惠州按 `kongYin * r` 折成 `debt` 先扣；牌面 `card.ren` 不够打不出去
       身体 —— `card.body` 是门槛（"这一手要养足 N"）；见底要去堂前养
       物议 —— 借印 `+2`，空印追论 `-kongYin`
     ⚠ 悬浮在触屏上不算数，所以同一份话在「规则」屏也要有一份（见 RULE_NOTES）。 */
  var TAG_HINT = {
    时辰: "还剩几次可行动：堂上质证、灶前开火、上街、席间都要扣一时辰",
    银钱: "办事要花的钱：尝一口 6 文、上街买东西都要它，归零就办不成",
    人情: "乡望与交情：定州欠下的空印要拿它抵；牌上写的人情不够就打不出去",
    身体: "扛不扛得住：有些牌要养足身体才打得出去，见底得先去堂前养",
    物议: "外头的风评：借印会涨，空印被追论会掉，太低某些判递不上去"
  };
  function tag(i, k, v, cls, ic) {
    var y = HANG_Y[i];
    ic = ic || TAG_IC[k];
    return '<div class="tag" style="top:' + y[0] + '%;height:' + y[1] + '%">' +
      (ic ? '<img class="ti" src="' + artSrc(ic) + '" alt="">' : "") +
      '<span class="tk">' + k + '</span><b class="tv ' + (cls || "") + '">' + v + "</b>" +
      (TAG_HINT[k] ? '<b class="tip">' + TAG_HINT[k] + "</b>" : "") + "</div>";
  }
  function panel(p) {
    var b = S.bars, i, n = S.maxShichen - S.shichen;
    var list = [["时辰", n, n <= 1 ? "bad" : "", chenIc(n)], ["银钱", b.银钱, ""],
      ["人情", Math.round(b.人情), b.人情 < 30 ? "bad" : ""],
      ["身体", Math.round(b.身体), b.身体 < 40 ? "bad" : ""],
      p && p.k ? [p.k, p.v, p.cls || ""] : null];
    var h = '<div class="panel">';
    for (i = 0; i < 5; i++)
      h += list[i] ? tag(i, list[i][0], String(list[i][1]).replace(/\s*\/\s*/g, "/"),
                         list[i][2], list[i][3])
                   : "";   // 第五枚没有内容就什么都不挂：资产自己画了五块牌，空着一块是"多挂了一块"
    return h + "</div>";
  }

  /* 背景自带空白匾的那一屏：字直接叠在匾上、副题落在匾下沿那片素墙上 ——
     标题就成了「场景里本来挂着的一块牌」，不是又贴一条红横幅。
     BOARDS 表里没有这张背景的（大多数关卡屏还没量过），照旧走 bracket-4 横带，
     不硬猜坐标：猜错一次，标题就飘到人家画面上去了。 */
  /* 第三个参数 band=1：这张背景**有匾，但这一屏不能往上写**。
     舆图屏就是 —— 它借本章堂前那张图，而 `.route` 那张地图从 y120 铺到 y624，
     把匾面（黄州 x540..738 / y148..205）整个盖住：字写上去等于没写，
     还会让验收表把这一屏记成「标题落进匾里」——**假绿灯就是这么来的**。
     横带在 y16..120，正好压在地图上方那条空里。 */
  function plate(main, sub, band) {
    var b = !band && typeof boardRect === "function" ? boardRect(CUR_BG) : null;
    // 「标题到底落进匾里没有」必须是量出来的：钉在 DOM 上给验收器回读，
    // 不靠 行旅数据.js 里那张表反推 —— 表里有坐标不代表这一屏真的走到那条分支。
    CUR_BOARD = b ? 1 : 0;
    if (!b) return '<div class="plate"><div class="in"><h1>' + main + "</h1><p>" + sub +
      "</p></div></div>";
    var L = Math.round(b[0] * 1280), T = Math.round(b[1] * 720);
    var W = Math.round(b[2] * 1280), H = Math.round(b[3] * 720);
    var st = "left:" + L + "px;top:" + T + "px;width:" + W + "px;height:" + H + "px";
    // 匾够高就把副题一起收进匾里；不够高（黄州那块只有 115 px）才落到匾下的素墙上，
    // 否则字会压到在座客人身上 —— 席间那一屏就是这么撞出来的。
    /* 装不装得下，要按**副题实际要占几行**算，不是比一个高度常数：
       主题 25px × 1.3 ＝ 32.5；副题 13px × 1.45 ＝ 18.9 一行；两行之间不留间距（10-03 用户点名）。
       行数用"字数 × 一个楷字第的宽 ÷ 匾心可用宽"估出来（`nbUnits` 只会在「 · 」处断行，
       真实行数 ≥ 这个估计，所以宁可估多一行）。
       常数那一版（58→52）当场就把三屏带进坑里：黄州·惠州的今日屏副题要两行（70 px）
       而匾心只有 57，定州上街那块更是要四行 —— `edge` 闸各红了 6 屏。 */
    var subLines = Math.max(1, Math.ceil(String(sub).length * 13.4 / Math.max(40, W)));
    var room = H >= 32.5 + subLines * 18.9 + 1;
    /* 「副题到底收进匾里没有」也要钉下来（10-03）。`data-board` 只说标题走没走匾那一支，
       而同一支里 `room` 为假时副题会落到匾下的素墙上 —— 那种屏标题是绿的、副题没人量。
       它也不犯 `cut/out/spill/edge` 任何一条（不越界、不遮挡、不劈行），所以只能自己钉。 */
    CUR_SUB = room ? 1 : 0;
    /* BOARDS 第 5 个元素管字色，两种：
         "light"     匾面本身在暗处（定州堂前那张雪幕里的匾是灰的）→ 堂名与副题都走浅色
         "lightsub"  匾面被日头照亮、匾下那道额枋在檐影里 → 只有副题换浅色
       这不是配色偏好，是截图逼出来的：定州那屏「定州」两个字在暗匾上直接消失，
       而黄州·惠州·儋州三张的副题都糊在暗木带上（§52 那两条配色提醒说的就是这件事）。
       副题再往下挪 18px：face 是**素面**，它下面还有织金下沿，压着边框写字最难看。 */
    var flag = (typeof BOARDS !== "undefined" && BOARDS[CUR_BG]) ? BOARDS[CUR_BG][4] : "";
    var lt = flag === "light" ? " lt" : "";
    var lts = (flag === "light" || flag === "lightsub") ? " lt" : "";
    var sub2 = nbUnits(sub, " · ", 21);   // 「今日 · 元丰四年 · 四十五岁 · …」按段断行，不劈头衔
    return '<div class="onb' + (room ? "" : " one") + lt + '" style="' + st + '">' +
      "<h1>" + main + "</h1>" + (room && sub ? "<p>" + sub2 + "</p>" : "") + "</div>" +
      /* 副题落在匾下那片素墙上时，要**照匾心居中**：以前它的左沿对齐匾的左沿，
         而这一行有 296 px 宽、匾心只有 198 px —— 于是整行往右溢出 98 px，
         看上去就是"字没对上匾"（用户开局点名的那一条）。 */
    /* 副题落进 `.subw`（匾下那片素墙）时，离匾的距离从 26 收到 14：
       用户要的是"黄州和下面那行读起来是一块东西"。不敢收到 0 ——
       匾下沿外面还有一圈织金回纹（审计 P2-19 量过），压上去就是字骑在木头上。 */
      (!room && sub ? '<p class="subw' + lts + '" style="left:' + (L + Math.round(W / 2)) +
       "px;top:" + (T + H + 14) + 'px">' + sub2 + "</p>" : "");
  }

  /* 入口是**图标优先**（用户点的名：一排竖幅标签太吵）。
     给了 ic 的就只画那个小物件 —— 惊堂木、白砂锅、布招幌本身就是识别物，
     再套一层框反而像贴上去的；名字只在悬停时显。没给 ic 的仍走竖幅＋竖排字。 */
  function tabs(items, th, y0, gap) {
    th = th || 116; y0 = y0 || 118; gap = gap === undefined ? 10 : gap;
    /* 一列装不下就折成两列 —— 这一条是被 `out` 闸逼出来的：名字常驻之后每枚从 62 长到 86
       （多出的 24 px 就是名字那一行），今日屏八枚加静音一共 798 px，而舞台只有 720。
       食单只剩一个图标尖、行旅与静音整块掉到画外，玩家点不到自己最该看的两格。
       末尾那枚静音开关也在这条竖栏里，所以它一起算进高度。 */
    var hs = [], ws = [], j, tot = 0, colH = 0, cut = 0, fold = 0;
    for (j = 0; j < items.length; j++) {
      hs.push(items[j].ic ? 86 : th);
      ws.push(items[j].ic ? 62 : 76);
    }
    hs.push(62); ws.push(62);
    for (j = 0; j < hs.length; j++) tot += hs[j] + (j ? gap : 0);
    var st = "top:" + y0 + "px;gap:" + gap + "px";
    if (y0 + tot > 706) {
      fold = 1;
      cut = Math.ceil(hs.length / 2);
      for (j = 0; j < hs.length; j++)
        if (j < cut) colH += hs[j] + (j ? gap : 0);
      /* 两列的宽按**这一列里最宽的那一枚**算：`.tab` 76、`.tab.ic` 62，混着排时
         写死 134 会让第二列再折一次，变成三列。 */
      var w1 = 0, w2 = 0;
      for (j = 0; j < ws.length; j++) {
        if (j < cut) w1 = Math.max(w1, ws[j]);
        else w2 = Math.max(w2, ws[j]);
      }
      st += ";height:" + colH + "px;width:" + (w1 + 10 + w2) + "px;gap:" + gap + "px 10px";
    }
    var h = '<div class="tabs' + (fold ? " col2" : "") + '" style="' + st + '">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var cls = "tab " + (it.cls || "") + (it.off ? " off" : "") + (it.ic ? " ic" : "");
      /* 图标页签的名字以前只挂在 `.tip` 上，而 `.tip` 是 `opacity:0` 的悬停浮层 ——
         触屏、录屏、以及任何没有鼠标悬停的场合，玩家看见的就是一枚没有名字的图。
         18 处入口全中这一枪（规则／案情／食单／回帖…），其中就包括"这游戏有没有规则"。
         现在名字常驻在图标下面。 */
      var body = it.ic
        ? '<img src="' + artSrc(it.ic) + '" alt=""><b class="cap">' + it.t + "</b>"
        : "<span>" + it.t + "</span>";
      h += '<div class="' + cls + '" style="height:' + (it.ic ? 86 : th) +
        'px" data-act="' + (it.off ? "" : it.act) + '" data-arg="' + (it.arg || "") +
        '">' + body + "</div>";
    }
    // 静音开关跟在入口下面，每屏都在同一个位置。汉字走 HTML —— 即梦写不出可靠汉字，
    // 这条是「UI 走资产」的明文例外之一（与空白匾叠字、红方印印文同一条理由）。
    // 静音开关那格现在开的是「声」设置弹层（两轨音量 + 记忆）；
    // 字面上仍只认「音/静」一个字，反映的是"现在听不听得见"。
    h += '<div class="tab ic mute" style="height:62px" data-act="snd" data-arg="">' +
      '<b class="tip">声</b><span>' + ((SND.mute || (!SND.musOn && !SND.sfxOn)) ? "静" : "音") + "</span></div>";
    return h + "</div>";
  }

  function btn(act, label, arg) {
    return '<div class="btn end" data-act="' + act + '" data-arg="' + (arg || "") +
      '"><div class="in">' + label + "</div></div>";
  }

  function cardFace(c, art, band, cost, grade) {
    return '<div class="card' + (c.dead ? " no" : "") + '" data-act="' + (c.dead ? "" : "play") +
      '" data-arg="' + c.id + '">' +
      '<div class="in">' +
      (grade ? '<div class="grade ' + grade[1] + '"><span>' + grade[0] + "</span></div>" : "") +
      '<div class="plate2"><div class="in2"><span class="nm">' + c.nm + '</span><span class="tp">' + c.tp +
      (cost ? " · " + cost : "") + "</span></div></div>" +
      '<div class="note">' + c.note + "</div>" +
      (c.stall ? '<img class="stall" src="' + artSrc(c.stall) + '" alt="">' : "") +
      '<div class="art"><img src="' + artSrc(art) + '" alt=""></div>' +
      (c.tag ? '<div class="tagc' + (/^(破不了|借不动|吃不动|讲不动|存疑)$/.test(c.tag) ? " no" : " lie") + '">' + c.tag + "</div>" : "") +
      "</div>" +
      '<div class="band">' + band.map(function (b) {
        return '<div class="cell"><span class="bk">' + b[0] + '</span><span class="bv ' + (b[2] || "") + '">' + b[1] + "</span></div>";
      }).join("") + "</div>" +
      "</div>";
  }

  function sign(n) { return (n > 0 ? "+" : "") + n; }

  /* ── 高清优先：同一张图有 1080 原件，就不该再拿 480 预览糊在屏幕上 ──
     file:// 不许 fetch，运行时探不到文件在不在，所以「谁有原件」是一份写死的账：
     素材/高清/ 每收一批就跑一次 `node tools/hd_list.js` 重生成 高清清单.js，别手抄。
     只认根目录那一批（背景／场景／绣像／道具）—— 图标／立绘／菜牌那些是**抠图与打包件**，
     高清目录里没有对应物，硬拼一个路径只会换来一个 404 的灰框。 */
  function hdPick(rel) {
    if (typeof HD === "undefined" || rel.indexOf("/") >= 0) return null;
    var stem = rel.replace(/\.(webp|png|jpe?g|gif)$/i, "");
    return HD[stem] ? "素材/高清/" + stem + ".webp" : null;
  }
  /* 名字里带点的＝直接用原图（手绘背景的菜抠不干净，铺在米色卡心里反而干净）；
     不带点的走抠图资产。 */
  function artSrc(a) {
    var rel = a.indexOf(".") > 0 ? a : a + "-cut.png";
    return hdPick(rel) || "素材/" + rel;
  }
  /* ── 音效：一个 <audio> 元素池 ────────────────────────
     实测过 file:// 拦 fetch（Godot 那条死在这）但**不拦 `<audio>` 读本地媒体**，
     所以不引 WebAudio 合成 —— 用户明确要真素材。
     浏览器要求用户手势才准放，游戏里每个声音都跟在点击之后，天然满足。
     素材还没落地（SFX 表里 src 全空），所以文件不存在时**静默不响**：
     宁可一声不出，也不能让玩家听见 404 的咔哒。到位率交给 inventory 去报。 */
  var SFX_POOL = {}, SFX_MISS = {}, SFX_BY = null, SFX_AMB = "";
  function sfxDef(id) {
    if (!SFX_BY) {
      SFX_BY = {};
      for (var i = 0; i < (typeof SFX === "undefined" ? 0 : SFX.length); i++) SFX_BY[SFX[i].id] = SFX[i];
    }
    return SFX_BY[id];
  }
  /* 遥测：音效这条线以前**没有任何验收器覆盖** —— 文件在不在、解码成不成、
     有没有被 SFX_MISS 静默吞掉，全都看不见。所以每次调用都记一笔，
     `DP.sfxStats()` 读，`#sfxtest` 那条路由把它打到 DOM 上给无头 Chrome 回读。 */
  var SFX_TEL = { call: 0, fired: 0, muted: 0, nodir: 0, nobrowser: 0, err: {}, amb: {}, by: {} };
  function sfxAudio(id) {
    var d = sfxDef(id);
    if (!d) { SFX_TEL.nodir++; return null; }
    if (SFX_MISS[id]) return null;
    // 没有 Audio 就整个静音掉 —— 音效是锦上添花，不许有能力弄崩游戏
    if (typeof Audio === "undefined") { SFX_TEL.nobrowser++; return null; }
    var a = SFX_POOL[id];
    if (!a) {
      a = SFX_POOL[id] = new Audio(SFX_DIR + d.f + "." + (d.ext || "mp3"));
      a.addEventListener("error", function () {
        SFX_MISS[id] = 1;
        SFX_TEL.err[d.f] = (a.error ? a.error.code : "?");
      });
    }
    return a;
  }
  /* 一响的上限。素材里几支是"一整卷"而不"一下"：`paper` 是 10 次翻页共 9.59 秒、
     `lid` 是一串 thwack 共 8.12 秒、`taste` 是 7 口脆响共 6.90 秒。
     原来 `sfx()` 只有 `currentTime = 0; play()`，**没有"到点停"这一件事** ——
     于是玩家每翻一页纸，听到的都是整卷十次翻页。`check_audio` 只验"解不解得开"，看不见这个；
     9-29 深夜按帧链逐支量时长才把它量出来（`tools/check_audio.py` 那张表）。
     默认 1.5 秒；数据里的 `cap` 字段逐支覆盖 —— 能算出来的按算出来的钉，不猜。 */
  var SFX_MAX = 1.5, SFX_STOP = {};
  function sfx(id) {
    SFX_TEL.call++;
    // 逐支计数：整局点下来一次都没响过的音效＝白下载。
    // 跟「没有一条成就是永远拿不到的」同一条心法，只不过对象换成了素材清单。
    SFX_TEL.by[id] = (SFX_TEL.by[id] || 0) + 1;
    if (sfxVol() <= 0) { SFX_TEL.muted++; return; }
    var a = sfxAudio(id);
    if (!a) return;
    SFX_TEL.fired++;
    var d = sfxDef(id), cap = (d && d.cap) || SFX_MAX;
    if (SFX_STOP[id]) { clearTimeout(SFX_STOP[id]); SFX_STOP[id] = null; }
    try { a.pause(); a.currentTime = 0; } catch (e) { }
    try { a.volume = sfxVol(); } catch (e) { }
    var p = a.play();
    if (p && p.catch) p.catch(function () { SFX_TEL.blocked = (SFX_TEL.blocked || 0) + 1; });
    if (typeof setTimeout === "function") {
      SFX_STOP[id] = setTimeout(function () {
        SFX_STOP[id] = null;
        try { a.pause(); } catch (e) { }
      }, Math.round(cap * 1000));
    }
  }
  /* 环境声按屏切，且只在关卡屏切：dlg／book／map 这些屏返回 null，
     意思是「别动现在这条」—— 否则每说一句话就把灶火掐了。 */
  function ambFor() {
    var k = S.screen;
    if (k === "stove" || k === "tie") return "amb-stove";
    if (k === "street") return "amb-street";
    if (k === "hub" || k === "court" || k === "banquet") {
      return CHAPTER_KEY === "huizhou" ? "amb-rain" : CHAPTER_KEY === "danzhou" ? "amb-sea" : "";
    }
    return null;
  }
  function sfxAmbience() {
    var want = ambFor();
    if (want === null || want === SFX_AMB) return;
    if (SFX_AMB && SFX_POOL[SFX_AMB]) SFX_POOL[SFX_AMB].pause();
    SFX_AMB = want;
    SFX_TEL.amb[want || "(停)"] = (SFX_TEL.amb[want || "(停)"] || 0) + 1;
    if (!want || sfxVol() <= 0) return;
    var a = sfxAudio(want);
    if (!a) return;
    a.loop = true; a.volume = 0.3 * sfxVol();
    var p = a.play(); if (p && p.catch) p.catch(function () { });
  }
  function sfxMute(on) {
    SND.mute = on ? 1 : 0;
    applyVolumes();
    sndSave();
    return !SND.mute;
  }
  /* ── 声设置：两轨音量 + 静音记忆 ────────────────────────
     SFX_ON 以前是内存变量，「静音」刷新就忘 —— 一笔旧账；BGM 进来之后一枚开关
     也不够用：曲子要能单独关，柴火要能单独压低。所以立 SND：
     配乐/音效两轨各一份「开关 + 0..10 格音量」，外加一枚总静音。
     存 localStorage（SET_KEY），护栏与 saveGame 同一条：桩里没有 localStorage
     就整体静默跳过，坏档一律当作默认值 —— 设置不许有能力弄崩游戏。
     音量换算：音效轨 10 格 = 满音量；配乐轨 10 格只给 0.55 —— 曲子是铺底，
     盖过柴火和翻页声是混音事故，不是氛围。0 格与「关」并存：效果一样，
     一个顺手、一个 Explicit（弹层里两个都给玩家）。 */
  var SET_KEY = "dp_xinglv_snd_v1";
  var SND = { mus: 6, sfx: 8, musOn: 1, sfxOn: 1, mute: 0 };
  /* 弹层开着的记账：覆盖屏不动 S.screen，sndKey 改完要不要重画弹层，靠它判断。
     只有两条路进出：act "snd" 进（置 1），act "back" 出（清 0）—— 弹层上
     除了刻度和开关只有 backTab 一枚可点的东西，出口齐了。 */
  var SND_OPEN = 0;
  function sndLoad() {
    try {
      if (typeof localStorage === "undefined") return;
      var raw = localStorage.getItem(SET_KEY);
      if (!raw) return;
      var o = JSON.parse(raw), k;
      for (k in SND) if (o[k] !== undefined) SND[k] = o[k];
    } catch (e) { }
    if (!(SND.mus >= 0 && SND.mus <= 10)) SND.mus = 6;
    if (!(SND.sfx >= 0 && SND.sfx <= 10)) SND.sfx = 8;
    SND.musOn = SND.musOn ? 1 : 0;
    SND.sfxOn = SND.sfxOn ? 1 : 0;
    SND.mute = SND.mute ? 1 : 0;
  }
  function sndSave() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(SET_KEY, JSON.stringify(SND));
    } catch (e) { }
  }
  function musVol() { return (SND.mute || !SND.musOn) ? 0 : SND.mus / 10 * 0.55; }
  function sfxVol() { return (SND.mute || !SND.sfxOn) ? 0 : SND.sfx / 10; }
  /* 改完当场听见：两轨正在响的每一支都按新格数改 volume；静了就 pause，
     开回来把「正在那一支」续上（环境声续 amb、配乐续 MUS_NOW，一堆一响的死在原地不管）。 */
  function applyVolumes() {
    var v = sfxVol(), m = musVol(), k, p;
    for (k in SFX_POOL) {
      if (!SFX_POOL[k]) continue;
      try { SFX_POOL[k].volume = (k === SFX_AMB ? 0.3 * v : v); } catch (e) { }
      if (v <= 0) { try { SFX_POOL[k].pause(); } catch (e) { } }
    }
    if (v > 0 && SFX_AMB && SFX_POOL[SFX_AMB] && SFX_POOL[SFX_AMB].paused &&
        typeof SFX_POOL[SFX_AMB].play === "function") {
      p = SFX_POOL[SFX_AMB].play(); if (p && p.catch) p.catch(function () { });
    }
    for (k in MUS_POOL) {
      if (!MUS_POOL[k]) continue;
      try { MUS_POOL[k].volume = m; } catch (e) { }
    }
    if (MUS_NOW && MUS_POOL[MUS_NOW]) {
      if (m <= 0) { try { MUS_POOL[MUS_NOW].pause(); } catch (e) { } }
      else if (MUS_POOL[MUS_NOW].paused && typeof MUS_POOL[MUS_NOW].play === "function") {
        p = MUS_POOL[MUS_NOW].play();
        if (p && p.then) p.then(musStamp, musStamp);
        if (p && p.catch) p.catch(function () { });
      }
    }
    musStamp();
  }
  /* ── 配乐（BGM）：与环境声分层的第二条循环轨 ─────────────
     表在 行旅数据.js 的 MUS（封面一曲、四章各一主题、终局一曲），文件在 素材/音乐/。
     规则与 sfxAmbience 完全同一条：按屏换曲、返回 null 意思是「别动现在这条」；
     文件取不到静默不响（MUS_MISS），没有 Audio 整条静音 —— 配乐是锦上添花，
     与音效同一条心法：不许有能力弄崩游戏。 */
  var MUS_POOL = {}, MUS_MISS = {}, MUS_NOW = "";
  var MUS_TEL = { by: {}, err: {} };
  function musDef(id) {
    if (typeof MUS === "undefined") return null;
    for (var i = 0; i < MUS.length; i++) if (MUS[i].id === id) return MUS[i];
    return null;
  }
  function musAudio(id) {
    var d = musDef(id);
    if (!d || MUS_MISS[id] || typeof Audio === "undefined") return null;
    var a = MUS_POOL[id];
    if (!a) {
      a = MUS_POOL[id] = new Audio(MUS_DIR + d.f + "." + (d.ext || "mp3"));
      a.addEventListener("error", function () {
        MUS_MISS[id] = 1;
        MUS_TEL.err[d.f] = (a.error ? a.error.code : "?");
      });
      /* 媒体状态一变就重盖 data-musplaying：play() 兑现的时机赶不上 layer() 的章，
         等 playing/CanPlay/waiting/error 这些事件来把戳改成真相。 */
      ["playing", "canplay", "waiting", "stalled", "pause", "error", "emptied"].forEach(function (ev) {
        a.addEventListener(ev, musStamp);
      });
    }
    return a;
  }
  /* 哪一屏唱哪支：封面／终局各归各；章内一切屏都归本章主题；
     规则／成就／案情／声设置／制作这些覆盖屏返回 null —— 换一层皮不换一支曲。 */
  function musFor() {
    var k = S.screen;
    if (k === "cover") return "mu-cover";
    if (k === "finale") return "mu-finale";
    if (k === "hub" || k === "court" || k === "banquet" || k === "street" || k === "travel" ||
        k === "book" || k === "map" || k === "wall" || k === "letter" || k === "taste" ||
        k === "end" || k === "stove" || k === "tie") return "mu-" + CHAPTER_KEY;
    return null;
  }
  /* 「封面曲到底正在响没有」钉进 DOM：play 的兑现是异步的，所以在**各兑现点**盖章，
     而不是只在 layer()（那里盖章时 play 往往还没回来，永远是 0，白钉）。
     check_audio 的「音乐真播」闸读的就是这个戳。 */
  function musPlaying() {
    /* 只看 paused 会被 Chrome 骗：load 失败后 play() 拒绝了、paused 仍是 false（实测假绿）。
       「真的在放」＝没暂停 && 解码到了可播状态（readyState≥2）&& 音量没归零。 */
    var a = MUS_NOW && MUS_POOL[MUS_NOW];
    return !!(a && typeof a.paused === "boolean" && !a.paused &&
      typeof a.readyState === "number" && a.readyState >= 2 && musVol() > 0);
  }
  function musStamp() {
    var stg = document.getElementById("stage");
    if (stg && stg.setAttribute) stg.setAttribute("data-musplaying", musPlaying() ? "1" : "0");
  }
  function sfxMusic() {
    var want = musFor();
    if (want === null || want === MUS_NOW) return;
    if (MUS_NOW && MUS_POOL[MUS_NOW]) { try { MUS_POOL[MUS_NOW].pause(); } catch (e) { } }
    MUS_NOW = want;
    MUS_TEL.by[want] = (MUS_TEL.by[want] || 0) + 1;
    if (!want) { musStamp(); return; }
    var a = musAudio(want);
    if (!a) { musStamp(); return; }
    a.loop = true; a.volume = musVol();
    if (musVol() <= 0) { musStamp(); return; }   // 静音状态下不发起播放；开回来由 applyVolumes 续
    var p = a.play();
    if (p && p.then) p.then(musStamp, musStamp);  // 兑现/被拦都重盖一次——两种结局都得让闸看见
    else musStamp();
  }
  /* 浏览器要一次用户手势才准出声 —— 游戏里每个音效都跟着点击走，天然满足；
     只有封面曲例外：它想在第一下点击**之前**就开始。所以挂一支「第一声」引子：
     任意一次按下/按键把当时这一屏的音乐和环境声补上。
     引子不是 once：被 autoplay 拦掉的那次 play 不留痕，want 对上了会短路，
     所以这里补一手「想要的还 paused 就再试一次」。重复点击是空转，不是重复播放。 */
  function sndKick() {
    sfxAmbience();
    sfxMusic();
    musStamp();
    if (MUS_NOW && MUS_POOL[MUS_NOW] && MUS_POOL[MUS_NOW].paused && musVol() > 0 &&
        typeof MUS_POOL[MUS_NOW].play === "function") {
      var p = MUS_POOL[MUS_NOW].play();
      if (p && p.then) p.then(musStamp, musStamp);
      if (p && p.catch) p.catch(function () { });
    }
    if (SFX_AMB && SFX_POOL[SFX_AMB] && SFX_POOL[SFX_AMB].paused && sfxVol() > 0 &&
        typeof SFX_POOL[SFX_AMB].play === "function") {
      var p2 = SFX_POOL[SFX_AMB].play(); if (p2 && p2.catch) p2.catch(function () { });
    }
  }
  try {
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("pointerdown", sndKick, true);
      document.addEventListener("keydown", sndKick, true);
    }
  } catch (e) { }

  /* 立绘候选链：data-fb 里存着「这张取不到就依次试下面那几张」。
     表情差分有一批还没抽到，浏览器里又查不了文件在不在，只能这样逐级退。 */
  /* ⚠ 这里必须**先解码再切**：`faceTag` 写 `data-fb` 时是整条链一起 encodeURIComponent 的，
     分隔符 `|` 在属性里长成 `%7C`。上一版直接 split("|") → 永远只切出一段 →
     把「A%7CB」整串当 src 赋上去 → 第二跳起必挂，而且 data-fb 已被清空，第三跳没有。
     只有**两级以上兜底**才会踩到（一级时那串里没有 %7C，浏览器自己会解码，看起来是好的），
     所以它一直活着：差分缺图的人本来就少，一缺就露 —— 儋州姜唐佐的「惊」这一轮撞上了。 */
  function imgFallback(el) {
    var rest;
    try { rest = decodeURIComponent(el.getAttribute("data-fb") || ""); }
    catch (e) { rest = el.getAttribute("data-fb") || ""; }   // 半截百分号编码也别抛
    rest = rest.split("|").filter(Boolean);
    if (!rest.length) {
      /* 三级全挂：钉一个数给验收器回读。`stampFault` 量不到这一类 ——
         它在 `layer()` 里同步跑，那时图还没开始加载，`complete` 是 false。 */
      var st = document.getElementById("stage");
      if (st) st.setAttribute("data-imgfail", (+st.getAttribute("data-imgfail") || 0) + 1);
      return;
    }
    el.setAttribute("data-fb", encodeURIComponent(rest.slice(1).join("|")));
    el.src = rest[0];
  }
  /* 一个人该显示哪张图：差分 → 本人基图 → 数据里写的那张。
     少了中间那级，一句没抽到的差分就把这人打回旧脸，而隔壁一句还是新脸 ——
     同一段对话里换两张脸，比整段沿用旧图更糟。 */
  function faceTag(face, e) {
    var fx = "", base = "";
    if (e && typeof fxArt === "function") fx = fxArt(face, e);
    if (typeof fxBase === "function") base = fxBase(face);
    var cs = [fx, base || face, face]
      .filter(function (s, i, a) { return s && a.indexOf(s) === i; }).map(artSrc);
    return '<img src="' + cs[0] + '" data-fb="' + encodeURIComponent(cs.slice(1).join("|")) +
      '" onerror="DP.fb(this)" alt="">';
  }

  var DECK_W2 = 1280 - 144 - 246;
  function deckOpen(n, db) {
    var cw = Math.min(170, Math.floor((DECK_W2 - 14 * (n - 1)) / Math.max(1, n)));
    var tw = cw * n + 14 * (n - 1) + 34;
    var tx = 144 + (DECK_W2 - tw) / 2;
    var st = "left:" + Math.round(tx) + "px;width:" + Math.round(tw) + "px";
    if (db) st += ";--db:" + db + "px";
    return '<div class="tray" style="' + st + '"></div><div class="deck" style="--cw:' + cw +
      "px;" + (db ? "--db:" + db + "px" : "") + '">';
  }
  function capBand(band) { return band.length > 3 ? band.slice(0, 3) : band; }

  /* 一块浮层要跟**四张不同位置的匾**共存，就没有固定的 x —— 只能现量现让。
     默认摆在左墙那条带上（x116 起，让开 tabs 那一列 x26..102）；
     只要与这一屏的匾面相交，就整块挪到匾的右边，右边界停在木牌左界 x1110 之前；
     匾在画面太靠右、挪过去放不下，才改往匾下面走（同时压住板高，不许顶到下面那片读数栏）。
     **匾不够高（<105）时副题是另起一个 `.subw` 落在匾下的素墙上的**，宽 296 ——
     那一片也算标题占位：只量匾就会漏掉"匾让开了、副题还被压着"这一种，惠州灶前第一版就死在这。
     让干净没有由 `stampClash()` 在真浏览器里逐屏回读，不靠这段自己声称。 */
  function notesClear() {
    var L = 116, T = 214, W = 560, R = 1110, BOT = 404;   // 兜底：读数栏定高之后上沿是死的 410，留 6 px 缝
    /* 读数栏原来由内容撑高（9-28 加了「下一拍」就往上长了几十 px，顶进笔记板下半截），
       现在它定高了，这个数也就是死的；仍然现量一次，量到就用量的 ——
       写死的几何一旦有人改 CSS 就会静默错位，量得到就别信常数。 */
    var m = document.querySelector("#layer .z-meters");
    if (m && m.getBoundingClientRect) {
      var mr = m.getBoundingClientRect(), sr = document.getElementById("stage").getBoundingClientRect();
      var kk = sr.width / 1280 || 1;
      if (mr.height > 20) BOT = Math.round((mr.top - sr.top) / kk) - 6;
    }
    var b = typeof boardRect === "function" ? boardRect(CUR_BG) : null;
    /* 右边那道界不是屏幕，是**案上实物那一栏**：笔记板让开匾之后一路向右，
       原来只受 R=1110（木牌）管，于是右界伸到 x922 —— 正好把 tray 左半那几件实物压在下面
       （`hit` 抓到的：三件东西看得见点不动）。让位线同样现量。 */
    var TR = 694, ty = document.querySelector("#layer .z-tray");
    if (ty && ty.getBoundingClientRect) {
      var kr = document.getElementById("stage").getBoundingClientRect(), kk2 = kr.width / 1280 || 1;
      var tl = (ty.getBoundingClientRect().left - kr.left) / kk2;
      if (tl > 200) TR = Math.round(tl) - 6;
    }
    var cap = function (s) {                        // 底板：不许压到读数栏（已经限过高就不重复限）
      return s.indexOf("max-height") >= 0 || T + 196 <= BOT ? s
        : s + ";max-height:" + Math.max(74, BOT - T) + "px";
    };
    if (!b) return cap("left:" + L + "px;top:" + T + "px;width:" + Math.min(W, TR - L) + "px");
    var bl = b[0] * 1280, bt = b[1] * 720, br = (b[0] + b[2]) * 1280, bb = (b[1] + b[3]) * 720;
    if (bb - bt < 105) { br = Math.max(br, bl + 296); bb += 66; }
    var st = "";
    if (br > L && bl < R && bb > T && bt < T + 196) {
      var nl = Math.round(br + 16);
      if (nl + 320 <= TR) { L = nl; W = Math.min(560, TR - L); }
      else { T = Math.round(bb + 12); W = Math.min(W, TR - L);
        st = ";max-height:" + Math.max(90, BOT - T) + "px"; }
    }
    return cap("left:" + Math.round(L) + "px;top:" + T + "px;width:" + Math.round(W) + "px" + st);
  }

  // ── 插一句：他忽然转题 ──────────────────────────────
  /* 不是「答对/答错」的一层。三个选项都是他真说过的句子（lie 那条是**别人以为他说过**的），
     说不说只改这一章的气质与清欢册，不掉时辰、不判输赢。
     它故意做成**自己冒出来**的，不设入口 —— 因为他写信本来就是写着写着就转了题。 */
  function pendingAside() {
    var a = DATA.asides;
    return a && S.aside < a.length && S.shichen > 0 ? a[S.aside] : null;
  }
  function renderAside() {
    var q = pendingAside(); if (!q) return "";
    /* 底换成"随手撕下来、还没写的那一张素笺"（`asidepaper-4`，四张里纸面最干净、
       左上没有那块褐渍——「插一句」三个字正好落在那儿）。
       与来信那页**封了口、盖了朱印的信封**是两种东西：一封是别人递来的，
       一张是他自己要不要写的。图由 artSrc() 挂，CSS 里写死拿不到高清。 */
    return '<div class="aside" style="background-image:url(&quot;' +
      artSrc("asidepaper-4.webp") + '&quot;)"><div class="in5"><span class="k">插一句</span>' +
      "<b>" + q.t + "</b><em>" + q.src + "</em><i>" + q.hint + "</i>" +
      '<div class="row2">' +
      '<div class="btn say" data-act="quip"><div class="in">就说这一句</div></div>' +
      '<div class="btn hush" data-act="hush"><div class="in">咽下去</div></div>' +
      "</div></div></div>";
  }
  function sayAside() {
    var q = pendingAside(); if (!q) return;
    S.quips.push({ i: S.aside, t: q.t, src: q.src, lie: !!q.lie });
    S.aside++;
    if (q.lie) { S.bars.物议 -= 3; toast("说了那句不是他写的话：物议 -3 —— 有人当场说，这句不在集子里"); }
    else { S.bars.人情 = clamp(S.bars.人情 + 3, 0, 100); toast("他把话头岔开了：清欢册 +1 句"); }
    renderHub();
  }
  function hushAside() {
    S.aside++;
    S.bars.物议 += 1;
    toast("他没说。这一句就留在信纸外头了");
    renderHub();
  }

  // ── 有新信：在 hub 自己冒一块匾 ──────────────────────
  /* 原先信只有一个「来信」竖幅入口，玩家不点就永远看不见它 —— 而信是**日子到了自己寄来的**，
     不是待办清单上的一格。所以到期未回、又没看到过的信，直接在今日那一屏挂一块提醒匾。
     它与「插一句」共用 bracket-1 那个位置（left:250 top:296）：**来信优先，插一句顺延**，
     两块匾叠在一起谁都读不了，这不是取舍是几何。 */
  function newMail() {
    var ps = pending(), i;
    for (i = 0; i < ps.length; i++) if (!S.mailSeen[ps[i].id]) return ps[i];
    return null;
  }
  function renderMailNote() {
    var L = newMail(); if (!L) return "";
    /* 底是那一页摊开的信笺（`mailnote-1`）。走 `artSrc()` 而不是把文件名写死在 CSS 里：
       只有这条链会去查高清清单，CSS 里写死就永远拿 480 的那张预览拉成 660 px 宽。 */
    return '<div class="aside mail" data-act="openmail" data-arg="' + L.id +
      '" style="background-image:url(&quot;' + artSrc("mailnote-1.webp") + '&quot;)">' +
      '<div class="in5"><span class="k">新到一封信</span>' +
      "<b>" + L.from + " 寄自 " + String(L.who).split(" · ")[0] + "</b>" +
      "<em>" + L.ask + "</em><i>点一下就看 · 回不回都要回，不回的话人情是要掉的</i>" +
      "</div></div>";
  }

  // ── 大厅：今日 ──────────────────────────────────────
  /* ── 开场：那一枚盖不下去的印 ─────────────────────────────
     整局游戏的口径只有一句：**用他写过的东西，换他活下去的地方。**
     原来开场是一纸文书加三句对话 —— 玩家被*告知*「不得签书公事」，
     但从没亲手盖过一次、从没见过它是空的。这一屏就补那一下：
     盖下去，纸上只余一个空心朱框，一个字也落不下；旁边落下的是一句诗。
     它不改任何判定（不进账、不掉时辰），是一次**演示**，看一次就收走。
     文案表 `EDDICT` 在 行旅数据.js —— 验收器要按它决定哪一章进得去这一屏，
     放在这里它就读不到，只能手抄一份映射，而手抄的映射一定会漂。 */
  function renderEdict() {
    var e = EDDICT[CHAPTER_KEY]; if (!e) { S.screen = "hub"; renderHub(); return; }
    var p = S.edict || 0;
    set(bg("hub", "sc-hub2-3.webp"));
    /* 第三个参数＝走横带：这一屏自己摊了一张公文纸，标题挂在匾上会被纸盖住
       （`paperCoversBoard` 那条断言把 `.edict` 也算作自带纸的屏）。 */
    var h = plate(e.title, e.kicker, 1);
    h += '<div class="edict"><div class="kick">' + e.edict + "</div>" +
      '<div class="ban">' + e.ban + '</div><div class="bsrc">' + e.banSrc + "</div>" +
      '<div class="slot">' + (p
        ? '<img class="mark" src="' + artSrc("图标/ico-kongyin.png") + '" alt="">'
        : '<img class="press" src="' + artSrc(e.press || "seal-kong-1-cut.png") + '" alt="">') +
      "</div>" + (p
        ? '<div class="thesis">' + e.thesis + '</div><div class="verse">' + e.verse +
          '<i>' + e.vsrc + "</i></div>" +
          /* 定州那一纸多一行债的预告：空印这一状**不在这一章结**，
             玩家若看不见它去哪，攒的就是一笔莫名其妙的账。黄州没有 `owe`，也就不多这一行。 */
          (e.owe ? '<div class="owe">' + e.owe + "</div>" : "")
        : '<div class="hint2">' + e.hint + "</div>") +
      "</div>";
    h += panel({ k: "名目", v: p ? "空印" : "待盖", cls: p ? "bad" : "" });
    h += p ? btn("edictout", "出门去") : btn("edict", "盖下这枚印");
    h += '<div class="core">' + e.core + "</div>";
    layer(h);
  }
  function edictSeen() {
    var v = S.flags.edict;
    if (typeof v === "number") return !!v;            // 旧档：1 只可能是"黄州那一场看过了"
    return !!(v && v[CHAPTER_KEY]);
  }
  function edictDone() {
    var v = S.flags.edict;
    S.flags.edict = (v && typeof v === "object") ? v : { huangzhou: v ? 1 : 0 };
    S.flags.edict[CHAPTER_KEY] = 1;
  }
  /* ── 新手引导：三步，只在"第一次真的开局"那一次亮 ──────────────
     用户点的名："没有新手教程引导动画"。三步各点亮今日屏上的一块，配一句话：
       ① 右栏五札 —— 你手上有什么；② 左栏入口 —— 去哪儿做事；③ 匾 —— 这一章要盖什么。
     两条约束是硬的：
       · 遮罩与高亮框一律 `pointer-events:none`。否则 `hit` 闸会把底下每一枚入口都判成
         "被压住"——那是把引导做成了拦路，而且这条红会一直亮着，没人再信它。
       · 亮不亮只看 `S.tut`（0..N-1 是步序，-1 是看过/跳过），而 `S.tut` 进存档：
         无档新开局（含 `?fresh` 清档）才亮；回来的人不亮。
     还有第三条是验收自己要求的：**带哈希的路由一律不亮**。那两百多条截图拍的是
     "这一屏本来长什么样"，遮罩与卡片压上去，匾的对比度、入口的可点性就全成了引导的替身 ——
     要看引导本身走 `#章/tut/<步>`，那条路由自己把它打开（`TUT_FORCE`）。 */
  var TUT = [
    { sel: ".panel", hd: "你手上有什么",
      t: "五枚木札：时辰是还能办几件事，银钱·人情·身体·物议是办事要花的。" },
    { sel: ".tabs", hd: "去哪儿做事",
      t: "判案去堂上，吃饭去灶前，买东西上街，会客去席间 —— 每做一件扣一个时辰。" },
    { sel: ".onb", hd: "这一章要盖什么",
      t: "时辰用完就去章末盖下这一章的印；乡望够 12，那枚印才算真盖上了。" }
  ];
  var TUT_FORCE = 0;
  /* 验收专用的「内存里的一份档」：`#章/cover/saved` 与 `/ask` 要点亮封面上有档的那两面
     （与 TUT_FORCE 同一条路子 —— 只开观测量，不碰判定、不碰存储）。 */
  var COVER_FAKE = "";
  function tutOn() {
    return S.tut >= 0 && S.tut < TUT.length && (!NO_SAVE || TUT_FORCE);
  }
  function tutCard() {
    if (!tutOn()) return "";
    var s = TUT[S.tut], last = S.tut + 1 >= TUT.length;
    return '<div class="tut-ring" id="tutring"></div>' +
      '<div class="tut-card"><b>' + s.hd + "</b><p>" + s.t + "</p>" +
      '<span class="tut-n">第 ' + (S.tut + 1) + " / " + TUT.length + " 步</span>" +
      '<div class="btn" data-act="tut" data-arg="' + (last ? -1 : S.tut + 1) +
      '"><div class="in">' + (last ? "明白了" : "下一步") + "</div></div></div>" +
      '<div class="tut-skip" data-act="tut" data-arg="-1">跳过引导</div>';
  }
  /* 高亮框要罩住哪一块，只有量得出来：读那一块的真矩形，写进框自己的四个边，
     同时把「第几步 + 目标矩形」钉在 `data-tut` 上给验收器回读。 */
  function tutPlace() {
    var stg = document.getElementById("stage"), ring = document.getElementById("tutring");
    if (!stg || !ring || !tutOn()) return;
    var tgt = document.querySelector("#layer " + TUT[S.tut].sel);
    if (!tgt || !tgt.getBoundingClientRect) return;
    var sr = stg.getBoundingClientRect(), k = sr.width / 1280;
    if (!k || k < 0.02) return;                      // Node 桩里没有布局
    var r = tgt.getBoundingClientRect();
    var x = (r.left - sr.left) / k, y = (r.top - sr.top) / k,
        w = r.width / k, h = r.height / k;
    ring.style.left = Math.round(x - 8) + "px";
    ring.style.top = Math.round(y - 8) + "px";
    ring.style.width = Math.round(w + 16) + "px";
    ring.style.height = Math.round(h + 16) + "px";
    stg.setAttribute("data-tut", S.tut + "/" + Math.round(x) + "," + Math.round(y) + "," +
      Math.round(w) + "x" + Math.round(h));
  }
  /* ── 封面：双击进来的第一眼 ────────────────────────────
     用户点的名："不能一点就进游戏啊，封面要好好做啊，真就一点进游戏是吧。"
     主图是一张 16:9，标题与四个入口**全部走 HTML**（即梦写不出可靠汉字，
     这条是「UI 走资产」的明文例外）；主图刻意在右上与下方留素面，字压上去才读得清。
     只有**不带哈希**的起机才落在这张屏上：验收那两百多条路由要的是"某一屏长什么样"，
     把它们一律拦在封面上，等于把整趟验收拍成同一张图。 */
  /* 10-03：即梦那张 `dpcover` 仍产不出来（Tabbit 浏览器窗口全关，CDP 发不出 newPage，
     要人重开窗口才能跑）。先用盘上现成的高清雪景顶位 —— 1080×608、右上天空是素的，
     竖排标题压得住；情绪也对：贬谪行旅本就该从一场雪开始。即梦到货后只换这一行。 */
  /* 主图是即梦那批 `dpcover-1..4` 里挑的第四张。四张都照提示词画出了"右上留素面"，
     但 1 与 3 的素面是一道**看得见的纸缝**（像被人贴了一块空白纸上去），2 的右上角有一小块淡方斑 ——
     挑封面看的是"字压上去那一片干不干净"，不是哪一张最好看（这条是产图那边踩过的老坑）。
     第 4 张右半是开阔雪江与淡天，竖排标题落在上面没有接缝。
     （上一版这里临时借的是场景图 `fx-hz-hub-snow-c-1`，那张要给今日屏用，不该同时当封面。） */
  var COVER_ART = "dpcover-4.webp";
  function saveInfo() {
    /* 带哈希的跑法一律 NO_SAVE（见 :3515 那句），真档在验收里根本读不到 ——
       于是封面「继续 · 章名」恒灰、「确定重开？」永不出现，那两面从来没有图。
       这一份只在内存里：写进 localStorage 就等于为了一张截图去开「丢档比没档更糟」那道闸。 */
    if (COVER_FAKE) return { v: 1, chapter: COVER_FAKE };
    try {
      if (typeof localStorage === "undefined") return null;
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || !CHAPTERS[o.chapter]) return null;
      return o;
    } catch (e) { return null; }
  }
  function renderCover() {
    var o = saveInfo(), nm = o ? CHAPTERS[o.chapter].chapter.name : "";
    set(COVER_ART);
    /* 「开始」在**有档**的时候不能一按就抹掉人家玩到一半的四章：第一下改成确认，第二下才真重开。
       这一格是封面自己的临时态，不进存档（`S.coverAsk` 不在 SAVE_F 里）。 */
    var ask = !!o && S.coverAsk;
    var h = '<div class="cover"><h1>东坡行旅</h1>' +
      '<p class="cvsub">元丰三年 — 建中靖国元年 · 一顶东坡巾，一口白砂锅</p>' +
      '<div class="cvent">' +
      '<div class="btn' + (ask ? " ask" : "") + '" data-act="coverstart"><div class="in">' +
      (ask ? "确定重开？" : "开始") + "</div></div>" +
      // 没档的时候「继续」是灰的：`data-act=""` 就是本项目"看得见但点不动"那一档
      '<div class="btn' + (o ? "" : " off") + '" data-act="' + (o ? "coverresume" : "") +
      '"><div class="in">继续' + (o ? " · " + nm : "") + "</div></div>" +
      '<div class="btn" data-act="rules"><div class="in">规则</div></div>' +
      '<div class="btn" data-act="achv"><div class="in">成就</div></div>' +
      "</div>" +
      /* 制作与授权不进 .cvent：五枚 158px 的按钮已经挤不下 744px（894>744），
         硬塞就是一条现成的溢出红。落成左下角一行小字 —— 授权是给想看的人看的。
         「声」在右下：封面曲已经在唱了，调它的大门不该等进了章才开。 */
      '<div class="cvcr" data-act="credit">制作 · 授权</div>' +
      '<div class="cvcr r" data-act="snd">声</div>' +
      (ask ? '<p class="cvwarn">开始会覆盖「' + nm + "」那一局 · 再点一下确认</p>" : "") +
      "</div>";
    S.screen = "cover";
    layer(h);
    var stg = document.getElementById("stage");
    if (stg && stg.setAttribute) stg.setAttribute("data-save", o ? nm : "");
  }
  /* ── 今日屏的住户与那道光（美术诊断 C/D 项）──────────
     每章一位 Q 版东坡坐在门前空砖地上：素材本来就是按年龄产的四套
     （黄州掌勺 dp45 · 定州官袍 dp57 · 惠州拄杖携荔 dp58 · 儋州坐读 dp62），
     一直躺在盘上没人接。left/height 每章各一份 —— 四张背景的门前空地不在同一处。
     ⚠ 只在今日屏（hub）出现：对话/关卡屏有自己的立绘体系，混进去就是两层画风打架。 */
  var QB_HUB = {
    huangzhou: { art: "qb-dp45-3-cut.png", left: 664, h: 226 },
    dingzhou:  { art: "qb-dp57-3-cut.png", left: 700, h: 222 },
    huizhou:   { art: "qb-dp58-1-cut.png", left: 700, h: 228 },
    danzhou:   { art: "qb-dp62-1-cut.png", left: 656, h: 196 }
  };
  /* 天气表：雪／雨是"这一站长什么样"的一部分（河北的雪、岭南的雨），
     只落在**户外那三屏**（今日／上街／行旅路上）—— 室内飘雪是穿帮，不是氛围。 */
  var WEATHER = { dingzhou: "snow", huizhou: "rain" };
  function weatherKind() {
    var k = WEATHER[CHAPTER_KEY] || "";
    if (S.screen !== "hub" && S.screen !== "street" && S.screen !== "travel") k = "";
    return k;
  }
  /* 雪片/雨丝用**固定种子**的伪随机：截图要能复现（两趟验收拍同一路由，
     落点不同会给"对图"的人造噪声）。种子写死，每一片的位置/周期就都写死。 */
  function weatherHTML(kind) {
    if (!kind) return "";
    var seed = 42;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var out = "", n = kind === "snow" ? 34 : 30, i;
    for (i = 0; i < n; i++) {
      var st = "left:" + (rnd() * 100).toFixed(1) + "%;animation-duration:" +
        (kind === "snow" ? (7.5 + rnd() * 7).toFixed(2) : (0.85 + rnd() * 0.7).toFixed(2)) + "s;animation-delay:-" +
        (rnd() * 9).toFixed(2) + "s;--dx:" + Math.round((kind === "snow" ? 10 : -26) + rnd() * 30) + "px;";
      if (kind === "snow") {
        var s2 = (3 + rnd() * 3).toFixed(1);
        st += "width:" + s2 + "px;height:" + s2 + "px;opacity:" + (0.55 + rnd() * 0.45).toFixed(2) + ";";
      } else {
        st += "height:" + (13 + Math.round(rnd() * 7)) + "px;opacity:" + (0.35 + rnd() * 0.35).toFixed(2) + ";";
      }
      out += "<i style=\"" + st + "\"></i>";
    }
    return out;
  }
  var WX_MEM = "";
  function weatherSet() {
    var k = weatherKind(), sig = CHAPTER_KEY + "|" + S.screen + "|" + k;
    var stg = document.getElementById("stage");
    if (stg && stg.setAttribute) stg.setAttribute("data-fx", k);
    if (sig === WX_MEM) return;
    WX_MEM = sig;
    var fe = document.getElementById("fx");
    if (fe) { fe.className = k; fe.innerHTML = weatherHTML(k); }
  }

  function renderHub() {
    if (S.arrive) { S.arrive = false; if (say("arrive", "go/hub")) return; }
    /* 开场那一屏：每章**各自**拦一次（黄州那枚空石、定州那枚真官印，是两场戏，不是同一场重播）。
       `S.flags.edict` 原来是一个 0/1，黄州看完就把定州那一纸也一并吃掉了 —— 现在按章记。
       旧档里它是数字 1，那只能是"黄州看过"，所以照 `{huangzhou:1}` 认，别让老玩家白丢定州那一屏。
       `NODLG` 是"一次性过场全跳过"那个验收开关，这一屏正是其中的一次性过场，
       所以它一起压掉 —— 否则截图路由会全部落在 edict 上（那不是它们该拍的屏）。
       要拍它走 `#章/edict` 与 `#章/edict/2` 两条具名路由。 */
    if (!NODLG && !edictSeen() && EDDICT[CHAPTER_KEY]) { S.screen = "edict"; renderEdict(); return; }
    set(bg("hub","sc-hub2-3.webp"));
    var left = S.maxShichen - S.shichen;
    // 匾只有三到四个字的容量（产图交付 §52 那条坏消息：镜头一拉远，堂前匾宽只剩 0.12~0.16；
    // fx2 推近重画后到 0.175~0.297，仍然装不下「今日 · 黄州 元丰四年」十个字）。
    // 所以匾上只挂堂名，年月与身份落到匾下那片素墙上。
    var h = plate(DATA.chapter.name,
      "今日 · " + DATA.chapter.year + " · " + DATA.chapter.age +
      " · " + (DATA.chapter.office || ""));
    /* 第五枚给「这一章在欠什么」：定州攒下的空印状数跨章不清零，进惠州要折成人情。
       没有债就宁可空着一枚 —— 不拿「已入册」占位，那个数在食单那一屏自己看得到。 */
    h += panel(S.kongYin ? { k: "空印", v: S.kongYin + " 状", cls: "bad" } : null);
    h += '<div class="intent hub">' +
      '<div class="in"><b>' + nbUnits(DATA.lines.arrive.t, "，", 11) + "</b><em>" + DATA.lines.arrive.src +
      "</em><em>—— 想吃什么、判什么、走哪条路，挑一个时辰去做一件事" +
      (S.debt ? "　｜　定州空印 " + S.kongYin + " 状追论下来：人情已先扣 " + S.debt : "") +
      "</em></div></div>";
    var hubTabs = [
      { t: "堂上", cls: "t2", ic: "图标/ico-hall.png", act: "go", arg: "court", off: left === 0 },
      { t: "灶前", cls: "t3", ic: "图标/ico-stove.png", act: "go", arg: "stove", off: left === 0 },
      { t: "席间", cls: "t1", ic: "图标/ico-banquet.png", act: "go", arg: "banquet", off: left === 0 },
      { t: "上街", cls: "t4", ic: "图标/ico-street.png", act: "go", arg: "street", off: left === 0 }
    ];
    /* 光与住户：一束从檐上斜下来的暖光（照的是地上那片空砖，不照任何字），
       加一位坐在光里的 Q 版东坡 —— 美术诊断"全静止/空无一人"两病在今日屏的解。
       两者都不接事件、不带文字：hit 闸与 out 闸都碰不到它们。 */
    h += '<div class="beam" style="left:470px;top:-40px;width:660px;height:600px"></div>';
    var qbh = QB_HUB[CHAPTER_KEY];
    if (qbh) h += '<div class="hubqb" style="left:' + qbh.left + 'px;bottom:4px;height:' + qbh.h +
      'px"><img src="' + artSrc(qbh.art) + '" data-fb="" onerror="DP.fb(this)" alt=""></div>';
    /* 话本层那一格不是「另一个关卡」，是**后人编的那一桌**：进了关屏风就写明是话本。
       过了两个时辰才亮（机锋得先有日子可混），一章只去得了一次。 */
    if (DATA.huaben) hubTabs.push({ t: "话本", cls: "t1", ic: "图标/ico-talk.png",
      act: "go", arg: "huaben", off: left === 0 || S.shichen < 2 || !!S.flags.huaben });
    hubTabs.push(
      { t: "来信", cls: "t2", ic: "图标/ico-mail.png", act: "wall", off: !pending().length },
      { t: "食单", cls: "t3", ic: "图标/ico-menu.png", act: "go", arg: "book" },
      { t: "成就", cls: "t1", ic: "图标/ico-chengjiu.png", act: "achv" },
      { t: "行旅", cls: "t4", ic: "图标/ico-travel.png", act: "go", arg: "map" });
    /* 这一排以前九枚（八入口＋静音）竖着排到 798 px，而舞台只有 720 ——
       食单只剩一个图标尖，行旅与静音整块掉到画外。`tabs()` 现在量得出来，装不下就折两列，
       所以这里只管往数组里加格子，不再调间距与起点（那两个数是上一版为了硬塞八枚凑出来的）。 */
    h += tabs(hubTabs, 82, hubTabs.length > 7 ? 98 : 104, hubTabs.length > 7 ? 6 : 8);
    if (left === 0 && S.screen === "hub") h += btn("end", "章末盖章");
    h += renderMailNote() || renderAside();   // 共用同一块匾位：来信优先，插一句顺延
    h += tutCard();
    layer(h);
    tutPlace();          // 高亮框要罩住哪一块，只有画完之后量得出来
  }

  // ── 堂上 ────────────────────────────────────────────
  function newCourt() {
    var d = DATA.court;
    S.court = { def: 0, risk: 0, yin: 0, ren: 0, ti: 0, round: 1, deck: clone(d.cards), hand: [] };
    drawHand();
  }
  function enterCourt() {
    newCourt();
    if (say("courtOpen", "go/court2")) return;
    S.screen = "court"; renderCourt();
  }
  function drawHand() {
    var c = S.court;
    while (c.hand.length < 4 && c.deck.length) c.hand.push(c.deck.shift());
    var it = intent();
    // 意图破不了的牌先排前面，保证 4 张里至少有一张能应上
    var i, tmp;
    for (i = 0; i < c.hand.length; i++) {
      if (base(c.hand[i], it) > 0) { tmp = c.hand[i]; c.hand.splice(i, 1); c.hand.unshift(tmp); break; }
    }
  }
  function intent() { return DATA.court.intentSeq[Math.min(S.court.round - 1, DATA.court.intentSeq.length - 1)]; }
  /* 两种「无视意图按全额结绝」的牌，区别只在代价什么时候到：
       yin:1 空印 —— 印已经盖好了，对方说什么都不重要。代价**延到下一章**。
       ren:N 借印 —— 署的是别人的真名，同样什么案子都盖得住。代价**当场扣人情**。 */
  function isYin(card) { return !!card.yin; }
  function isBorrow(card) { return !!card.ren; }
  function free(card) { return isYin(card) || isBorrow(card); }
  /* 一张牌点不点得动，三章各有各的货币：
       惠州 —— 人情（ren）；儋州 —— 身体（body 是门槛，sh 是这一手耗掉的）。
     角上那个「借不动 / 讲不动」就是这么来的，不是装饰。 */
  function canAfford(card) {
    if (card.ren && S.bars.人情 < card.ren) return false;
    if (card.body && S.bars.身体 < card.body) return false;
    return true;
  }
  function stuckTag(card) {
    if (card.ren && S.bars.人情 < card.ren) return "借不动";
    if (card.body && S.bars.身体 < card.body) return "讲不动";
    return "";
  }
  function base(card, it) {
    if (free(card)) return card.def;
    return card.po === it ? card.def : Math.floor(card.def / 2);
  }
  function yinMode() { return DATA.court.mode === "空印"; }
  function borrowMode() { return DATA.court.mode === "借印"; }
  function teachMode() { return DATA.court.mode === "问字"; }
  function fullMode() { return yinMode() || borrowMode(); }
  /* 空印跨章兑现：定州每攒一状，进惠州就少一份肯替你署名的人情。 */
  function repay() {
    var r = DATA.court && DATA.court.repay;
    S.debt = 0;
    if (!r || !S.kongYin) return;
    S.debt = S.kongYin * r;
    S.bars.人情 = clamp(S.bars.人情 - S.debt, 20, 100);
    S.bars.物议 -= S.kongYin;
    S.log.push("追论定州公使库空印 " + S.kongYin + " 状：人情 " +
      S.debt + " 先没了 —— 台谏的弹章里又多了一页");
  }

  /* ── 共用的"变了才动"层 ──────────────────────────────
     灶前那套（`meterSnap/meterSlide`）解决的是**同一个根因**：`layer()` 整段换 innerHTML，
     节点全是新的，谁也不知道自己是不是刚被换上来 —— 于是发牌没有"发"、数字没有"跳"、
     换句没有"翻页"。堂上／席间／对话三屏再各写一份就会漂，所以收成一个：
     记住上一次每个可动位置的**签名**，签名变了才挂类名。
     不这么做的后果很具体：每次重绘（包括点「规则」再回来）都会重演一遍发牌。 */
  var FXMEM = { tags: {}, line: "", screen: "" };
  function txtOf(e) { return e ? (e.textContent || "").trim() : ""; }
  /* 先摘掉类名、强制回流、再挂回去 —— 不这么做，同一个元素上第二次挂同名类不会重头演。
     只动传进来的那一个类名（`.in` 这种名字在这套 CSS 里已经是布局类，绝不能乱摘）。 */
  function mark(el, cls) {
    if (!el) return;
    var base = (" " + el.className + " ").split(" " + cls + " ").join(" ");
    el.className = base.trim();
    if (el.offsetWidth !== undefined) { void el.offsetWidth; }
    el.className = (base + cls).trim();
  }
  /* 一件事：拿"上一次的样子"跟"这一次画出来的样子"比，只给**变了的东西**挂类名。
     全部从已经画好的 DOM 上现读，不另拼签名 —— 拼了就会和界面漂移。
       ① 木牌某一格换了数 → 闪一下（从面板上拿走一个数而不给反馈，等于玩家再也看不见它）
       ② 手里新出现的牌 → 从牌架里立起来，按位置错开 55ms
       ③ 对话换句 → 话盒淡上来、人从自己那一侧滑进（同一句被重绘不重演）
       ④ 换屏 → 整层淡一下
     第一次进某一屏时 `FXMEM` 是空的，所以什么都不演 —— 那是对的：没有"变化"就没有动画。 */
  function enterFx() {
    /* 一律走 document 级选择器：Node 里那份 DOM 桩**元素上没有 querySelectorAll**
       （`stampFault` 因为宽度为 0 提前返回，一直没撞到，这一段一撞就崩在 harness 里）。 */
    var i, k, v, seen = {};
    /* 一格一个 `.tk` 一个 `.tv`，按下标对齐读 —— 元素级 `querySelector` 桩里也没有 */
    var tags = document.querySelectorAll("#layer .panel .tag");
    var tks = document.querySelectorAll("#layer .panel .tag .tk");
    var tvs = document.querySelectorAll("#layer .panel .tag .tv");
    for (i = 0; i < tags.length && i < tks.length && i < tvs.length; i++) {
      k = txtOf(tks[i]); v = txtOf(tvs[i]);
      if (!k) continue;
      seen[k] = 1;
      if (k in FXMEM.tags && FXMEM.tags[k] !== v) mark(tags[i], "chg");
      FXMEM.tags[k] = v;
    }
    for (k in FXMEM.tags) if (!seen[k]) delete FXMEM.tags[k];

    var cards = document.querySelectorAll("#layer .card"), ids = [];
    for (i = 0; i < cards.length; i++) ids.push(String(cards[i].getAttribute("data-arg")));
    var sig = ids.join("|"), prev = FXMEM.hand || "";
    if (sig !== prev) {
      for (i = 0; i < cards.length; i++) {
        /* 用竖线夹住再比：牌 id 有 `yz` 与 `yz2` 这种包含关系，裸 indexOf 会把旧牌认成新牌 */
        if (("|" + prev + "|").indexOf("|" + ids[i] + "|") >= 0) continue;
        cards[i].className += " deal";
        cards[i].style.animationDelay = (i * 55) + "ms";
      }
      FXMEM.hand = sig;
    }

    var scr = document.getElementById("stage").getAttribute("data-screen") || "";
    var line = scr + ":" + DLG.key + "#" + DLG.i;
    if (scr === "dlg" && line !== FXMEM.line) {
      mark(document.querySelector("#layer .dbox"), "linein");
      mark(document.querySelector("#layer .talker"), "stepin");
    }
    FXMEM.line = line;
    if (FXMEM.screen && scr !== FXMEM.screen) mark(document.getElementById("layer"), "swap");
    FXMEM.screen = scr;
  }
  /* 对席那一张脸。被破的那一拍 `c.foeE` 是 "jing" → 有脸的换惊愕差分，
     没脸的换框里那两个字（"无像"→"无话"）并且整块震一下。
     宁可空着也不借一张不相干的脸 —— 与信墙同一条规矩。 */
  function foeChip(c) {
    var f = (typeof FOE !== "undefined" && FOE[CHAPTER_KEY]) || null;
    if (!f) return "";
    var broke = c.foeE === "jing";
    return '<div class="foe' + (c.foeHit ? " shock" : "") + '">' +
      (f.art ? faceTag(f.art, broke ? "jing" : "")
        : '<div class="noface">' + (broke ? "无话" : "无像") + "</div>") +
      "<span>" + f.nm + "</span></div>";
  }
  function renderCourt() {
    var d = DATA.court, c = S.court;
    set(bg("hall","sc-court2-2.webp"));
    var ym = yinMode(), bm = borrowMode(), tm = teachMode(), it = intent();
    // 四章四种代价 —— 这一枚从面板上挪到牌区上方那行提示里，跟「回合」并排：
    // 木札只有 46 px 宽，「已借 12 点人情」这种长句写不进去，而它恰恰是这一屏要盯的数。
    var cost = ym ? "空印 " + (c.yin || 0) + " 状"
      : bm ? "已借 " + (c.ren || 0) + " 点人情"
        : tm ? "已耗身体 " + (c.ti || 0) + " 分"
          : "风险 " + c.risk + " / " + d.riskMax;
    /* 匾上只留「堂上 · 案名首段」。全名（带【案名拟】【堂上非公堂】那类披露）在案情面板的标题里，
       那里是 420 px 的纸，装得下 —— 匾装不下：定州与惠州那两块素面只有 288／282 px 宽，
       22 个字缩到 11 px 还横出框外 45／54 px（`edge` 闸量出来的，肉眼只看得出"压到金边了"）。 */
    var h = plate("堂上 · " + String(d.caseName).split(" · ")[0], ym
      ? "印在前，字在后。这不是罪 —— 到绍圣元年，它是"
      : bm
        ? "这件事可以办成，只是上面不能写我的名字"
        : tm
          ? "这里不是公堂。琼州别驾一个字也签不动 —— 只剩一间讲堂"
          : "空印不能白拿：这一局不以政绩论，以两造俱服论");
    h += panel({ k: "结绝", v: c.def + "/" + d.need, cls: c.def >= d.need ? "good" : "" });
    h += '<div class="intent court"><div class="in">' + foeChip(c) + modeBadge() + '<b>' + nbUnits(d.intentText[it], "，", 11) + "</b><em>" +
      (ym ? "空印文状无视意图按全额结绝 · 每用一次 +1 空印" :
        bm ? "借来的印无视意图按全额结绝 · 人情当场扣掉，扣光就点不动" :
          tm ? "牌面上「须体」是门槛：身体不够那一课就是讲不动 · 讲不动就去灶前煨芋" :
            "能破此局的牌排最左 · 否则辩护减半") +
      "</em></div></div>";
    h += deckOpen(c.hand.length) + c.hand.map(function (card) {
      var po = free(card) || card.po === it;
      var no = !canAfford(card);
      var band = [["辩护", "+" + base(card, it), po ? "good" : "bad"]];
      if (ym) band.push(["空印", card.yin ? "+1" : "—", card.yin ? "bad" : ""]);
      else if (bm) band.push(["人情", card.ren ? "-" + card.ren : "—", card.ren ? "bad" : ""]);
      else if (tm) {
        band.push(["身体", card.sh ? sign(card.sh) : "—", card.sh < 0 ? "bad" : ""]);
        if (card.body) band.push(["须体", "≥" + card.body, S.bars.身体 < card.body ? "bad" : ""]);
      } else band.push(["风险", sign(card.risk), card.risk > 0 ? "bad" : ""]);
      // 「破不了」挪到卡角：名字条只有 434px 宽，塞下「本任 · 破不了」就被切掉半截
      var cc = { id: card.id, nm: card.nm, tp: card.tp, note: card.note,
        tag: no ? stuckTag(card) : (po ? "" : "破不了"), dead: no };
      return cardFace(cc, d.pose[card.same || card.id] || d.artFb || "pot-4", capBand(band), "");
    }).join("") + "</div>";
    h += '<div class="hint"><b>回合 ' + c.round + " / " + d.rounds + "　·　" + cost + "</b>　" +
      (ym ? "牌面数字已算过：空印牌无视意图全额结绝，代价记在「空印」那一栏" :
        bm ? "牌面数字已算过：借印牌全额结绝但当场扣人情；不借也结得了这一章" :
          tm ? "牌面数字已算过：这一章没有捷径牌，只有身体 —— 深课给得多，也耗得多" :
            "牌面数字已按当前意图算过：绿色=应得上，红色=减半") +
      "</div>";
    h += tabs([{ t: "规则", cls: "t1", ic: "图标/ico-rule.png", act: "rules" },
      { t: "案情", cls: "t2", ic: "图标/ico-case.png", act: "case" }], 116, 104, 8);
    h += btn("pass", ym ? "本回合不结绝" : bm ? "本回合不开口" : tm ? "今日散学" : "本回合不质证");
    layer(h);
  }

  function playCourt(id) {
    var c = S.court, d = DATA.court, it = intent(), card = null, i = -1;
    for (i = 0; i < c.hand.length; i++) if (c.hand[i].id === id) { card = c.hand[i]; break; }
    if (!card) return;
    if (!canAfford(card)) {
      toast(card.body && S.bars.身体 < card.body
        ? "讲不动了：这一课要身体 " + card.body + "，你只剩 " + S.bars.身体 + " —— 去灶前煨一碗芋"
        : "借不动了：这一章愿意替你署名的人已经不多");
      sfx("reject");
      return;
    }
    c.hand.splice(i, 1);
    sfx(card.yin || card.ren ? "seal" : "card");
    var ym = yinMode(), po = free(card) || card.po === it;
    /* 被破的那一拍记一下：对席那张脸要换表情（没脸的换框里那两个字），
       下一拍没破就落回常态 —— 不常驻，不然"崩"就成了默认表情。 */
    c.foeE = po ? "jing" : "ping"; c.foeHit = po;
    c.def += base(card, it);
    if (ym) {
      if (card.yin) { c.yin += 1; S.kongYin += 1; S.bars.物议 += 2; }
      else S.bars.物议 -= 1;
      S.bars.人情 += card.yin ? -1 : 2;
      toast(card.nm + " 结绝 +" + base(card, it) + (card.yin ? "，空印 +1（绍圣元年要还）" : ""));
    } else if (borrowMode()) {
      if (card.ren) {
        c.ren += card.ren; S.flags.borrowed = true;
        S.bars.人情 = clamp(S.bars.人情 - card.ren, 0, 100);
        S.bars.物议 -= 2;
        toast(card.nm + " 结绝 +" + base(card, it) + "，人情 -" + card.ren + "：功劳记在别人名下");
      } else {
        S.bars.物议 += po ? 1 : -1;
        toast((po ? "说动了：" : "没说动：") + card.nm + " 辩护 +" + base(card, it) +
          "，这一状没人替我署名");
      }
    } else if (teachMode()) {
      // 儋州：唯一的货币是他自己。sh 为负＝这一课耗掉的体力，记在「已耗」那一栏。
      var d0 = card.sh || 0;
      c.ti += -d0;
      S.bars.身体 = clamp(S.bars.身体 + d0, 0, 100);
      S.bars.人情 += po ? 1 : 0;
      toast((po ? "他听懂了：" : "他没听懂：") + card.nm + " 讲通 +" + base(card, it) +
        (d0 ? "，身体 " + sign(d0) : ""));
    } else {
      c.risk += card.risk;
      S.bars.人情 += po ? 2 : -1;
      S.bars.物议 += card.risk > 0 ? -1 : 1;
      toast((po ? "应上了：" : "没应上：") + card.nm + " 辩护 +" + base(card, it) + "，风险 " + sign(card.risk));
    }
    c.round++;
    if (c.round > d.rounds) { endCourt(); return; }
    if (!fullMode() && c.risk > d.riskMax) { toast("风险已越线：这一判递不上去"); endCourt(); return; }
    drawHand();
    S.screen = "court"; renderCourt();
  }

  function endCourt() {
    var c = S.court;
    var ok = c.def >= DATA.court.need && (fullMode() || c.risk <= DATA.court.riskMax);
    var k = ok ? (yinMode() ? "courtYin" : borrowMode() ? "courtBorrow" : teachMode() ? "courtTeach" : "courtWin")
               : "courtLose";
    if (!say(k, "finishCourt")) finishCourt();
  }
  function finishCourt() {
    var d = DATA.court, c = S.court;
    var ok = c.def >= d.need && (fullMode() || c.risk <= d.riskMax);
    sfx(ok ? "gavel" : "reject");
    /* 三处结算的加减一律过一道 clamp（审计 P2-7，上轮也提过没修净）：
       黄州 89 起手 → 定州堂上胜 → 席面齐，推演能到 103/100，面板上会显示三位数。
       中途任何一次 serve/reply 会把它拉回 100，但"短暂显示 103"本身就是把上限画崩。 */
    S.bars.人情 = clamp(S.bars.人情 + (ok ? 8 : -6), 0, 100);
    S.bars.物议 = clamp(S.bars.物议 + (ok ? 3 : -4), 0, 100);
    S.shichen++;
    /* 得句的键**由这一章配置**（verseWin／verseLose），不再写死 rain／lone：
       写死的后果是「赢了却没得句」——句进了计数、册子里没有那一行（审计 P1-3）。
       兜底那两句只在没配置时生效，validate_cards 有一条断言要求四章都配齐。 */
    var v = ok ? (d.verseWin || "rain") : (d.verseLose || "lone");
    S.verses[v] = true;
    S.log.push((ok ? "结绝：" : "结绝不了：") + DATA.lines[v].t + "　" + DATA.lines[v].src);
    if (yinMode() && c.yin)
      S.log.push("任上攒下空印 " + c.yin + " 状。元祐八年这不是罪。");
    if (borrowMode())
      S.log.push((ok ? "桥成了，榜上没有一个字是我的。" : "没借到人名，这一件事就办不成。") +
        "　" + d.win.t + "　" + d.win.src);
    if (teachMode())
      S.log.push((ok ? "堂上散学，他抄了一页带走。" : "今日讲不动了，让他自己读十遍。") +
        "已耗身体 " + c.ti + " 分　" + d.win.t);
    S.court = null;
    S.screen = "hub";
    renderHub();
  }

  // ── 灶前 ────────────────────────────────────────────
  /* 玩法与数值全在 灶前.js（window.ZAO）：一口活锅每拍自己往上走，
     案上摆的是实物不是牌 —— 点柴束就添柴，点盐罐就下盐。
     本章那一锅按食单上的菜名对到 ZAO.BOOK，对不上就退回本章头一道（宁可玩错，不可白屏）。
     故事那一头一概照旧：quote / got / 对话 / 时辰 / 人情 / 物议 都不动。 */
  function zaoChap() { return ZAO.chapOf(CHAPTER_KEY); }
  function zaoActs() { return ZAO.actsOf(zaoChap()); }
  function zaoRecipe() {
    var nm = DATA.stove.dish, list = ZAO.dishesOf(zaoChap()), i;
    for (i = 0; i < list.length; i++) if (list[i].nm === nm) return list[i];
    return list[0];
  }
  function zaoTie() { return ZAO.tieOf(zaoRecipe()); }
  function tieMarks() { var t = zaoTie(); return (t && t.marks) || []; }
  function zaoActNm(k) {
    var a = zaoActs().filter(function (x) { return x.k === k; })[0];
    return a ? a.nm : k;
  }
  /* 案上这件被帖挡着时，tip 要说"去帖里圈哪一个字"——
     只说"没学过的菜做不出"，等于把设计者的活儿推给玩家。 */
  function zaoSub(k) {
    var m = tieMarks().filter(function (x) { return x.act === k; })[0];
    return m ? m.sub : "";
  }
  function newStove() {
    S.stove = ZAO.newPot(zaoRecipe()); S.zao = [];
    /* 「圈过就会」（问21①）：帖里圈出来的动词记在**章级** `S.read[k]`，起新锅时灌回这一口锅。
       原来只记在锅级 `p.read`，而 `go/stove` 见 `S.read.done` 为真就跳过读帖屏，灶前屏上又
       没有任何回到读帖的路径 —— 于是黄州/惠州的**第二锅结构性必败**（帖里点名的那味永远锁着，
       甜多酸差的死局，贪心线跑模型不跑引擎、demo 循环不断言成锅，三道闸全部绕开这条缝）。
       教学仍然留在首锅：没圈过的键照旧锁，读帖这一屏不许被架空。 */
    var rk;
    for (rk in S.read) if (rk !== "done" && S.read[rk]) S.stove.read[rk] = true;
    /* 开局先说人话：这一锅要什么、炭会不会自己烧、该不该切。
       进来对着一口锅一排东西不知道干什么，就是"玩法不明"。
       这一屏不再单摆一块食谱匾 —— 该摊开的数读数条上都有，
       剩下的规矩写进笔记，右边那一整条留给案上的实物。 */
    var n = S.stove.r.need;
    /* 开局那两行钉住（zn 是 unshift，后写的压在上面）。
       各维度的区间不写在这儿 —— 读数条每一行都带着"v / 低–高"，再抄一遍只是挤掉后来的话。
       这里只写读数条上看不出来的三件事：主料、改刀、要焖几拍。 */
    S.zao.push({ t: "—— 新起一锅：" + S.stove.r.nm + " ——", c: "taste", pin: 1 });
    S.zao.push({ t: "这一锅" + (n.meat === 1 ? "须下主料" : "不许下主料") +
      (n.cut === 1 ? "，且非改刀不可" : n.cut === 0 ? "，且整颗下锅不许切" : "，切不切是两条路") +
      (n.slow ? "，还要满 " + (p_slow(n, 0)) + " 拍。" : "。") +
      "糊锅不过 " + n.sc[1] + "。炭会自己烧 —— 你不动它，它也动。", c: "", pin: 1 });
    /* 顺序也钉一行。贪心自动机的动作顺序**就是这一屏的可读性定义**：
       先下主料 → 再补静态味道 → 火候留到最后几拍（它每拍自己涨，提前弄等于白弄）。
       不写出来，玩家就得自己发明这套顺序 —— 那正是"莫名其妙"的来源。 */
    S.zao.push({ t: "顺序：先下主料 → 再调咸甜酸油 → 火候与炭留到最后几拍自己走。" +
      "读数条顶上那一行是「下一拍不动它会发生什么」，照着它挑手。", c: "taste", pin: 1 });
  }
  /* 整颗下锅的要比改过刀的多焖两拍 —— 这条与 judge() 同一个算法，别各写一份 */
  /* 视图不另算：公式在模型里那一份（ZAO.slowBeats），这里只是本地名。 */
  function p_slow(n, chops) { return ZAO.slowBeats(n, chops); }
  function zn(t, c, pin) {
    S.zao.unshift({ t: t, c: c || "", pin: !!pin });
    /* 开局那两行钉住：只挤掉后写的。每一下都写两行，不钉住的话
       两拍之后"这一锅要什么"自己就先没了 —— 那正是玩法不明的样子。 */
    if (S.zao.length > 7) {
      for (var i = S.zao.length - 1; i >= 0; i--)
        if (!S.zao[i].pin) { S.zao.splice(i, 1); break; }
    }
  }

  /* 读帖那段要把长句切成「标点段」再交给 flex 去换行。
     原来一整串素文是一个 flex item，浏览器可以在**任意两个汉字之间**断开 ——
     于是「火候足时他自美」被劈成「火候足 ／ 时他自美。」，末行只剩四个字挂一个句号。
     切成段之后，换行只会发生在标点**之后**。
     两条细则：① 标点跟着它前面的字（连续标点一起吃掉），「。」不许自己起一行；
     ② 动词被抽走之后紧跟它的那个句号，要和动词**绑在一起**（`.vbind`），
        否则会出现「…柴头罨 ／ 。待他自熟…」这种以句号开头的行。 */
  var PUNCT = "。！？；，、：";
  /* 中文可以在**任意两个汉字之间**断行，所以「今日 · 元丰四年 · 四十五岁 · 团练副使」
     会被劈成「…四十五 / 岁 · …」，一句诗也会被劈成「好竹连 / 山觉笋香」。
     `text-wrap: balance` 只配平两行的长度，管不住断在哪儿。
     这里把"不许被劈开"的东西包成块：分隔串按分隔符切、每段连着它后面的分隔符一起不换行；
     诗句按「，」切，半句不许从中间断开。
     ⚠ 串里没有那个分隔符就**原样返回** —— 整句散文该留给自己断行，
     硬包成 nowrap 会让长句直接溢出框去。
     ③ `max` 是这一行装得下的字数：任何一段超过它，就**整串不包**。
        `.intent b` 的框只有 238px、19px 字一行 11 字，
        堂上那句意图有 14 字的半句 —— 不兜这一道，它会直接爬出纸外。 */
  function nbUnits(s, sep, max) {
    s = String(s);
    if (s.indexOf(sep) < 0) return s;
    var parts = s.split(sep), i;
    if (max) {
      for (i = 0; i < parts.length; i++)
        if (parts[i].length + sep.length > max) return s;
    }
    var out = [];
    for (i = 0; i < parts.length; i++)
      out.push('<span class="nb">' + parts[i] + (i < parts.length - 1 ? sep : "") + "</span>");
    return out.join("");
  }
  function plainSpans(s) {
    var out = [], buf = "", i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i); buf += ch;
      if (PUNCT.indexOf(ch) >= 0) {
        while (i + 1 < s.length && PUNCT.indexOf(s.charAt(i + 1)) >= 0) { buf += s.charAt(i + 1); i++; }
        out.push(buf); buf = "";
      }
    }
    if (buf) out.push(buf);
    return out.map(function (x) { return '<span class="plain">' + x + "</span>"; }).join("");
  }
  function renderTie() {
    var t = zaoTie(), i, segs = [], rest = t.text, guard = 0;
    zaoBg();
    // 按 marks 在原文里先后切段：圈中的那段变可点的动词，其余是素文
    while (rest.length && guard++ < 40) {
      var hit = -1, at = -1;
      for (i = 0; i < t.marks.length; i++) {
        if (segs.join("").indexOf("|" + t.marks[i].sub + "|") >= 0) continue;
        var k = rest.indexOf(t.marks[i].sub);
        if (k >= 0 && (at < 0 || k < at)) { at = k; hit = i; }
      }
      if (hit < 0) { segs.push(plainSpans(rest)); break; }
      if (at > 0) segs.push(plainSpans(rest.slice(0, at)));
      var m = t.marks[hit];
      var vhtml = '<span class="verb' + (S.stove.read[m.act] ? " got" : "") + '" data-act="mark" data-arg="' +
        m.act + '">' + m.sub + "</span>";
      var j = at + m.sub.length, vt = "";
      while (j < rest.length && PUNCT.indexOf(rest.charAt(j)) >= 0) { vt += rest.charAt(j); j++; }
      segs.push(vt ? '<span class="vbind">' + vhtml + vt + "</span>" : vhtml);
      rest = rest.slice(j);
    }
    var gotN = t.marks.filter(function (x) { return S.stove.read[x.act]; }).length;
    /* 第三个参数＝**不许走匾面分支**：读帖这一屏借的是灶前那张背景，可它自己那张 `.tie`
       帖纸正好摊在那块匾上 —— 标题写在匾里等于写在纸上，惠州那屏量出来底 237、
       浅字对比只剩 2（整条标题直接消失）。与册子／规则／案情／舆图同一条病，同一条药。 */
    var h = plate("灶前 · 读帖 · " + DATA.stove.dish,
      "先把这段帖子读一遍：圈出他写的动作，才知道这一锅该怎么伺候", 1);
    h += panel({ k: "已圈", v: gotN + " / " + t.marks.length, cls: gotN >= t.marks.length ? "good" : "" });
    /* 纸也从数据走（与 `.route` 同一条规矩：CSS 里不钉死素材，一个出口）。
       原来 CSS 里那张 `ui-paper-5-cut.png` 是 302×360 的**竖**纸，被拉进 620×400 的横框，
       变形 1.85 倍 —— 右上角那道折角被拉成一片大 flap。换成 9-30 产的横长素纸（1080×608，1.15 倍）。 */
    h += '<div class="tie" style="background-image:url(&quot;' +
      artSrc(bg("tiepaper", "paper-wide-1.webp")) + '&quot;)"><div class="tiehead">' + t.src + '</div><div class="tietext">' +
      segs.join("") + '</div><div class="tielist">' + t.marks.map(function (x) {
        return '<div class="row' + (S.stove.read[x.act] ? " got" : "") + '"><span>「' + x.sub + "」 → " +
          zaoActNm(x.act) + "</span><i>" + x.note + "</i></div>";
      }).join("") + "</div></div>";
    h += '<div class="hint"><b>读帖不花时辰</b>　圈中的那件实物才上案；没圈满也可以开火，只是那一锅少一手</div>';
    h += tabs([{ t: "规则", cls: "t1", ic: "图标/ico-rule.png", act: "rules" }], 116, 104, 8);
    h += btn("light", gotN >= t.marks.length ? "开火" : "先开火");
    layer(h);
  }
  function markTie(k) {
    var m = tieMarks().filter(function (x) { return x.act === k; })[0];
    if (!m) { toast("那两个字里没有这个动作"); return; }
    if (S.stove.read[k]) { renderTie(); return; }
    sfx("brush");
    ZAO.mark(S.stove, k);              // 圈中即解锁：配额走模型的 cap()，不在这里另记一本
    S.read[k] = true;                  // 同一件事再记在**章级**：新锅灌回去（见 newStove 那段）
    toast("圈中「" + m.sub + "」：" + zaoActNm(k) + " 上案了");
    renderTie();
  }
  function lightStove() { sfx("fire"); S.read.done = true; S.screen = "stove"; renderStove(); }

  /* 背景那口锅与桌上这口撞成"两口锅"，解法是景深不是搬家：
     #bg.deep 虚一级、压暗一层，眼睛把后面那口读成灶房深处那口。
     set() 会把 class 清空（只有对话屏才压暗），所以每次铺完都要补回来。 */
  function zaoBg() {
    set(zaoChap().bg.replace(/^素材\//, ""));
    document.getElementById("bg").className = "deep";
  }

  /* 三量的档数由**这一锅自己的判定**推出来，不另起一套刻度：
     低于下限是文火、落在区间是武火、越过上限是过头；锅内按糊锅计数；时辰按香的剩余。
     切过的菜火候下限降 8，所以传进来的 lo 是**降过之后**那个数 —— 三量跟着判定走，不是装饰。 */
  /* ── 这一锅的方子摊开了没有 ──────────────────────────
     食谱自带的 `known` 是"帖里本来就写了方子"；`S.recipes[id]` 是"我自己一口一口尝定的"。
     两者任一成立，灶前读数条才把区间与好/坏配色画出来。
     ⚠ 这条判据以前**根本没人调用**：`zmeter` 无条件印 `v / 低–高`、`zaoNext` 还把区间写成一句话，
     于是 灶前.js 顶上那句"未解锁的不给数，只有尝味吐出方向性的话"是一句空话（10-01 查出）。
     藏的不只是数字：火候/锅底那两枚三档图是按区间挑档的，配色一露就等于把答案说了。 */
  function knownOf(r) { return !!(r && (r.known || S.recipes[r.id])); }
  /* 藏起来的时候档数照给，只是**不再按区间挑**：按绝对量分档。
     锅有多烫、糊了多少，是看得见的实物，不是方子；玩家本来就该知道。 */
  function fireLvBlind(hf) { return hf < 45 ? 1 : hf < 90 ? 2 : 3; }
  function potLvBlind(sc) { return sc > 2 ? 3 : sc > 0 ? 2 : 1; }
  function fireLv(hf, lo, hi) { return hf < lo ? 1 : hf > hi ? 3 : 2; }
  function potLv(sc, max) { return sc >= max ? 3 : sc > 0 ? 2 : 1; }
  function timeLv(turn, turns) {
    var t = Math.max(1, Math.ceil(turns / 3));
    return turn <= t ? 1 : turn <= 2 * t ? 2 : 3;
  }
  /* 三档九件**写全文件名**，不 `"gauge-fire-" + lv + ".png"` 拼 ——
     本文件 :227 那条注释自己立的规矩：拼出来的路径清点器点不到，缺件要等截图才发现（审计 P3-2）。
     九件现在都在盘上，但规矩破一次就有第二次。 */
  var GAUGE = {
    fire: ["图标/gauge-fire-1.png", "图标/gauge-fire-2.png", "图标/gauge-fire-3.png"],
    pot: ["图标/gauge-pot-1.png", "图标/gauge-pot-2.png", "图标/gauge-pot-3.png"],
    time: ["图标/gauge-time-1.png", "图标/gauge-time-2.png", "图标/gauge-time-3.png"]
  };
  function zgauge(img, label, cls) {
    return '<div class="z-gauge ' + cls + '"><img src="' + artSrc(img) +
      '" alt=""><span>' + label + "</span></div>";
  }
  function zmeter(nm, v, rng, max) {
    var cls = !rng ? "" : (v < rng[0] ? "" : v > rng[1] ? "bad" : "good");
    return '<div class="m"><i>' + nm + '</i><div class="bar"><div class="fill ' + cls +
      '" style="width:' + clamp(v / max * 100, 0, 100) + '%"></div></div><div class="v">' +
      v + " / " + (rng ? rng[0] + "–" + rng[1] : "—") + "</div></div>";
  }
  function zrow(nm, frac, txt, cls) {
    return '<div class="m"><i>' + nm + '</i><div class="bar"><div class="fill ' + (cls || "") +
      '" style="width:' + clamp(frac * 100, 0, 100) + '%"></div></div><div class="v">' + txt + "</div></div>";
  }

  /* 牌面上直接把"这一手会干什么"写出来 —— 只挂在悬停里等于没写：
     悬停不可发现（截图里没有、触屏里没有、第一次玩的人不知道可以悬停）。
     数从模型的 `fx` 现拼，不另写一份文案 —— 改了模型忘了改说明，比没有说明更坏。 */
  var FX_LB = { stoke: "炭", lid: "盖", hf: "火", salt: "咸", sugar: "甜", sour: "酸",
    oil: "油", sc: "糊", tang: "汤", body: "身" };
  function zaoFx(a) {
    if (a.serve) return "起锅";
    if (a.quiet) return "只给方向";
    if (a.board) return "走一拍";
    var s = [], f;
    if (a.fx.meat) s.push("主料");
    if (a.fx.chop) s.push("改刀");
    for (f in a.fx)
      if (FX_LB[f]) s.push((a.fx[f] > 0 ? "+" : "") + a.fx[f] + FX_LB[f]);
    return s.join(" ");
  }
  /* 「下一拍」预告 —— 守锅这一屏原来最难懂的地方：锅每拍自己走，可玩家看不见它要走哪。
     把"什么都不干会发生什么"摆在读数顶上，越过上限那一拍直接说会糊，
     这一条与 tick() 同一条公式（`ZAO.preview`），视图里不另算。 */
  function zaoNext(p) {
    var v = ZAO.preview(p), kn = knownOf(p.r);
    var lo = p.r.need.hf[0] - (p.chops ? 8 : 0), hi = v.ceiling;
    var inRange = v.hf >= lo && v.hf <= hi;
    /* 方子没摊开时，这一行只说"炭还在烧、香还剩几拍"，不说"落在 80–100 里"、
       也不说"越过 100 开始积糊锅" —— 那两句就是把上下限白送给玩家。 */
    var n2 = !kn ? (v.scorch ? "炭还在烧，这一拍之后锅要变了" : "炭还在烧")
      : v.scorch ? "再等一拍就糊：越过 " + hi + " 开始积糊锅"
      : inRange ? "落在 " + lo + "–" + hi + " 里" : "还差 " + (lo - v.hf).toFixed(1) + " 才到 " + lo;
    return '<div class="z-next"><b>下一拍（不动它）</b>' +
      '<span class="n1">火候 ' + p.hf.toFixed(0) + ' → <i>' + v.hf.toFixed(1) +
      '</i>（+' + v.gain.toFixed(1) + '）</span>' +
      '<span class="n2 ' + (kn && v.scorch ? "bad" : kn && inRange ? "good" : "") + '">' +
      n2 + '</span><span class="n3">炭余 ' + v.stoke.toFixed(2) + (v.lid ? " · 盖还压着" : "") +
      ' · 香剩 ' + v.beats + ' 拍</span></div>';
  }
  function renderStove() {
    var p = S.stove, r = p.r, n = r.need, lo = n.hf[0] - (p.chops ? 8 : 0), i, h = "";
    var kn = knownOf(r);                       // 方子摊开了没有：决定读数条与三档图要不要说区间
    /* 重画之前先把旧读数抄下来：`layer()` 是整段换 innerHTML，
       CSS transition 在新节点上不会跑 —— 想让条"滑"过去，只能自己把起点钉回去。 */
    var prev = ZPREV = S.screen === "stove" ? meterSnap() : {};
    zaoBg();
    h += '<div class="z-table"></div>';
    /* 锅是活的 —— 三样一直在动：汽（按火候给强度与条数）、炭（按炭余闪）、
       每下一次料整口锅震一下（`.beat`，一次性）。
       无头截图带 `--force-prefers-reduced-motion`，动画停在起始帧上，
       所以**起始帧必须是"看得见"的那一帧**，不然验收拍出来像什么都没发生。 */
    h += '<div class="z-stove' + (ZBEAT ? " beat" : "") + '"><div class="z-pot">' +
      '<div class="z-steam" style="opacity:' + (p.hf > 40 ? Math.min(1, p.hf / 130 + 0.15).toFixed(2) : 0) +
      '"><i></i><i></i><i></i></div>' +
      '<div class="z-coal" style="opacity:' + (0.25 + p.stoke / 3 * 0.75).toFixed(2) + '"></div>' +
      '<img src="' + artSrc("pot-4") + '" alt=""></div>' +
      zgauge(GAUGE.fire[(kn ? fireLv(p.hf, lo, n.hf[1]) : fireLvBlind(p.hf)) - 1], "火候", "zg1") +
      zgauge(GAUGE.pot[(kn ? potLv(p.sc, n.sc[1]) : potLvBlind(p.sc)) - 1], "锅底", "zg2") +
      zgauge(GAUGE.time[timeLv(p.turn, p.turns) - 1], "一炷香", "zg3") + "</div>";
    /* 读数：火候/糊锅/咸甜酸油是判定项，炭/盖/刀/汤/身体是锅自己的状态 ——
       看不到炭就看不懂"这一拍为什么只涨一点" */
    h += '<div class="z-meters">' + zaoNext(p) +
      /* 没录方的菜：只给当前读数，不给区间、也不给好/坏配色（`zmeter` 拿到 null 就走这条）。
         火候那一行的"要烧到多少"和糊锅那行的"到几就糊"同样是答案的一部分。 */
      zmeter("火", p.hf, kn ? [lo, n.hf[1]] : null, 130) +
      zmeter("糊", p.sc, kn ? n.sc : null, 6) +
      zmeter("咸", p.salt, kn ? n.salt : null, 12) + zmeter("甜", p.sugar, kn ? n.sugar : null, 9) +
      zmeter("酸", p.sour, kn ? n.sour : null, 9) + zmeter("油", p.oil, kn ? n.oil : null, 12) +
      zrow("炭", p.stoke / 3, p.stoke > 0 ? p.stoke.toFixed(2) : "炭尽") +
      zrow("盖", p.lid > 0 ? 1 : 0, p.lid > 0 ? "压着" : "掀开") +
      zrow("刀", p.chops ? 1 : 0, p.chops ? "已切 " + p.chops + " 刀" :
        (n.cut === 1 ? "未改刀 · 须切" : n.cut === 0 ? "未改刀 · 整颗下" : "未改刀"),
        p.chops ? (n.cut === 0 ? "bad" : "good") : (n.cut === 1 ? "bad" : "")) +
      '<div class="m"><i>汤</i><div class="bar"></div><div class="v">' + p.tang +
      " · 主料 " + (p.meat ? "有" : "无") + "</div></div>" +
      zrow("身体", p.body / 100, Math.round(p.body) + (p.body < ZAO.URGE_MIN ? " 撑不住催" : ""),
        p.body < ZAO.URGE_MIN ? "bad" : "good") + "</div>";
    /* 这一屏不再单摆一块食谱匾：该摊开的数读数条上都带着区间，
       规矩写在开局那两行笔记里，帖上那句本来就在匾的副题上。
       右边那一整条留给案上的实物 —— 一屏只讲一件事。 */
    /* 案上一排实物 —— 不是牌，是摆在那儿的东西。配额走模型的 cap()：
       被帖挡着的那件显示「未读帖」而不是「余 0」，玩家要读到的是"还没学会" */
    h += '<div class="z-tray"><div class="z-items">' + zaoActs().map(function (a) {
      var c = ZAO.cap(p, a.k), left = c - p.used[a.k];
      var tied = c === 0 && a.uses > 0 && !a.serve;
      var weak = a.trap && p.body < ZAO.URGE_MIN;
      return '<div class="z-it' + ((left <= 0 || weak) && !a.serve ? " out" : "") +
        (a.serve ? " serve" : "") + (a.trap ? " trap" : "") + (a.board ? " board" : "") +
        '" data-act="play" data-arg="' + a.k + '"><span class="tip">' +
        (tied ? "这一手你还没从帖里读出来 —— 先去把「" + zaoSub(a.k) + "」圈了"
          : weak ? "身子撑不住催火（身体要 ≥ " + ZAO.URGE_MIN + "）"
          : a.board ? "切一刀也要走一拍：入味 ×1.25、火候下限 -8；可有的菜整颗下锅，切了就不是它"
          : (a.say || "尝一口：只给方向，不给数")) +
        '</span><img src="' + artSrc(a.ic) + '" alt=""><div class="nm">' + a.nm +
        '</div><div class="left">' +
        (a.serve ? "" : tied ? "未读帖" : a.board ? (p.chops ? "已切 " + p.chops + " 刀" : "未改刀") : "余 " + left) +
        '</div><div class="fxl">' + zaoFx(a) +
        '</div><div class="chip" style="background:' + (a.col || "#777") + '"></div></div>';
    }).join("") + "</div></div>";
    /* 笔记钉着开局那两行，所以这一屏永远有内容。
       摆哪儿**照这一屏那块匾量出来的位置让位**，不写死 x：四章灶前的匾一张在左墙
       （黄州 x110..310、高 207）、一张在门楣（定州 x219..459、y 只到 175）、
       一张在正中（惠州 x334..569、y152..248）、一张在右上（儋州 x596..876）——
       任何一个固定 x 都会盖住其中一屏。而这块板是近黑的、匾上的字是深褐的，
       叠上去等于两边都看不见（截图里「肉」和那句帖文都糊在黑底上）。
       规则只有一句：与匾面相交就整体挪到匾的右边，挪不下才往匾下面去。 */
    h += '<div class="z-notes" style="' + notesClear() + '">' + S.zao.map(function (x) {
      return '<div class="' + x.c + '">' + x.t + "</div>";
    }).join("") + "</div>";
    h += plate("灶前 · " + r.nm, DATA.stove.quote.t);
    /* 还有没圈的动词就挂一枚「回帖」：漏圈＝这一章永久少一手（配额查章级 S.read[k]），
       不给回头路的话玩家只看得见"这一手用不了"，看不见为什么。 */
    var stvTabs = [{ t: "食单", cls: "t3", ic: "图标/ico-menu.png", act: "go", arg: "book" },
      { t: "规则", cls: "t1", ic: "图标/ico-rule.png", act: "rules" }];
    if (tieMarks().some(function (m) { return !p.read[m.act]; }))
      stvTabs.push({ t: "回帖", cls: "t2", ic: "图标/ico-brush.png", act: "go", arg: "tie" });
    h += tabs(stvTabs, 116, 104, 8);
    h += btn("leave", "弃锅");
    layer(h);
    meterSlide(prev);
    ZBEAT = false;                                 // 震一下只在"真的走了一拍"那一次
  }
  /* ── 读数条要"滑"过去，不是"跳"过去 ──────────────────────
     `layer()` 整段换 innerHTML，新节点上没有"旧值"这个概念，CSS transition 永远不触发 ——
     这就是这一屏"看着没有动画"的根因。所以重画前先把旧宽度抄进 `ZPREV`，
     重画后把起点钉回旧值、强制回流一次，再写回新值：过渡这才有的可跑。
     变化那一行同时挂 up/down，让"哪个数动了"看得见。 */
  var ZPREV = {}, ZBEAT = false;
  function meterRows() { return document.querySelectorAll("#layer .z-meters .m"); }
  function meterSnap() {
    var o = {}, ms = meterRows(), i, f, k;
    for (i = 0; i < ms.length; i++) {
      k = meterName(ms[i]); f = ms[i].querySelector(".fill");
      if (k && f && f.style) o[k] = parseFloat(f.style.width) || 0;
    }
    return o;
  }
  function meterName(m) { var e = m.querySelector("i"); return e ? e.textContent : ""; }
  function meterSlide(prev) {
    var ms = meterRows(), i, f, k, to;
    for (i = 0; i < ms.length; i++) {
      f = ms[i].querySelector(".fill"); k = meterName(ms[i]);
      if (!f || !f.style || !k || !(k in prev)) continue;
      to = parseFloat(f.style.width) || 0;
      if (Math.abs(to - prev[k]) < 0.4) continue;
      f.style.transition = "none"; f.style.width = prev[k] + "%";
      if (f.offsetWidth !== undefined) { void f.offsetWidth; }   // 起点钉死，下一步才谈得上"变化"
      f.style.transition = ""; f.style.width = to + "%";
      f.className = "fill" + (f.className.indexOf("good") >= 0 ? " good"
        : f.className.indexOf("bad") >= 0 ? " bad" : "") + (to > prev[k] ? " up" : " down");
    }
  }

  /* 一次下料 = 一拍，act 内部已经 tick 过了 —— 外面别再补一拍。 */
  function playStove(k) {
    var p = S.stove, res = p && !p.over && ZAO.act(p, k), a = null, i;
    if (!res) return;
    for (i = 0; i < zaoActs().length; i++) if (zaoActs()[i].k === k) a = zaoActs()[i];
    if (!a) return;
    if (res.empty) {
      toast(res.tied ? "「" + a.nm + "」这一手你还没从帖里读出来 —— 先回去重读帖" : a.nm + "用完了");
      sfx("reject"); return;
    }
    if (res.weak) { toast("身子撑不住催火：身体 " + res.body + "，要 ≥ " + res.need + " —— 去煨一锅芋"); sfx("reject"); return; }
    sfx(k === "serve" ? "dish" : (ZAO.SND[k] || "card"));
    ZBEAT = true;                                  // 这一拍真的走了：锅要震一下
    if (res.taste) {
      zn("尝：" + res.taste, "taste");
      /* 这一口同时**攒进录方表**：灶前那一行话刷过去就没了，而尝菜屏要拿它当账。
         攒的是"夹"（四个数），不是流水账 —— 见 灶前.js `notesAdd` 上面那段。 */
      if (res.tvec) S.notes = ZAO.notesAdd(S.notes, S.stove.r.id, res.tvec);
      renderStove();
      /* 末拍尝味必须当场结算：act 里那一 tick 已经把 over 置上了，这里不接 endStove 就是**死锁** ——
         此后每一手都被上面那个 `!p.over` 短路成 false，起锅下料全无效，唯一的出口是「弃锅」。
         贪心验收器踩不到它（hold() 的探针避开终拍），玩家一脚就踏进去。穷举断言在 stove_greedy。 */
      if (res.over) endStove(res.over);
      return;
    }
    if (res.say) zn(a.nm + "：" + res.say);
    /* 把"锅这一拍自己干了什么"写出来 —— 不让玩家看见漂移，漂移就等于没发生 */
    if (!res.over) {
      zn("这一拍锅自己走：火候 +" + p.lastGain.toFixed(1) + " 炭余 " + p.stoke.toFixed(2) +
        (p.lastScorch ? " · 越过火候上限，锅底糊了一层" : ""), p.lastScorch ? "bad" : "");
      /* 糊锅声只在起头那一下响：一路烧还一直刺啦，就成了噪音而不是警告 */
      if (p.lastScorch && p.sc === 1) sfx("scorch");
      renderStove();
      return;
    }
    renderStove();
    endStove(res.over);
  }

  /* ── 活锅的驱动器（审计 P1-1）──────────────────────────
     开局笔记明写「炭会自己烧 —— 你不动它，它也动」，可补这一段之前，全项目只有一个管 toast
     消失的计时器：锅只在你点案上实物的那一下走一拍。守锅没有主体，「催」那颗陷阱失去了
     时间压力这个存在理由，那句话就是谎言 —— 而验收器替引擎圆了谎（贪心与 harness 都用 act
     内部那一拍驱动，恰好绕开"没有定时器"这个事实）。
     节奏 1.8s：一锅 8 拍 ≈ 14 秒犹豫余地 —— 再快就成反应测试，不是守锅。
     停三条：不在灶前这一屏 / 锅已结算 / 页面切到后台（切走还在烧＝偷锅）。
     验收跑法（带哈希）默认**不放行**：无头 Chrome 的虚拟时间会在一次截图里把 8 拍全烧完，
     拍到的永远是"锅已糊"那一格而不是玩家进门那一格。要验它自己会走，走 `#章/stove/live`。 */
  var POT_MS = 1800, POT_TIMER = null, LIVE_POT = false;
  function potBeat() {
    var p = S.stove;
    if (!p || p.over || S.screen !== "stove") { potHalt(); return; }
    if (typeof document !== "undefined" && document.hidden) return;
    var o = ZAO.tick(p);
    ZBEAT = true;                                    // 自己走的一拍也要震那一下
    zn("锅自己走：火候 +" + p.lastGain.toFixed(1) + " 炭余 " + p.stoke.toFixed(2) +
      (p.lastScorch ? " · 越过火候上限，锅底糊了一层" : ""), p.lastScorch ? "bad" : "");
    if (p.lastScorch && p.sc === 1) sfx("scorch");   // 糊锅声只在起头那一下
    if (o) { renderStove(); endStove(o); return; }
    renderStove();
  }
  function potGo() {
    if (POT_TIMER || !(LIVE_POT || !NO_SAVE)) return;
    if (!S.stove || S.stove.over || S.screen !== "stove") return;
    POT_TIMER = setInterval(potBeat, POT_MS);
  }
  function potHalt() { if (POT_TIMER) { clearInterval(POT_TIMER); POT_TIMER = null; } }

  /* 结算不写"失败"两个字：每一锅都对应《猪肉颂》里的一句，并且都有一个去处。
     做烂了不是判负，是又 got 到一句诗 —— 但故事这一头照旧走原来那条链。 */
  function endStove(o) {
    var ok = !!(o && o.ok);
    S.stoveOk = ok;
    S.stoveEnd = o || null;
    sfx(ok ? "seal" : "reject");
    if (say(ok ? "dishOk" : "dishFail", "finishStove")) return;
    finishStove();
  }
  function finishStove() {
    var d = DATA.stove, p = S.stove, ok = !!S.stoveOk, e = S.stoveEnd && S.stoveEnd.end;
    if (ok) {
      S.got[d.got] = true;
      S.bars.人情 = clamp(S.bars.人情 + 5, 0, 100);      // 同上：三处结算都要过 clamp
      S.bars.物议 = clamp(S.bars.物议 + 2, 0, 100);
      S.flags.cook = true;
      /* 做成那一锅也得句（黄州配的是《猪肉颂》那两句）——
         那一行原来在册上挂着「待触发」却没有一条路能拿到它（审计 P2-16／问22）。 */
      if (d.verse && DATA.lines[d.verse]) {
        S.verses[d.verse] = true;
        S.log.push("火候足了：" + DATA.lines[d.verse].t + "　" + DATA.lines[d.verse].src);
      }
      /* 署名突变：「东坡居士」这个号来自马正卿请得的那块坡地，但玩家看见它换上，
         是在他**第一次亲手做成那一锅**之后 —— 躬耕之处有了名字，先落在饭上。
         单向、不回退、全场不解释：名牌自己变了就是全部交代。
         它不放在 S.flags 里，因为 flags 换章要清，而号不会跟着换章掉。 */
      S.dongpoName = true;
    }
    /* 身体：这一锅站掉/补回来多少，就往外带多少（煨芋是唯一回身体的东西）。
       废了一锅再另扣 3 —— 那是"白站一炷香"的代价，不是模型里的数。 */
    var dp = p ? p.body - 100 : 0;
    S.bars.身体 = clamp(S.bars.身体 + dp - (ok ? 0 : 3), 0, 100);
    S.log.push((ok ? "成菜：" : "废了一锅：") +
      (e ? "「" + e.q + "」" + e.to : ok ? d.quote.t : DATA.lines.cold.t) +
      "　" + (ok ? d.quote.src : ""));
    S.shichen++;
    S.stove = null; S.stoveEnd = null; S.screen = "hub";
    renderHub();
  }

  // ── 上街 ────────────────────────────────────────────
  function newStreet() { S.street = { spent: 0, bought: {} }; }

  /* 摊幌子：上街八张空白招幌按**摊子卖什么**发下去，不按摊序轮转 ——
     轮转会让肉摊挂着书幌，玩家照着幌子找靶子就找错了。
     认不出来就不挂（宁缺毋滥），也不许为了一张贴图去改牌名。 */
  var STALL_IC = [["肉", "meat"], ["骨", "meat"], ["皮", "meat"], ["粥", "porridge"],
    ["酒", "wine"], ["醪", "wine"], ["蜜", "fruit"], ["果", "fruit"], ["柑", "fruit"],
    ["荔", "fruit"], ["橘", "fruit"], ["梅", "fruit"], ["栗", "cake"], ["饼", "cake"],
    ["米", "cake"], ["糯", "cake"], ["芋", "cake"], ["书", "book"], ["册", "book"], ["药", "herb"],
    ["芷", "herb"], ["参", "herb"], ["沉香", "herb"], ["槟榔", "herb"],
    ["鱼", "fish"], ["蚝", "fish"], ["蟹", "fish"], ["椰", "fruit"]];
  function stallIc(nm) {
    var i;
    for (i = 0; i < STALL_IC.length; i++)
      if (nm.indexOf(STALL_IC[i][0]) >= 0) return "图标/stall-" + STALL_IC[i][1] + ".png";
    return "";
  }

  function renderStreet() {
    var d = DATA.street, s = S.street;
    set(bg("street","streetbg2-2.webp"));
    var left = d.budget - s.spent;
    var h = plate("上街 · " + DATA.chapter.name, d.quote.t + "　" + d.quote.src);
    h += panel({ k: "余钱", v: left + " / " + d.budget, cls: left < 30 ? "bad" : "" });
    h += '<div class="intent street"><div class="in"><b>要办' + d.need.length + '味：' + nbUnits(d.need.join("、"), "、", 11) + "</b>" +
      "<em>红角「传说」的是后人追认的假东坡菜 —— 买了不入册 · 已办 " +
      Object.keys(s.bought).length + " / " + d.stalls.length + " 摊 · 余 " + left + " 文</em></div></div>";
    h += deckOpen(d.stalls.length) + d.stalls.map(function (st, i) {
      var dead = !!s.bought[st.nm];
      /* `tp` 原来抄的是 `st.tag` —— 可同一个 tag 已经在牌角落了红牌 `.tagc`，一行里写两遍，白吃掉 10~15px（10-09 实测：定州 15／惠州 10／儋州 2）。改成「买」之后定州还差 6px（「东坡吊炉烧饼」）—— 而这一栏在这一屏本来就不载信息：这一屏就是市场，点牌就是买，真假与出处挂在角标和小字里，所以干脆留空。牌名不许改短的那几张「东坡X」是自动机的靶子（改了就没有贪心解），所以动的是这一栏。 */
      var cc = { id: "s" + i, nm: st.nm, tp: "", note: st.note, dead: dead,
        tag: st.tag, stall: stallIc(st.nm) };
      var band = [["银钱", "-" + st.price, "bad"]];
      if (st.rq) band.push(["人情", sign(st.rq), st.rq > 0 ? "good" : "bad"]);
      if (st.wy) band.push(["物议", sign(st.wy), st.wy > 0 ? "good" : "bad"]);
      if (st.sh) band.push(["身体", sign(st.sh), st.sh > 0 ? "good" : "bad"]);
      return cardFace(cc, st.art, capBand(band), dead ? "已买" : "");
    }).join("") + "</div>";
    h += tabs([{ t: "食单", cls: "t3", ic: "图标/ico-menu.png", act: "go", arg: "book" },
      { t: "清欢册", cls: "t2", ic: "图标/ico-qinghuan.png", act: "go", arg: "verses" }], 116, 104, 8);
    h += btn("leave2", "回衙");
    layer(h);
  }

  /* 入册只认食单上有的名目。册外的东西一旦计进 `S.got`，「已入册 N / M」的分子就会涨过 M、
     `dish` 成就的阈值跟着被动放水（审计 P1-4）。
     `book` 字段是给**名目对不上**用的：摊上写「羊脊骨」，册上记「烤羊脊骨」，
     是同一种东西，不该为它在册子上多立一行。 */
  function bookKey(x) { return x.book || x.nm; }
  function inBook(nm) { return DATA.book.dishes.indexOf(nm) >= 0; }

  function buy(i) {
    var d = DATA.street, s = S.street, st = d.stalls[i];
    if (!st || s.bought[st.nm]) return;
    if (s.spent + st.price > d.budget) { toast("超了：今日只用" + d.budget + "钱"); return; }
    s.spent += st.price; s.bought[st.nm] = true;
    var fake = st.tag === "传说", bk = bookKey(st);
    sfx("coin");
    if (!fake && inBook(bk)) S.got[bk] = true;
    S.bars.银钱 -= st.price;
    S.bars.人情 = clamp(S.bars.人情 + st.rq, 0, 100);
    S.bars.物议 += st.wy;
    S.bars.身体 = clamp(S.bars.身体 + st.sh, 0, 100);
    toast(fake ? "买下了：" + st.nm + " —— 宋人书里没有这一味，不入册"
      : (!inBook(bk) ? "买下了：" + st.nm + " —— 食单上没这一行，只记一件事不记一味"
        : "买下了：" + st.nm + " 付 " + st.price + " 文"));
    renderStreet();
  }

  function leaveStreet() {
    var d = DATA.street, s = S.street, miss = 0, i;
    for (i = 0; i < d.need.length; i++) if (!s.bought[d.need[i]]) miss++;
    S.streetMiss = miss;
    if (say(miss ? "streetMiss" : "streetOk", "finishStreet")) return;
    finishStreet();
  }
  function finishStreet() {
    var d = DATA.street, miss = S.streetMiss || 0, vk;
    if (miss === 0) {
      S.bars.人情 = clamp(S.bars.人情 + 6, 0, 100);      // 三处结算的第三处，同上
      vk = d.verseFull || "bone";
      S.log.push("席面齐了：" + DATA.lines[vk].t + "　" + DATA.lines[vk].src);
      S.verses[vk] = true;
    } else {
      vk = d.verseMiss || "lone";
      S.log.push("席面缺 " + miss + " 味：" + DATA.lines[vk].t + "　" + DATA.lines[vk].src);
      S.verses[vk] = true;
    }
    S.shichen++;
    S.street = null; S.screen = "hub";
    renderHub();
  }

  // ── 席间：菜就是话 ──────────────────────────────────
  /* 同一套引擎摆两种桌子：正史的「席间」与话本层的「机锋」（审计决定表 ⑬）。
     两者只在**取哪张表**上不同 —— 发牌、命中、换靶重排、当场反应、散席结算全一样。
     换实现就会长出第二套会漂的规则，所以这里只换一个取表的口。 */
  function bnData() { return S.banquet && S.banquet.table === "话本" ? DATA.huaben : DATA.banquet; }
  function newBanquet(table) {
    var b = table === "话本" ? DATA.huaben : DATA.banquet, joy = {}, i;
    for (i = 0; i < b.guests.length; i++) joy[b.guests[i].id] = 0;
    S.banquet = { round: 1, joy: joy, used: {}, target: b.guests[0].id, hand: [], table: table || "席间" };
    S.banquet.hand = drawBanquet();
  }
  function drawBanquet() {
    var b = bnData(), pool = [], i, s = S.banquet;
    for (i = 0; i < b.dishes.length; i++) if ((s.used[i] || 0) < b.dishes[i].uses) pool.push(i);
    // 发四道：先滤掉已经上完的，再按「能不能命中当前客人」排，
    // 否则牌区里全是死牌，玩家没有靶子可打。
    pool.sort(function (x, y) { return hit(y) - hit(x); });
    return pool.slice(0, 4);
  }
  function hit(i) {
    var b = bnData(), d = b.dishes[i], g = guest(S.banquet ? S.banquet.target : b.guests[0].id);
    return d[b.dimKey[g.want]];
  }
  /* 角标四档：§6 铁律里「菜牌实时打 ✓/○/△/✗」那一条。
     分档不许自己另起一套 —— 每一档都对得上游戏真会做的事：
     ✓ 会喝彩（sfx cheer）、△ 以上点头、✗ 会冷场（sfx cold）。
     数字照旧印在牌上，这一档只是让人一眼扫到该拍哪张，不替换数字。 */
  function gradeOf(v) {
    return v >= 4 ? ["✓", "gd4"] : v >= 3 ? ["○", "gd3"] : v >= 2 ? ["△", "gd2"] : ["✗", "gd1"];
  }
  function guest(id) {
    var b = bnData(), i;
    for (i = 0; i < b.guests.length; i++) if (b.guests[i].id === id) return b.guests[i];
    return b.guests[0];
  }

  function renderBanquet() {
    var b = bnData(), s = S.banquet, i;
    set(b.bg || bg("banquet","sc-banquet2-1.webp"));
    var minJoy = 99;
    for (i = 0; i < b.guests.length; i++) minJoy = Math.min(minJoy, s.joy[b.guests[i].id]);
    // 席间只在匾里写「在哪一桌」：这屏三位在座，头顶以上没有第二块干净的墙面，
    // 副题一长就压到客人脸上（用户定的规矩：两张脸不许被话盒盖住）。
    // 被伺候那位的原话与「点人换靶」的提示改走牌区下方那行 hint，巡数也挂在那儿。
    var h = plate((b.layer === "话本" ? "话本 · " : "席间 · ") + b.place, "");
    h += panel({ k: "最欢", v: minJoy + " / " + b.need, cls: minJoy >= b.need ? "good" : "" });
    // 三位在座都在画面里，只切名牌与压暗态（席间不是对话那一套「只出现开口的人」）
    h += '<div class="seated">';
    for (i = 0; i < b.guests.length; i++) {
      var g = b.guests[i], on = s.target === g.id;
      h += '<div class="seat' + (on ? " on" : "") + '" data-act="pick" data-arg="' + g.id + '">' +
        faceTag(g.art) +
        '<div class="who"><div class="in3"><span class="nm2">' + g.nm + '</span><span class="want">欢 ' +
        s.joy[g.id] + "/" + b.need + " · 要听 " + g.want + "</span></div></div>" +
        "</div>";
    }
    h += "</div>";
    h += '<div class="hint" style="bottom:16px;left:150px;right:430px;text-align:left"><b>' + guest(s.target).say + "</b>　" +
      "第 " + s.round + " / " + b.rounds + " 巡 · " +
      (b.guests.length > 1 ? "点人换靶，绿色＝正对他要听的那一维" : "绿色＝正对他要听的那一维") + "</div>";
    h += deckOpen(s.hand.length, 60) + s.hand.map(function (di) {
      var d = b.dishes[di], left = d.uses - (s.used[di] || 0);
      var dead = left <= 0;
      var cc = { id: "d" + di, nm: d.nm, tp: d.tp || "上", note: "余 " + left + " 次", dead: dead };
      // 维名与字段都从表里读：正史那一桌是味·典·趣·情，话本这一桌是禅·谑·锋。
      // 写死四维的话，话本层的牌面上会凭空多出一栏「味 0」。
      var dims = b.dims || [["味", "wei"], ["典", "dian"], ["趣", "qu"], ["情", "qing"]];
      var band = dims.map(function (x) { return [x[0], d[x[1]], g2(d, x[0])]; });
      return cardFace(cc, d.art, band, "欢+" + (dead ? 0 : hit(di)),
        dead ? null : gradeOf(hit(di)));
    }).join("") + "</div>";

    h += tabs([{ t: "食单", cls: "t3", ic: "图标/ico-menu.png", act: "go", arg: "book" },
      { t: "规则", cls: "t1", ic: "图标/ico-rule.png", act: "rules" }], 116, 104, 8);
    h += btn("disperse", "散席");
    layer(h);
  }
  function g2(d, k) { return d[bnData().dimKey[k]] >= 3 ? "good" : ""; }

  function pickGuest(id) {
    S.banquet.target = id;
    /* 换靶之后必须按**新靶**重排现有手牌：发牌排的是上一个客人（drawBanquet），
       不换序就出现「角标明明看得见最优那张，但它不在手牌第一位、玩家第一口注定非最优」。
       只重排，不重抽、不动 uses —— 换个伺候的人不该等于白摸一手。 */
    S.banquet.hand.sort(function (x, y) { return hit(y) - hit(x); });
    renderBanquet();
  }

  function serve(di) {
    var b = bnData(), s = S.banquet, d = b.dishes[di];
    if ((s.used[di] || 0) >= d.uses) { toast("这一道已经上过了"); return; }
    s.used[di] = (s.used[di] || 0) + 1;
    var v = hit(di), g = guest(s.target);
    // 席上吃过的菜也入食单 —— 不然「春笋」这类只在席间出现的味永远空着。
    // 不在食单里的（定州那方雪浪石）不记；话本层那一桌摆的是话头不是菜，一概不入册。
    if (b.layer !== "话本" && inBook(bookKey(d))) S.got[bookKey(d)] = true;
    s.joy[g.id] += v;
    S.bars.人情 = clamp(S.bars.人情 + v, 0, 100);
    S.bars.物议 += v >= 3 ? 1 : 0;
    sfx("dish");
    if (v >= 4) sfx("cheer"); else if (v <= 1) sfx("cold");
    toast(g.nm + " " + (v >= 3 ? "尽欢" : v >= 1 ? "点头" : "没说话") + "：欢+" + v);
    s.round++;
    if (s.round > b.rounds) { endBanquet(); return; }
    s.hand = drawBanquet();
    // 尽欢与冷场都要当场看见：这是「菜＝话」唯一能被读回来的地方
    if (v >= 4 && sayOne(withArt(g, g.hit), "go/banquet2")) return;
    if (v <= 1 && sayOne(withArt(g, g.miss), "go/banquet2")) return;
    renderBanquet();
  }

  function endBanquet() {
    var b = bnData(), ok = true, i;
    for (i = 0; i < b.guests.length; i++) if (S.banquet.joy[b.guests[i].id] < b.need) ok = false;
    S.banquetOk = ok;
    // 话本层有自己那两句过场白（正史的入席白不能拿去接机锋）
    if (say(ok ? (b.dlgOk || "banquetOk") : (b.dlgFail || "banquetFail"), "finishBanquet")) return;
    finishBanquet();
  }
  function finishBanquet() {
    var b = bnData(), ok = !!S.banquetOk, vk = b.verseK || "rain", L = DATA.lines[vk];
    var hb = b.layer === "话本";
    /* 键必须来自**本章的册子**：原先写死 rain，而定州·儋州的 book.verses 里没有 rain ——
       它照样计入「已入册 N/M」与终局分，册子上却找不到那一行（审计 P1-3 的幽灵句）。
       日志印的句子也一并换成册子里那一条，同一件事不留两个说法。
       话本那一关不扣情面、不进 `banquet` 那枚成就：机锋是编的，席是真的。 */
    if (ok) { S.verses[vk] = true; S.bars.物议 += hb ? 1 : 3;
      S.flags[hb ? "huaben" : "banquet"] = true;
      S.log.push((hb ? "机锋接上了：" : "三人尽欢：") + L.t + "　" + L.src); }
    else S.log.push((hb ? "他笑而不答，只吃茶。" : "有一人没被照顾好：") + DATA.lines.lone.t + "　" + DATA.lines.lone.src);
    S.shichen++;
    S.banquet = null; S.screen = "hub";
    renderHub();
  }

  // ── 信：收信与回信 ──────────────────────────────────
  /* 分支：一封信可以写 `after:{id,k}` —— **上一封回了哪一句，这一封才寄得到你手上**。
     `k` 可以给一个数组（「旷」与「逃」都算"还笑得出来"）。
     条件没满足的信在信墙上**根本不出现**：没走的那条路，玩家不该知道有这条路。
     所以门槛落在"收得到吗"这一层（pending／信墙／计数三处同一个函数），
     不是落在画墙上 —— 画墙那一层各挑各的，三处迟早会漂。 */
  function mailOpen(L) {
    var a = L.after; if (!a) return true;
    var got = S.replied[a.id]; if (!got) return false;
    var ks = a.k instanceof Array ? a.k : [a.k];
    return ks.indexOf(got) >= 0;
  }
  /* 「已回 n / m」的分母只数**这一局走得到的信**：
     用 DATA.letters.length 的话，两条分支永远有一条收不到，玩家会以为漏了一封。 */
  function mailTot() {
    var ls = DATA.letters || [], i, n = 0;
    for (i = 0; i < ls.length; i++) if (mailOpen(ls[i]) || S.replied[ls[i].id]) n++;
    return n;
  }
  function pending() {
    var out = [], i;
    for (i = 0; i < DATA.letters.length; i++)
      if (mailOpen(DATA.letters[i]) && DATA.letters[i].when <= S.shichen && !S.replied[DATA.letters[i].id])
        out.push(DATA.letters[i]);
    return out;
  }
  function letterById(id) {
    var i;
    for (i = 0; i < DATA.letters.length; i++) if (DATA.letters[i].id === id) return DATA.letters[i];
    return null;
  }

  /* 这一处原来是全游戏最脏的一个洞：开场白写成 `say("mailOpen","go/mail")`，
     而 `go` 的分支表里根本没有 mail —— 落进 else 弹回 hub。
     于是真人玩家点来信＝播一遍白 → 回 hub → 再点 → 再播一遍，死循环；
     信屏、回信、`letter` 成就在真人路径下永远到不了，章末还照「四封没回」扣人情。
     demo／验收全走 nodlg，所以一百多屏截图全绿也没人看见（P0-1）。
     现在：开场白每章只播一次，续段走**真存在的** go/mail，并且一进来就把这封记成看到过。 */
  function renderMail(id) {
    var ps = pending(), i, L = id ? letterById(id) : null;
    if (!ps.length && !L) { toast("今日没有待回的信"); return; }
    if (!L) {
      for (i = 0; i < ps.length; i++) if (!S.mailSeen[ps[i].id]) { L = ps[i]; break; }
      L = L || ps[0];
    }
    S.mailSeen[L.id] = 1;
    S.mailTo = L.id;                        // 播完开场白要看的是**这一封**，不是「下一封」
    S.lpage = 0; S.lpicking = false;         // 翻页与"挑一句"是这一屏的临时态，换一封要清
    if (!S.mailAsked) {
      S.mailAsked = true;
      if (say("mailOpen", "go/mail")) return;
    }
    S.screen = "letter";
    renderLetter(L.id);
  }

  /* ── 信墙：一章的信一次摊开 ────────────────────────────
     原来 hub 上那枚「来信」点下去直接进**第一封**，玩家看不见这一章一共几封、谁寄的、
     哪封还没回 —— 「待回 4 封」这个数一直挂在提示牌上，却没有构成。
     左边一列是人（有立绘的挂脸，没有的只挂竖幅名牌，**不拿别人的脸凑**），
     右边是纸：未回的亮着、已回的压暗盖戳、时辰没到的整张压成灰且不出字 ——
     还没寄到的信，不该看得见上面写了什么。 */
  function renderWall() {
    var ls = DATA.letters || [], i, l, st;
    S.screen = "wall";
    set(bg("letter", DATA.chapter.hub || "hubbg2-1.webp"));
    document.getElementById("bg").className = "dimmed";
    var people = [], seen = {};
    for (i = 0; i < ls.length; i++)
      if ((mailOpen(ls[i]) || S.replied[ls[i].id]) && !seen[ls[i].from]) { seen[ls[i].from] = 1; people.push(ls[i]); }
    var paper = LETTER_PAPER[CHAPTER_KEY] || "paper-hz-4.webp";
    var h = '<div class="wallrail">';
    h += '<div class="wper all' + (S.wallBy ? "" : " on") + '" data-act="wallby" data-arg="">' +
      '<div class="pn">全部</div></div>';
    for (i = 0; i < people.length; i++) {
      var face = letterFace(people[i]);
      h += '<div class="wper' + (S.wallBy === people[i].from ? " on" : "") +
        '" data-act="wallby" data-arg="' + people[i].from + '">' +
        (face ? '<img class="pf" src="' + artSrc("立绘/" + face + "-平.png") + '" alt="">' :
                '<div class="pf none"></div>') +
        '<div class="pn">' + people[i].from + "</div></div>";
    }
    h += "</div><div class=\"wallgrid\">";
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      if (!mailOpen(l) && !S.replied[l.id]) continue;     // 这一局收不到的那一条分支，不挂出来
      if (S.wallBy && l.from !== S.wallBy) continue;
      st = S.replied[l.id] ? "done" : (l.when > S.shichen ? "lock" : "new");
      h += '<div class="wcard ' + st + (l.layer === "传说" ? " hb" : "") + '"' + (st === "lock" ? "" :
        ' data-act="openmail" data-arg="' + l.id + '"') +
        ' style="background-image:url(&quot;' + artSrc(l.layer === "传说" ? "huaben-1.webp" : paper) +
        '&quot;)"><div class="wtext">' + (st === "lock" ? "" : l.body) + "</div>" +
        '<div class="wfoot"><span class="wwho">' + l.from + "</span>" +
        (st === "done" ? '<span class="wstamp">已回</span>'
          : st === "new" ? '<span class="wtag">待回</span>' : '<span class="wlock">未到</span>') +
        "</div></div>";
    }
    h += "</div>";
    h += panel({ k: "已回", v: Object.keys(S.replied).length + " / " + mailTot() });
    h += tabs([{ t: "归案", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
  }

  /* 各章一张自己的信纸（`素材/paper-<章>-N.webp`，540×720＝3:4，与纸框同比例所以不拉伸）。
     选哪一张是有理由的：黄州 4 最素、定州 1 冷白合那年冬天的雪、
     惠州 1 角上那块渍最小、儋州 2 竹帘纹与折痕最少 —— 四张都看过联络表才定的。 */
  var LETTER_PAPER = { huangzhou: "paper-hz-4.webp", dingzhou: "paper-dz-1.webp",
    huizhou: "paper-hiz-1.webp", danzhou: "paper-dan-2.webp" };
  function replyOf(L, k) {
    var a = L.replies || [], i;
    for (i = 0; i < a.length; i++) if (a[i].k === k) return a[i];
    return null;
  }
  /* 回一封信要付的账，**只算这一份**：候选卡片上印的那三个数，就是 `reply()` 真会改的那三个数。
     旧的那张竖行候选印的是「气+3」，而 3 是人情的权重、不是气质的增量（气质每次只 +1）——
     两处各写一遍，写的还写错了，这正是"代价写在脸上"最容易被糊弄过去的地方。 */
  function replyCost(L, r) {
    var v = (L.tone || {})[r.k] || 1;
    return { v: v, ren: v * 2, yi: r.k === "灰" ? -1 : r.k === "壮" ? 1 : 0, tone: r.k };
  }
  /* 候选这一层：纸是**他的信**，候选是我替他拿的主意，两件事不该挤在同一张纸上。
     以前三个候选就是三竖行，长在正文左边（用户点的名："回的信不应该直接写在左边"），
     现在另起一层摆在纸右边，每一枚把自己要付的账与出处都印在自己脸上。 */
  function replyStack(L) {
    var d = DATA.letterDims, out = [], i, x, c;
    for (i = 0; i < (L.replies || []).length; i++) {
      x = L.replies[i]; c = replyCost(L, x);
      out.push('<div class="ropt" data-act="reply" data-arg="' + L.id + ":" + i + '">' +
        "<b>" + x.t + "</b>" +
        '<i class="rc">' + d.key + " +1 ｜ 人情 +" + c.ren +
        (c.yi ? " ｜ 物议 " + (c.yi > 0 ? "+" + c.yi : "−" + (-c.yi)) : "") + "</i>" +
        "<em>" + x.src + "</em></div>");
    }
    /* 层头那一行直接用数据里的 `letterDims.title` —— 它本来就是"回哪一句都算回过，
       只是这一章的气质跟着变"这句说明，再补一句同话就成了复读（第一版正犯了这一条）。 */
    return '<div class="rstack"><h3>' + d.title + "</h3>" + out.join("") + "</div>";
  }

  /* ── 一封信：竖排、自右而左、分页是量出来的 ──────────────
     三种状态：读信 → 挑一句（三个候选各占一竖行，写在同一张纸上）→ 已回（落款那一行
     接在正文后面，纸上盖一枚「已回信」）。
     这一屏**不挂匾**：它借的是本章堂前那张图，而那张在 BOARDS 里有匾面，
     挂上去就是两行浅灰的字骑在信纸正文上（9-28 那轮就是这么露馅的）。 */
  function renderLetter(id) {
    var L = letterById(id); if (!L) { S.screen = "hub"; renderHub(); return; }
    // 话本层整屏换成绣像（只有墨色与纸色），一眼就知道是后人编的
    var tale = L.layer === "传说";
    set(tale ? "huaben-1.webp" : bg("letter", DATA.chapter.hub || "hubbg2-1.webp"));
    var picked = S.replied[L.id];
    var paper = tale ? "huaben-1.webp" : (LETTER_PAPER[CHAPTER_KEY] || "paper-hz-4.webp");
    var r = picked ? replyOf(L, picked) : null;
    var h = '<div class="desk"></div>';
    h += '<div class="sheet' + (tale ? " huaben" : "") + '" style="background-image:url(&quot;' +
      artSrc(paper) + '&quot;)"><div class="sframe"></div>';
    h += '<div class="scut"><div class="stext">' +
      '<div class="shd">' + L.from + '<span class="ssub">　' + L.who + " · " + L.layer + "</span></div>" +
      '<div class="sbd">' + L.body + "</div>" +
      '<div class="ssrc">' + L.src + "</div>" +
      '<div class="sask">' + L.ask + "</div>" +
      (r ? '<div class="srep"><i>回</i> ' + r.t + "　" + r.src + "</div>" : "") +
      "</div></div>";
    if (picked) h += '<div class="stamped">已回信</div>';
    h += '<div class="spg pv" data-act="lpage" data-arg="-1">← 上一页</div>' +
      '<div class="spg nx" data-act="lpage" data-arg="1">下一页 →</div>';
    h += "</div>";
    /* 候选另起一层，在纸的右边（见 `replyStack` 上面那段）：它不进 `.stext`，
       所以竖排的信纸从头到尾只有**他写来的那些字**，没有我的选项混在里面。 */
    if (!picked && S.lpicking) h += replyStack(L);
    h += panel({ k: "已回", v: Object.keys(S.replied).length + " / " + mailTot() });
    h += '<div class="intent letter"><div class="in"><b>来信 · ' + L.from + "</b><em>" +
      "回不回都要回：不回的话，人情是要掉的<br>待回 " + pending().length + " 封</em></div></div>";
    h += '<div class="lbtns">' +
      (!picked && !S.lpicking ? '<div class="btn" data-act="pickmail" data-arg="' + L.id +
        '"><div class="in">回信</div></div>' : "") +
      (S.lpicking && !picked ? '<div class="btn" data-act="unpickmail"><div class="in">再斟酌一下</div></div>' : "") +
      (picked && pending().length ? '<div class="btn" data-act="nextmail"><div class="in">下一封</div></div>' : "") +
      '<div class="btn" data-act="wall"><div class="in">信墙</div></div>' +
      "</div>";
    h += tabs([{ t: "搁下", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
    /* 「候选在纸的右边」是玩家点名的改版，这件事不能只靠眼睛看：引擎量一遍钉在 DOM 上 ——
       `data-pick = 枚数/候选左沿比纸右沿出去多少（设计 px）`。
       负数就是还压在信纸上，那种"看起来挪出去了其实叠在正文上"只有量得出来。 */
    var stg = document.getElementById("stage");
    try {
      var rk = document.querySelector("#layer .rstack"),
          sh = document.querySelector("#layer .sheet");
      if (rk && sh && rk.getBoundingClientRect && stg.setAttribute) {
        var sr = stg.getBoundingClientRect(), k = sr.width / 1280 || 1;
        var ra = rk.getBoundingClientRect(), rb = sh.getBoundingClientRect();
        stg.setAttribute("data-pick", (rk.querySelectorAll ? rk.querySelectorAll(".ropt").length : 0) +
          "/" + Math.round((ra.left - rb.right) / k));
      } else if (stg && stg.setAttribute) stg.setAttribute("data-pick", "");
    } catch (e) { }
  }
  /* 翻页：一页装几列要量 —— `.scut` 的宽 ÷ 列距（46px，与 .stext 的 line-height 同一条数）。
     位移 = 页序 × 一页的宽；到头就把「下一页」压成灰的。这一段只在真浏览器里有意义，
     Node 桩里量不到，所以整段包在 try 里静默跳过。 */
  function fitPages() {
    var cut = document.querySelector("#layer .scut");
    if (!cut || !cut.getBoundingClientRect || !cut.clientWidth) return;
    var txt = cut.querySelector ? cut.querySelector(".stext") : null;
    if (!txt) return;
    var box = cut.getBoundingClientRect(), tb = txt.getBoundingClientRect();
    var stg = document.getElementById("stage");
    var ks = stg && stg.getBoundingClientRect ? stg.getBoundingClientRect().width / 1280 : 0;
    /* 信纸是定尺寸的，短信画不满就露出一大片空格线 —— 那正是"读起来像一张表格"的来源
       （用户那句"收到的信太丑了"，量的就是这一块）。所以把**格线窗口收到正文真占掉的那几列**，
       再在纸里居中：纸还是那张纸（不拉伸、比例闸不动），只是不再替空白处画线。
       长信照旧满幅翻页（used ≥ full 时一个像素都不改）。 */
    if (ks > 0.02) {
      var full = Math.floor((box.width / ks) / 46) * 46;
      /* 收的是**正文画到的那一像素**，不是"凑满几列"：儋州那封信正文 276.4 px，
         按 46 一列进位就成了 322 —— 与整幅满窗一样宽，于是"缩"这件事静默不触发，
         纸左边照样露两列空格线（第一版就是这么漏的，只有量出来的数会说出来）。 */
      var used = Math.ceil(tb.width / ks);
      if (used > 46 && used < full) {
        cut.style.width = used + "px";
        cut.style.left = "50%"; cut.style.right = "auto";
        cut.style.transform = "translateX(-50%)";
        box = cut.getBoundingClientRect();
      }
      if (stg.setAttribute)
        stg.setAttribute("data-sheet", Math.round(box.width / ks) + "/" + Math.round(tb.width / ks));
    }
    var step = Math.max(46, Math.floor(box.width / 46) * 46);
    var over = tb.width - box.width;
    var pages = over > 1 ? Math.ceil(over / step) + 1 : 1;
    var p = Math.max(0, Math.min(S.lpage || 0, pages - 1));
    S.lpage = p;
    txt.style.transform = "translateX(" + (p * step) + "px)";
    var q = function (s) { return document.querySelector("#layer " + s); };
    var pv = q(".spg.pv"), nx = q(".spg.nx");
    if (pv) pv.className = "spg pv" + (p > 0 ? "" : " off");
    if (nx) nx.className = "spg nx" + (p < pages - 1 ? "" : " off");
  }
  /* 册子翻页：一页装几行也是量出来的 —— 逐行往下累加，越过窗口底就断在一行的**边界**上，
     绝不拦腰切一行。信纸按列宽量，这里按行高量，同一句话：装得下的才画，装不下的翻一叶看。
     翻出去的那几行是**直接 display:none**，不是把整条往上推 —— 推的话下一叶的头一行
     会有一截下巴露在这一叶的窗口里（第一版就是这么被 `data-fit` 量出来的）。
     翻完把「第几叶／共几叶」与「这一叶画到多高」都钉回 DOM，验收器才量得到翻得动没、切了没。 */
  function fitBookPages() {
    var book = document.querySelector("#layer .book");
    var box = book && book.querySelector ? book.querySelector(".brows") : null;
    if (!box || !box.children || !box.children.length || !box.clientHeight) return;
    var kids = box.children, i;
    // 先全部摆回来再量：藏起来的行 offsetHeight 是 0，拿它断页会把每一页都算成装得下
    for (i = 0; i < kids.length; i++) kids[i].style.display = "";
    var H = box.clientHeight, from = 0, starts = [0];
    for (i = 1; i < kids.length; i++)
      if (kids[i].offsetTop + kids[i].offsetHeight > kids[from].offsetTop + H) { starts.push(i); from = i; }
    var n = starts.length, p = Math.max(0, Math.min(S.bpage || 0, n - 1));
    S.bpage = p;
    var a = starts[p], b = p + 1 < n ? starts[p + 1] : kids.length;
    for (i = 0; i < kids.length; i++) kids[i].style.display = (i >= a && i < b) ? "" : "none";
    book.setAttribute("data-pages", (p + 1) + "/" + n);
    /* 藏过之后重新量：这一叶真正占掉多高（`H/用掉的高`）。用掉的比窗口还高，
       就是"一行比一叶还长"—— 翻页救不了，spill 闸按这个数报红。 */
    box.setAttribute("data-fit", H + "/" + (kids[b - 1].offsetTop + kids[b - 1].offsetHeight - kids[a].offsetTop));
    var pg = book.querySelector(".bpg");
    if (!pg) return;
    pg.style.display = n > 1 ? "" : "none";
    var pv = pg.querySelector(".pv"), nx = pg.querySelector(".nx"), bc = pg.querySelector(".bc");
    if (pv) pv.className = "pv" + (p > 0 ? "" : " off");
    if (nx) nx.className = "nx" + (p < n - 1 ? "" : " off");
    if (bc) bc.textContent = "第 " + (p + 1) + " 叶 · 共 " + n + " 叶";
  }

  function reply(id, idx) {
    var L = letterById(id), r = L.replies[idx];
    if (!r) return;
    sfx("brush");
    var c = replyCost(L, r);
    S.replied[L.id] = r.k;
    S.tone[r.k] = (S.tone[r.k] || 0) + 1;
    S.bars.人情 = clamp(S.bars.人情 + c.ren, 0, 100);
    S.bars.物议 += c.yi;
    S.log.push("回" + L.from + "：" + r.t + "　" + r.src);
    /* 回完**留在这一封上**：纸上落一行「回 …」并盖一枚「已回信」，
       原来这里是直接跳下一封 —— 玩家点完就翻页，自己回了什么根本没看见。
       投递那句话走中上方那条 toast（获得提示同一套反馈），不另起一屏。
       原来 toast 报的是「气 +3」，那个 3 是人情的权重；气质每次只 +1，
       现在 toast 与候选卡、与上面这几行改的数，全部出自 `replyCost()` 一份。 */
    S.lpicking = false; S.lpage = 0;
    toast("信已发出 · " + L.from + " 收 ——" + DATA.letterDims.key + " +1 · 人情 +" + c.ren);
    renderLetter(L.id);
  }

  // ── 册子 ────────────────────────────────────────────
  function renderBook(which) {
    set(bg("hub","sc-hub2-3.webp"));
    var h = "", i, list = [], hint = "";
    if (which === "verses") {
      /* 册子这一屏**也不挂匾**，理由与信屏同一条：它借的是本章堂前的图，匾面 x540..738 / y148..205
         正好在 `.book` 那张纸底下 —— `plate()` 先画、纸后画，于是标题与副题**被自己的纸盖住**，
         玩家一个字都看不见，可 `CUR_BOARD` 照样记成「落进匾里」。那是验收表上的假绿灯。
         所以这两行字改落在纸里（h2 下面一行小字），看得见才算数。 */
      hint = "句子不是奖励，是这一时辰过完剩下的东西";
      /* 「待触发」是一张空头支票：曾经有六行在册上却没有任何一条路能拿到（审计 P2-16）。
         能拿到的照旧写「待触发」；拿不到的明写「这一章没走到」—— 这两个词对玩家完全是两件事：
         一个说"你还没做"，一个说"这局不会有"。措辞不附年代判断（没能回校的都不许断言）。 */
      var later = DATA.book.later || [];
      for (i = 0; i < DATA.book.verses.length; i++) {
        var k = DATA.book.verses[i], L = DATA.lines[k];
        list.push('<div class="row ' + (S.verses[k] ? "got" : "miss") + '"><span>' +
          (S.verses[k] ? L.t : "—— 未得 ——") + "</span><i>" + (S.verses[k] ? L.src
            : (later.indexOf(k) >= 0 ? "这一章没走到" : "待触发")) + "</i></div>");
      }
      // 插一句另起一段：它是他自己岔出去的话，不是关卡奖励
      if (S.quips.length) {
        list.push('<div class="row sub"><span>插一句</span><i>' + S.quips.length + " 则</i></div>");
        for (i = 0; i < S.quips.length; i++)
          list.push('<div class="row got' + (S.quips[i].lie ? " lie" : "") + '"><span>' +
            // 伪作盖一枚裂口朱印：红字容易和「人情」那一色混，印章形状才一眼是分得开的
            (S.quips[i].lie ? '<img class="lieic" src="' + artSrc("图标/ico-wei.png") + '" alt="">' : "") +
            S.quips[i].t +
            "</span><i>" + S.quips[i].src + "</i></div>");
      }
    } else {
      hint = DATA.chapter.name + " · " + DATA.chapter.year + " —— " +
        (DATA.chapter.bookHint || "未得的菜：不必急着写完，贬谪还长");
      var dsrc = DATA.book.dishSrc || {};
      for (i = 0; i < DATA.book.dishes.length; i++) {
        var nm = DATA.book.dishes[i];
        /* 跨章借来的那两味（黄州席上的荔枝与烤蚝）在册子上标出来 ——
           "已尝"是玩家在这一局尝过了，"存疑"是这个名字本章并无出处（审计 P2-13）。 */
        list.push('<div class="row ' + (S.got[nm] ? "got" : "miss") + '"><span>' + nm + "</span><i>" +
          (S.got[nm] ? "已尝" : "未见") + (dsrc[nm] ? " · 存疑" : "") + "</i></div>");
      }
    }
    var n = which === "verses" ? Object.keys(S.verses).length : Object.keys(S.got).length;
    var cap = which === "verses" ? DATA.book.verses.length : DATA.book.dishes.length;
    h += panel({ k: which === "verses" ? "得句" : "食单", v: n + " / " + cap });
    h += '<div class="desk"></div>' + bookPaper(which === "verses" ? "清欢册" : "食单", hint, list,
      S.log.length ? S.log[S.log.length - 1] : "还没有记下的事");
    h += tabs([
      /* 入口放在食单这里，不放今日屏：今日屏那一排木牌已经八格（`hubTabs.length > 7` 那段
         在收间距才塞得下），再加一格就要动整条竖栏的版面。
         而"翻开菜名册 → 去把没写下来的那几味尝定"本来就是同一个动作的两半。 */
      /* 不带 `ic:`：`tabs()` 里有 `ic` 就走"图标 + `.tip`"那一支，而 `.tip` 是
         `opacity:0` 的悬停提示 —— 截图里没有、触屏里没有，第一次玩的人只会看见一只没名字的茶碗。
         本项目明写过"可点东西的效果要写在它脸上，悬停不算"，这一格就跟着「归案」走文字页签。 */
      { t: "尝菜", cls: "t3", act: "go", arg: "taste" },
      { t: "归案", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
  }

  /* 三屏共用这张定高纸（清欢册／食单、堂上规矩、案情）。行一律先全画进 `.brows`，
     再由 fitBookPages 量出一叶装得下几行 —— 装不下的不是删掉，是翻一叶去看。
     新开一张纸从头一叶起（在纸里翻页是这一屏的临时态，跟信纸的 lpage 同一条规矩）。 */
  function bookPaper(title, sub, rows, foot) {
    S.bpage = 0;
    return '<div class="book"><h2>' + title + "</h2>" + (sub ? '<p class="bsub">' + sub + "</p>" : "") +
      '<div class="brows">' + rows.join("") + "</div>" +
      (foot ? '<div class="foot">' + foot + "</div>" : "") +
      '<div class="bpg"><span class="pv" data-act="bpage" data-arg="-1">← 上一叶</span>' +
      '<span class="bc"></span><span class="nx" data-act="bpage" data-arg="1">下一叶 →</span></div></div>';
  }

  // ── 成就：一律用他自己的原句命名 ────────────────────
  /* 不另造一套「成就名」的词。玩家做到的事，只用他说过的话来回。
     伪作那条（saidLie）故意给一句很美的 —— 因为踩坑的体验就该是「好句子不是他的」。 */
  var ACHV = {
    cook:   function () { return !!S.flags.cook; },
    banquet:function () { return !!S.flags.banquet; },
    dish:   function () { return Object.keys(S.got).length >= DATA.book.dishes.length - lieStalls(); },
    letter: function () { return Object.keys(S.replied).length >= mailTot(); },
    clean:  function () { return S.bars.物议 >= 0; },
    frail:  function () { return S.bars.身体 < 30; },
    poor:   function () { return S.bars.银钱 <= 0; },
    noYin:  function () { return yinMode() && S.kongYin === 0; },
    noBorrow:function(){ return borrowMode() && !S.flags.borrowed; },
    taught: function () { return teachMode() && S.bars.身体 > 0; },
    saidLie:function () { return S.quips.some(function (q) { return q.lie; }); },
    hushAll:function () { return (DATA.asides || []).length > 0 && S.quips.length === 0; }
  };
  function lieStalls() {
    var n = 0, i;
    for (i = 0; i < DATA.street.stalls.length; i++) if (DATA.street.stalls[i].tag === "传说") n++;
    return n;
  }
  function achvRows() {
    var out = [], i, a;
    for (i = 0; i < (DATA.achv || []).length; i++) {
      a = DATA.achv[i];
      var f = ACHV[a.k];
      out.push({ hit: !!(f && f()), t: a.t, src: a.src, k: a.k });
    }
    return out;
  }
  /* 每一枚成就**怎么才能挣到**，只写在这里一份，成就墙读它。
     这一张表是照着上面 `ACHV` 的谓词逐条回读出来的，不是照着诗句猜的 ——
     猜的那一份一定会和判定漂开（`dish` 那条最容易漂：分母要减掉话本那几味）。 */
  var ACHV_HINT = {
    cook:     "灶前把一锅烧成（烧糊了不算）",
    banquet:  "席间把三位客人都陪到尽欢",
    dish:     "本章食单上在册的味全尝到（话本里那几味不算数）",
    letter:   "这一局收得到的信，一封不落都回了",
    clean:    "走到章末，物议没有被扣成负数",
    frail:    "身体掉到 30 以下：这一章熬垮过一次",
    poor:     "银钱见底过一次",
    noYin:    "任上把案子结绝了，一张空印都没留下",
    noBorrow: "一次都没有借别人的名字署名",
    taught:   "课教到散学，人还撑得住",
    saidLie:  "在席间替一句伪作说过话",
    hushAll:  "「插一句」的场合，一次都没有开口"
  };
  /* 某一章的成就清单：本章现算，别章读章末那份快照（`S.seals[k].achvKeys`）。
     快照只在盖章那一次写，所以没走完的章在墙上整组都是灰的 —— 这是实话，不是偷懒。 */
  function achvListOf(ch) {
    var src = (CHAPTERS[ch] && CHAPTERS[ch].achv) || [], i, have = {}, live;
    if (ch === CHAPTER_KEY) {
      live = achvRows();
      for (i = 0; i < live.length; i++) if (live[i].hit) have[live[i].k] = 1;
    } else {
      var ks = (S.seals[ch] || {}).achvKeys;
      for (i = 0; ks && i < ks.length; i++) have[ks[i]] = 1;
    }
    var out = [];
    for (i = 0; i < src.length; i++)
      out.push({ k: src[i].k, t: src[i].t, src: src[i].src, hit: !!have[src[i].k] });
    return out;
  }
  /* ── 成就墙 ──────────────────────────────────────────
     章末那一列只画拿到的（否则结算屏变成一张待办清单），而玩家问的是
     "我到底拿到过什么、还差什么" —— 那需要一面完整的墙。
     所以这一屏反过来排：未得的也占一格，但**只排条件不排句子**。
     那句诗是他挣来的东西，没挣到就不该先看见。 */
  function renderAchv() {
    set(bg("hub", "sc-hub2-3.webp"));
    var rows = [], i, j, ch, list, got = 0, cap = 0, n;
    for (i = 0; i < JOURNEY.length; i++) {
      ch = JOURNEY[i].key;
      list = achvListOf(ch);
      n = 0;
      for (j = 0; j < list.length; j++) if (list[j].hit) n++;
      got += n; cap += list.length;
      rows.push('<div class="agroup"><b>' + JOURNEY[i].nm + "</b><i>" + JOURNEY[i].yr +
        " · 已得 " + n + " / " + list.length + "</i></div>");
      for (j = 0; j < list.length; j++)
        rows.push('<div class="arow ' + (list[j].hit ? "got" : "miss") + '" data-achv="' +
          ch + "/" + list[j].k + "/" + (list[j].hit ? 1 : 0) + '"><b>' +
          (list[j].hit ? list[j].t : "未得 · " + (ACHV_HINT[list[j].k] || "还没有对得上的一句话")) +
          "</b>" + (list[j].hit ? "<em>" + list[j].src + "</em>" : "") + "</div>");
    }
    var h = panel({ k: "成就", v: got + " / " + cap });
    h += bookPaper("成就 · 得句",
      "墙上只印他自己说过的话。没挣到的那一条，句子先不给你看。", rows,
      DATA.lines.arrive.t + "　" + DATA.lines.arrive.src);
    h += backTab();
    layer(h);
  }

  // ── 章末 ────────────────────────────────────────────
  function renderEnd() {
    var endArt = bg("end2", DATA.chapter.hub || "hubbg2-2.webp");
    set(endArt);
    /* 没回的信在这一栏掉人情：他历史上真为「答书不勤」道过歉。
       分母只算**这一局收得到的**（`mailTot()`）—— 接了分支之后用 DATA.letters.length，
       等于因为"没走另一条路"扣玩家的人情，而那一条路他根本不知道存在。
       顺带把扣成一次性的：这一段原来写在 `renderEnd()` 里，而这屏会被重进
       （「再来」／验收路由），扣完没记号，重进一次再扣一遍。 */
    var miss = mailTot() - Object.keys(S.replied).length, i;
    if (miss > 0 && !S.flags.endPen) {
      S.flags.endPen = 1;
      S.bars.人情 = clamp(S.bars.人情 - miss * 6, 0, 100); S.bars.物议 -= miss;
    }
    var tone = "旷", kk, best = -1;
    for (kk in S.tone) if (S.tone[kk] > best) { best = S.tone[kk]; tone = kk; }
    var score = Object.keys(S.got).length * 3 + Object.keys(S.verses).length * 2 +
      Math.round(S.bars.人情 / 10) + best;
    var nx = nextChapter();
    // 印章＝身份：黄州无官印（只有「东坡居士」私印），元祐换官印，绍圣后又掉回私印。
    var sl = DATA.chapter.seal || { on: DATA.chapter.name + " · 印", off: DATA.chapter.name + " · 空印" };
    var got = score >= 12;
    // 记进行旅册子：这是**跨章不清零**的三枚章，终局那一屏要把它们并排盖在一张纸上。
    S.seals[CHAPTER_KEY] = { nm: DATA.chapter.name, t: got ? sl.on : sl.off, got: got,
      score: score, tone: tone, yin: S.kongYin, last: got };
    var h = plate("章末 · " + DATA.chapter.name, DATA.chapter.year + " · " + DATA.chapter.age);
    // 这一章真正留下的东西（定州空印／惠州还的债／其余回信数）写在印下面那段小结里，
    // 木札这一枚给乡望 —— 它是章末唯一要算的数。
    h += panel({ k: "乡望", v: score, cls: got ? "good" : "" });
    h += '<div class="seal' + (SEAL_LT[endArt] ? " lt" : "") + '"><h2>' + (got ? sl.on : sl.off) + "</h2>" +
      '<img src="' + artSrc(sealArt(sl.kind, got)) + '" alt="">' +
      "<p>" + DATA.lines.calm.t + "</p>" +
      '<p class="src">' + DATA.lines.calm.src + "</p>" +
      "<p>交出去：食单 " + Object.keys(S.got).length + " 味 · 清欢册 " +
      Object.keys(S.verses).length + " 句 · 回信 " + Object.keys(S.replied).length + "/" + mailTot() +
      "</p><p>换回来：乡望 " + score + " · " + (got ? sl.on : "一枚空的") + "</p>" +
      '<p class="src">这一章的气质：' + tone + (miss ? "（有 " + miss + " 封没回）" : "") +
      (S.kongYin ? " · 任上空印 " + S.kongYin + " 状" : "") +
      (sl.note ? " · " + sl.note : "") + "</p></div>";
    h += tabs([{ t: "再来", cls: "t1", act: "again" }]);
    // 成就只列拿到的那几条 —— 没拿到的不显示，否则章末变成一张待办清单
    var ar = achvRows(), hit = ar.filter(function (r) { return r.hit; }), i2;
    /* 章末底下这一列**只有四格的位置**（y494 起、每格 54、第四格底 708，再往下就出画）。
       原来那版是「四格画满，第五格放那句"另有 n 句"」—— 第五格在 y702，
       整张卡只有上沿 18 px 落在舞台里，那句话玩家从来没看见过。
       所以超过三条时让出一格给那句汇总，而不是把它顶出画外。
       每格从 52 放到 54：卡换成朱漆框之后高 52（含 10 px 边），52 的间距会贴边。 */
    var show = hit.length > 4 ? 3 : hit.length;
    for (i2 = 0; i2 < show; i2++)
      h += '<div class="achv" style="top:' + (494 + i2 * 54) + 'px"><img class="acic" src="' +
        artSrc("图标/ico-chengjiu.png") + '" alt=""><span class="k">得句</span><b>' +
        hit[i2].t + "</b><em>" + hit[i2].src + "</em></div>";
    if (hit.length > show)
      h += '<div class="achv" style="top:' + (494 + show * 54) + 'px"><img class="acic" src="' +
        artSrc("图标/ico-chengjiu.png") + '" alt=""><span class="k">得句</span><b>' +
        "另有 " + (hit.length - show) + " 句，都在这一章里</b><em>章末只摆得下四格</em></div>";
    S.seals[CHAPTER_KEY].achv = hit.length;
    /* 章名之外还要留下**是哪几条**：成就墙拍别章时只能读这一份快照（那一章的 `S` 早没了）。
       只存条数的话，墙上每一章都只能显示"已得 4 / 6"却不知道得了哪四句。 */
    S.seals[CHAPTER_KEY].achvKeys = hit.map(function (r) { return r.k; });
    h += btn("next", nx ? "下一程 · " + nx.nm : "盖下第三枚章");
    layer(h);
  }

  // ── 行旅：贬谪路线 ──────────────────────────────────
  /* 终局：三枚章并排盖在一张纸上。
     《自题金山画像》只点名三个贬谪地，所以纸上只有黄州·惠州·儋州三枚 ——
     元祐八年那枚真的官印**不在纸上**：他自己没把它算进功业。这一条是全游戏的落点。 */
  function renderFinale() {
    set(bg("end2", "hubbg2-2.webp"));
    var keys = ["huangzhou", "huizhou", "danzhou"], i, k, s;
    var fin = DATA.lines.finale || CHAPTERS.danzhou.lines.finale;
    var n = 0;
    for (i = 0; i < keys.length; i++) if (S.seals[keys[i]] && S.seals[keys[i]].got) n++;
    var h = plate("行旅 · 三印", DATA.lines.finale ? DATA.lines.finale.t : "问汝平生功业，黄州惠州儋州。");
    h += panel({ k: "三印", v: n + " / 3" });
    h += '<div class="finale"><div class="sheet">';
    for (i = 0; i < keys.length; i++) {
      k = keys[i]; s = S.seals[k];
      h += '<div class="stamp' + (s && s.got ? "" : " off") + '">' +
        '<div class="im"><img src="' + artSrc(sealArt(CHAPTERS[k].chapter.seal.kind,
          s && s.got)) + '" alt=""></div>' +
        '<b>' + (s ? s.t : CHAPTERS[k].chapter.name + " · 未走") + "</b>" +
        "<i>" + CHAPTERS[k].chapter.year + " · " + CHAPTERS[k].chapter.age + "</i>" +
        "<em>" + CHAPTERS[k].lines.calm.t + "</em>" +
        '<span class="src">' + CHAPTERS[k].lines.calm.src + "</span></div>";
    }
    h += '<div class="stamp guanyin"><div class="im"><img src="' +
      artSrc(SEAL_ART.guan) + '" alt=""></div>' +
      "<b>定州 · 官印</b><i>元祐八年 · 五十七岁</i>" +
      "<em>这一枚是真的。它没有上这张纸 —— 他把河北那两年自己划掉了。</em>" +
      '<span class="src">《自题金山画像》只数黄州、惠州、儋州</span></div>';
    h += '</div><div class="verse"><b>' + fin.t + "</b><em>" + fin.src +
      "</em><em>建中靖国元年（1101）七月二十八日，卒于常州。" +
      "「问汝平生功业」是他自己问的，三个地名也是他自己答的。</em></div></div>";
    /* 通关不是没收玩家：三枚章盖完，儋州那六格时辰重新给他 ——
       食单没集齐的、信没回的、成就差的那几句，都还在城里。想收尾随时再盖一次章。
       act("free") 就是"回到今日屏 + 时辰清零"，不加任何新状态：存档里它本来就是
       「儋州章、时辰用尽」之外多出来的一局，loadGame 天然认得。 */
    h += tabs([{ t: "行旅图", cls: "t4", act: "go", arg: "map" },
               { t: "回儋州", cls: "t3", act: "free" },
               { t: "制作", cls: "t4", act: "credit" }]);
    h += btn("again", "再走一遍");
    layer(h);
  }

  function nextChapter() {
    for (var i = 0; i < JOURNEY.length; i++)
      if (JOURNEY[i].key === CHAPTER_KEY) return JOURNEY[i + 1] || null;
    return null;
  }

  // ── 行旅：下一程（路上那一屏）────────────────────────
  /* 从前盖完章直接跳书，「贬谪」两个字就只剩一个地名列表。
     现在中间插一屏：小人自己挪一步、那一程真作过的诗摊在桌上、年月写在旁边 ——
     烧的是真天数，不是过场动画。验收那一条路（nodlg／demo）自动跳过，不挡截图。 */
  function renderTravel() {
    var nx = nextChapter(), hop = nx && nx.hop;
    if (!hop) { goChapter(); return; }
    set(hop.bg);
    sfx("step");
    var h = plate("行旅 · " + DATA.chapter.name + " → " + nx.nm, hop.out + "　·　" + hop.to);
    h += '<div class="trel"><img src="' + artSrc(hop.qb) + '" alt=""></div>';
    // 匾的副行已经写了出都与到任，匾下这块就不再复述一遍年月：
    // 复述会把句子挤到第三行，那块 intent 只有两行的位置。
    h += '<div class="intent street"><div class="in"><b>' + nbUnits(hop.t, "，", 11) + "</b><em>" + hop.src +
      "</em></div></div>";
    // 钮上不带地名：目的地在标题里，label 一长就顶出那颗钮的固定宽度（截图里被切过）
    h += btn("gochap", "继续上路");
    layer(h);
  }
  function goChapter() {
    var nx = nextChapter();
    if (!nx || !nx.on) { S.screen = "map"; renderMap(); return; }
    if (switchChapter(nx.key)) { location.hash = nx.key; renderHub(); }
  }
  function renderMap() {
    set(bg("hub", "sc-hub2-3.webp"));
    var face = S.mapFace === "chap" ? "chap" : "trip";
    var openN = 0, sealN = 0, i2;
    for (i2 = 0; i2 < JOURNEY.length; i2++) {
      if (JOURNEY[i2].on && CHAPTERS[JOURNEY[i2].key]) openN++;
      if (S.seals[JOURNEY[i2].key] && S.seals[JOURNEY[i2].key].got) sealN++;
    }
    /* 这一屏有两面。**全行旅**画的是整条贬谪路线（四枚图钉压在四个小景上），
       **本章图**画的是这一任所在的那一处地方 —— 画里留了一块完全空白的素木牌，
       州名由 HTML 叠上去（即梦写不出可靠汉字），牌位坐标是人工逐格读的。
       两面共用同一个 `.route` 框，所以叠字与几何只有一套说法。 */
    if (face === "chap") {
      var cq = DATA.chapter.plaque || [0.20, 0.30, 0.05, 0.20];
      var h0 = plate("舆图 · " + DATA.chapter.name,
        DATA.chapter.year + " · " + (DATA.chapter.office || ""), 1);
      h0 += panel({ k: "已盖", v: sealN + " / " + openN });
      h0 += '<div class="route" style="background-image:url(&quot;' +
        artSrc(bg("chapmap", MAPTRIP)) + '&quot;)">' +
        '<div class="plaque" style="left:' + (cq[0] * 100).toFixed(2) + "%;top:" + (cq[1] * 100).toFixed(2) +
        "%;width:" + (cq[2] * 100).toFixed(2) + "%;height:" + (cq[3] * 100).toFixed(2) +
        '"><h1>' + DATA.chapter.name + "</h1></div></div>";
      layer(h0 + mapTabs(face, sealN));
      return;
    }
    // 图钉按 `maptrip-1` 画里四座小景的实际位置标定（9-30 重画那张 16:9 之后，
    // 拿 10% 网格压在 1080×608 的原件上**一格一格读出来的**，不是估的）
    var pts = [[26, 62], [44, 26], [74, 58], [48, 85]];
    // 标题走横带（第三个参数），不写进被地图盖住的那块匾
    var h = plate("行旅 · 黄州 → 定州 → 惠州 → 儋州", "四十五岁到六十四岁。这一路是贬谪，不是游山", 1);
    /* 原来这里还挂了一张 `.intent.end`（本章的衔与约束 + 一条史注）—— 它和标题是同一个毛病：
       DOM 顺序在 `.route` 前面，被地图整个盖住，一个字都没露过。
       那些内容在**章末**那一屏照旧挂着（那一屏没有地图），所以这里摘掉不是删内容，是不再重复一份看不见的。
       地图框本身不能挪：图钉是按画里那四座小景一格一格读出来的，改了框就改了坐标。
       图也不写死在 CSS 里了 —— 走 `chapter.map`，一个出口（见 行旅.css `.route` 那条注释）。 */
    h += panel({ k: "已盖", v: sealN + " / " + openN });
    h += '<div class="route" style="background-image:url(&quot;' + artSrc(bg("map", MAPTRIP)) + '&quot;)">';
    for (var i = 0; i < JOURNEY.length; i++) {
      var j = JOURNEY[i];
      // 靠画面下沿的那两站，牌子翻到图钉上方，否则顶出地图框
      var dy = pts[i][1] > 68 ? -96 : 20;
      /* 点自己那一枚钉子＝把这一章从头再走一遍（switchChapter 里 reset() 全章归零）。
         原来一按就走，连一句话都不说 —— 时辰、牌、册子当场没了（审计 P2-11／问7①）。
         两步才算确认：第一下只弹话，第二下（同一站、同一屏之内）才真切。 */
      var cur = j.key === CHAPTER_KEY;
      h += '<div class="pin" style="left:' + pts[i][0] + '%;top:' + pts[i][1] + '%"></div>' +
        '<div class="stop' + (cur ? " cur" : "") + (j.on ? "" : " lock") +
        '" style="left:calc(' + pts[i][0] + '% - 95px);top:calc(' + pts[i][1] + '% + ' + dy + 'px)"' +
        ' data-act="' + (j.on ? (cur ? "rechap" : "chap") : "") + '" data-arg="' + j.key + '"><div class="in4"><b>' + j.nm +
        "</b><i>" + j.yr + (S.seals[j.key] ? " · " + S.seals[j.key].t : "") + "</i></div></div>";
    }
    h += "</div>";
    layer(h + mapTabs(face, sealN));
  }
  /* 两面的切换钮与「回衙／三印」并排：切面不改章、不掉时辰，它只是把同一张桌子转个方向。 */
  function mapTabs(face, sealN) {
    var t = [{ t: face === "chap" ? "全行旅" : "本章图", cls: "t4", act: "mapface",
               arg: face === "chap" ? "trip" : "chap" },
             { t: "回衙", cls: "t4", act: "go", arg: "hub" }];
    if (sealN >= 3) t.push({ t: "三印", cls: "t1", act: "go", arg: "finale" });
    return tabs(t);
  }

  // ── 规则 / 案情 ─────────────────────────────────────
  function renderRules() {
    set(bg("hub","sc-hub2-3.webp"));
    var ru = DATA.court.rules, i;
    /* 与册子同一条：`.book` 画在 `plate()` 后面，标题与导语会被自己的纸盖住。
       所以这两行收进纸里（h2 下面一行小字），并且这一屏不再挂匾。 */
    var h = panel({ k: "结绝", v: "需 " + DATA.court.need });
    var rows = [];
    /* 先把"这一局在换什么"排在三条规则前面 —— 口径只有一句，四处共用同一条
       （开场屏 / 这里 / 章末的"交出去·换回来" / EDDICT.core），不各写一份。 */
    rows.push('<div class="row"><span>这一局在换什么</span><i>' + CORE + "</i></div>");
    for (i = 0; i < ru.rows.length; i++)
      rows.push('<div class="row"><span>' + ru.rows[i][0] + "</span><i>" + ru.rows[i][1] + "</i></div>");
    /* 右栏那五枚木札的解释也在这里落一份：悬浮在触屏与录屏里都拿不到，
       而"不知道这些数干嘛用"正是玩家说"不知道在干嘛"的一半。
       文案**直接读 TAG_HINT**，不在这儿另抄一遍 —— 抄的那一份一定会漂。 */
    ["时辰", "银钱", "人情", "身体", "物议"].forEach(function (g) {
      if (TAG_HINT[g])
        rows.push('<div class="row"><span>' + g + "</span><i>" + TAG_HINT[g] + "</i></div>");
    });
    h += bookPaper(ru.title, ru.head, rows,
      DATA.lines.arrive.t + "　" + DATA.lines.arrive.src);
    h += backTab();
    layer(h);
  }

  /* ── 声设置弹层（#章/snd）─────────────────────────────
     沿用规则/成就那条覆盖屏老路：换掉整层、不动 S.screen，backTab 回来源屏。
     控件全部是 div + data-act（与整套 UI 同一宗）：
       · 音量是 10 格刻度条，点第几格就是几格 —— 不引 <input type=range>，
         那玩意儿的原生样式跟这套纸木 UI 打架，而且无头截图里量不着。
       · 每一格都把当前值写在脸上（亮了几格），「能点的东西，效果写在它脸上」。
     改动经 sndKey 落 SND → applyVolumes 当场听见 → sndSave 记档 → 重画本屏。 */
  function sndKey(arg) {
    var p = (arg || "").split(":"), k = p[0], v = parseInt(p[1], 10);
    if (k === "mus" || k === "sfx") {
      if (!(v >= 0 && v <= 10)) v = 0;
      SND[k] = v;
    }
    else if (k === "musOn") SND.musOn = v ? 1 : 0;
    else if (k === "sfxOn") SND.sfxOn = v ? 1 : 0;
    else if (k === "mute") SND.mute = v ? 1 : 0;
    else return;
    applyVolumes();
    sndSave();
    if (SND_OPEN) renderSnd();
  }
  function sndTicks(k, n) {
    var s = "", i;
    for (i = 1; i <= 10; i++)
      s += '<i class="tick' + (i <= n ? " on" : "") + '" data-act="sndk" data-arg="' + k + ":" + i + '"></i>';
    return s;
  }
  function sndRow(name, k, on) {
    return '<div class="row"><span>' + name + "</span><i>" +
      '<b class="sndtg' + (on ? "" : " off") + '" data-act="sndk" data-arg="' + k + "On:" + (on ? "0" : "1") + '">' +
      (on ? "开" : "关") + "</b>" +
      '<span class="ticks">' + sndTicks(k, SND[k]) + '<em class="tickv">' + SND[k] + "</em></span></i></div>";
  }
  function renderSnd() {
    set(bg("hub", "sc-hub2-3.webp"));
    var rows = [];
    rows.push('<div class="row"><span>全部静音</span><i>' +
      '<b class="sndtg big' + (SND.mute ? " off" : "") + '" data-act="sndk" data-arg="mute:' + (SND.mute ? "0" : "1") + '">' +
      (SND.mute ? "已静音 · 点此开声" : "点此全部静音") + "</b>" +
      "<em class='sndnote'>" + (SND.mute ? "存档与进度不受影响" : "静音会记进档里，重开不再忘") + "</em></i></div>");
    rows.push(sndRow("配乐（曲）", "mus", !!SND.musOn));
    rows.push(sndRow("音效与环境声", "sfx", !!SND.sfxOn));
    var h = bookPaper("声",
      "曲子是铺底，柴火是屋里的事 —— 两轨分开调，静音记进档里。",
      rows, "刻度点第几格就是几格；「关」比 0 格更断然，连点都不响。");
    h += backTab();
    layer(h);
  }

  /* ── 制作与授权（#章/credit）──────────────────────────
     CC-BY 的署名义务以前只活在数据表注释里，玩家一个字也看不见 —— 这是欠账。
     这一屏把账还上：音效与配乐两栏**自动从 SFX/MUS 表的 lic 字段生成**，
     表里加一支、这屏就多一行，不许两处各抄一份（抄的那份一定会漂，check_lic 盯着）。
     入口两处：封面按钮、终局页签；都是覆盖屏，backTab 回来源屏。 */
  function creditRows() {
    var rows = [], i, d;
    rows.push('<div class="arow"><b>文本</b><em>引文与史实以苏轼诗文、宋人记载为准，逐条标【有据】【传说】【存疑】三档；' +
      "标着「传说」的（如「一树梨花压海棠」）在游戏里就是传言，不当真话讲。</em></div>");
    rows.push('<div class="arow"><b>美术</b><em>场景、立绘与卡面由 AI 产图（即梦）生成、项目内加工；' +
      "界面汉字为字体排印，不设美术字。</em></div>");
    rows.push('<div class="arow"><b>引擎</b><em>原生 HTML／JS／CSS，无框架无构建；验收链跑在无头浏览器上。</em></div>');
    rows.push('<div class="row hd"><span>音效 · ' + SFX.length + " 支</span><i>每一行都是游戏里真的会响的东西；出处与授权如下。</i></div>");
    /* 名目与授权**堆着排**（.arow：b 一行、em 一行），不走 .row 的两列 ——
       .row 的名目列 nowrap，`出一张牌（堂上质证／灶前手法／席间上菜共用一声）` 这一档长度的
       名目会把授权列挤成一根一字一行的竖条（实测垂到纸外）。成就墙当年为同一个病发明了 .arow。 */
    for (i = 0; i < SFX.length; i++) {
      d = SFX[i];
      rows.push('<div class="arow"><b>' + d.on + '</b><em class="lic">' + (d.lic || "授权待补") + "</em></div>");
    }
    rows.push('<div class="row hd"><span>配乐 · ' + (typeof MUS !== "undefined" ? MUS.length : 0) + " 支</span><i>封面一曲、四章各一主题、终局一曲；试听台在 音效自检.html。</i></div>");
    if (typeof MUS !== "undefined")
      for (i = 0; i < MUS.length; i++) {
        d = MUS[i];
        rows.push('<div class="arow"><b>' + d.on + '</b><em class="lic">' + (d.lic || "授权待补") + "</em></div>");
      }
    return rows;
  }
  function renderCredit() {
    set(bg("hub", "sc-hub2-3.webp"));
    var h = bookPaper("制作与授权", "署名不是客气话：CC-BY 的每一条都要让玩家看得见。",
      creditRows(), "《东坡行旅》· 元丰三年 — 建中靖国元年 · 一顶东坡巾，一口白砂锅。");
    h += backTab();
    layer(h);
  }

  /* ── 尝菜 · 录方 ────────────────────────────────────
     灶前只给方向（"淡""火还生"），这一屏把方向**算成方子**：
     坐在桌前，拨算盘挑一个读数，花 6 银钱回尝一口 —— 尝到的方向就把那一位的区间夹窄一格。
     五味全夹死，这道菜的方子就记下了（`S.recipes`），从此灶前读数条把区间摊开给你看。
     两批资产在这里第一次上屏：
       · `tast2-<章>-<cold|ing|ok>-<n>` ＝ 桌景，状态跟着"这道菜夹死了没有"走；
         n 是本菜在本章的序号（那批图每章正好四张，最多的一道菜三味，够铺）。
       · `bill-<所>-<n>` ＝ 算盘与账桌的框。所按章定：黄州红木柜／定州灯笼夜柜／惠州酒肆／儋州竹巷。
     ⚠ 与灶前同一条老规矩：**能点的东西，效果写在它脸上**。所以每一味都同时印着
       现在夹到哪一步、这一口要花几文、以及夹死之后那格区间。 */
  var TASTE_PLACE = { huangzhou: "house", dingzhou: "night", huizhou: "tea", danzhou: "alley" };
  var TASTE_ZH = { huangzhou: "hz", dingzhou: "dz", huizhou: "hiz", danzhou: "dan" };
  var DIM_NM = { salt: "咸", sugar: "甜", sour: "酸", oil: "油", hf: "火候" };

  function tasteDishes() { return ZAO.dishesOf(CHAPTER_KEY); }
  function tasteSel() {
    var ds = tasteDishes(), i;
    for (i = 0; i < ds.length; i++) if (ds[i].id === S.dial.d) return ds[i];
    for (i = 0; i < ds.length; i++) if (!knownOf(ds[i])) return ds[i];
    return ds[0];
  }
  /* 夹到哪一步了：三种话，对应三种信息量。
     没尝过 / 只夹住一侧 / 夹死 —— 玩家要能一眼看出"还欠哪一口"。 */
  function tasteBracket(x) {
    var s = x.seen;
    if (!s) return { t: "还没尝过这一味", cls: "none" };
    if (x.locked) return { t: "夹死了 " + x.cands[x.pick][0] + "–" + x.cands[x.pick][1], cls: "ok" };
    var p = [];
    if (s.below !== null) p.push("尝到「不足」最高在 " + s.below + " ⇒ 下限在它之上");
    if (s.above !== null) p.push("尝到「过头」最低在 " + s.above + " ⇒ 上限在它之下");
    if (s.in0 !== null) p.push("尝到「正好」的那一段是 " + s.in0 + "–" + s.in1);
    return { t: p.join("；") + "；还剩 " + x.n + " 格合得上", cls: "part" };
  }
  function renderTaste() {
    var zh = TASTE_ZH[CHAPTER_KEY], ds = tasteDishes(), r = tasteSel(), i, h = "";
    var st = ZAO.recState(S.notes, r.id, r.need), done = ZAO.recDone(st), openN = 0;
    var idx = 0;
    for (i = 0; i < ds.length; i++) if (ds[i].id === r.id) idx = i;
    for (i = 0; i < st.length; i++) if (!st[i].locked) openN++;
    set(bg("hub", "sc-hub2-3.webp"));
    /* 这一屏**不挂匾**，与册子／规则／案情同一条理由：它借的是本章堂前那张图，
       匾面 x540..738 / y148..205 正好落在桌景要占的那一块上 —— 标题写上去就是被自己的图盖住
       （`stampFault` 的 ovl 会报，但更省事的做法是一开始就不摆）。
       标题收进右边那块账簿的第一行。 */
    /* 这一屏**要画右栏**（10-02 用户报："不显示钱，在那儿无限尝"）。
       原来这段注释写的是"银钱本来就在栏上，不需要第三处"—— 可这一屏从头到尾
       没调用过 `panel()`，栏根本不存在：一口 6 文地扣，屏幕上却看不见余额。
       `.tabacus` 占 x726..1100，木札那栏从 x1115 起，两处不冲突，直接画就是。 */
    h += panel();
    h += '<div class="tscreen">';
    /* ── 左：桌景与席位。`tast2-*` 的三档就是这道菜的状态，不是装饰：
          cold＝还没夹死任何一味；ing＝夹住了一部分；ok＝五味全夹死。 ── */
    h += '<div class="tscene" style="background-image:url(&quot;' +
      artSrc("tast2-" + zh + "-" + (done ? "ok" : openN === st.length ? "cold" : "ing") +
        "-" + (idx + 1) + ".webp") + '&quot;)">';
    for (i = 0; i < ds.length; i++)
      h += '<div class="tseat' + (ds[i].id === r.id ? " cur" : "") + (knownOf(ds[i]) ? " done" : "") +
        '" data-act="tsel" data-arg="' + ds[i].id + '"><span>' + ds[i].nm + "</span><i>" +
        (knownOf(ds[i]) ? (ds[i].known ? "帖里有方" : "我已录方") : "方子未定") + "</i></div>";
    h += "</div>";
    /* 桌景下面那一条是账桌本身：`bill-*` 是**实物**（算盘、钱串、递出来的那张纸），不是框，
       所以走 `contain` 而不是 `100% 100%` —— 与 `.intent` 同一条规矩。
       拉它会把算盘的档拉歪、把柜台的透视摊平。 */
    h += '<div class="tbill" style="background-image:url(&quot;' +
      artSrc("bill-" + TASTE_PLACE[CHAPTER_KEY] + "-" + (idx + 1) + "-cut.png") + '&quot;)"></div>';
    /* ── 右：账簿。拨珠与尝口都写在每一味自己那一格里。 ── */
    h += '<div class="tabacus">';
    h += '<div class="thead"><span>尝菜 · ' + r.nm + "</span><b>" +
      (knownOf(r) ? "方子已定" : "方子未定") + "</b></div>" +
      '<div class="tsub">把尝出来的方向，算成写得下的方子</div>';
    if (r.hint) h += '<div class="thint">' + r.hint + "</div>";
    for (i = 0; i < st.length; i++) h += tasteRow(st[i], r);
    h += '<div class="tfoot">' + (knownOf(r)
      ? '<div class="told">这一味已经记在食单上了</div>'
      : done ? '<div class="btn" data-act="trec" data-arg="">' +
          '<div class="in">定方 · 记下这一桌</div></div>'
        : '<div class="topen">还差 ' + openN + ' 味没夹死 —— 拨一个读数，尝一口，它就窄一格</div>') +
      "</div></div></div>";
    h += backTab();
    /* 这一屏的账钉在 DOM 上：验收器要能读出"选的是哪道、夹死几味/共几味、已填了几格夹位"，
       而不是靠截图上有没有一行字。
       ⚠ 第四格是 `tasteProbes()` ＝ **已填的夹位格数**（每味最多 below/above/in0 三格），
       不是"尝过几口"：同一侧再尝一口不涨它。别拿它当花了多少银钱的证据
       （口数在 `engine_harness.js` 那边自己数，那条"银钱按口精确扣掉"用的是它）。 */
    TASTE_MARK = r.id + "/" + (st.length - openN) + "/" + st.length + "/" + tasteProbes(r.id);
    layer(h);
    TASTE_MARK = "";
    /* 账簿那一本高是写死的（`.tabacus` 524px + `overflow:hidden`），
       内容比它高就会被**裁掉半截**而没人知道 —— 深状态那张截图上
       「定方 · 记下这一桌」就是被裁的，而 19 步闸全绿。
       把"超出多少像素"盖进 DOM，验收器才量得到（与 data-taste 同一条路子）。 */
    try {
      var bx = document.querySelector(".tabacus"), stg2 = document.getElementById("stage");
      if (bx && stg2) {
        /* 不能只看 scrollHeight：`position:absolute` 的后代**不撑高**滚动区，
           第一版就是这么漏掉那颗悬出面板的「定方」钮（量到 0，眼睛看得见）。
           改成量"所有后代里最低的那条边"再减面板可视底。 */
        var bb = bx.getBoundingClientRect(), cs2 = getComputedStyle(bx);
        var inner = bb.bottom - (parseFloat(cs2.paddingBottom) || 0);
        /* `low` 原来从 `inner` 起算 —— 于是"没裁"与"还剩 200px 余地"都写成 0：
           这个数只会说"没切"，不会说"离切多近"。改成从 0 起算、把最低那条边**原样**记下来，
           裁掉多少与还剩多少各写一个戳（10-10 动牌名与摊语之前最想要的就是这个数）。 */
        var low = 0, kids = bx.querySelectorAll("*"), i2;
        for (i2 = 0; i2 < kids.length; i2++) {
          var kr = kids[i2].getBoundingClientRect();
          if (kr.bottom > low) low = kr.bottom;
        }
        if (!low) low = inner;                     // 面板里一个后代都没有：当作正好齐平
        stg2.setAttribute("data-fit", String(Math.round(Math.max(0, low - inner))));
        stg2.setAttribute("data-slack", String(Math.round(Math.max(0, inner - low))));
      }
    } catch (e) { }
  }
  function tasteProbes(id) {
    var m = S.notes[id], n = 0, k;
    if (!m) return 0;
    for (k in m) if (m.hasOwnProperty(k)) {
      if (m[k].below !== null) n++;
      if (m[k].above !== null) n++;
      if (m[k].in0 !== null) n++;
    }
    return n;
  }
  function tasteRow(x, r) {
    var g = ZAO.DIAL[x.a], b = tasteBracket(x), v = tasteDial(x.a, g);
    return '<div class="trow ' + b.cls + '"><i>' + DIM_NM[x.a] + "</i>" +
      '<b class="brk">' + b.t + "</b>" +
      '<span class="dial"><u data-act="tdial" data-arg="' + x.a + ':-">−</u>' +
      "<em>" + v + "</em>" +
      '<u data-act="tdial" data-arg="' + x.a + ':+">+</u>' +
      '<s class="' + (S.bars["银钱"] >= ZAO.REC_FEE ? "" : "poor") +
      '" data-act="taste" data-arg="' + x.a + '">' +
      (S.bars["银钱"] >= ZAO.REC_FEE ? "尝这口 " + ZAO.REC_FEE + " 文" : "钱不够这口") +
      "</s></span></div>";
  }
  /* 拨子只落在量程内的整档上；默认从中间起 —— 二分的第一步天然从这里开始。 */
  var TASTE_MARK = "";
  function tasteDial(dim, g) {
    var v = S.dial[dim];
    if (typeof v !== "number" || isNaN(v)) v = (g[0] + g[1]) / 2;
    v = Math.round(v / g[2]) * g[2];
    return v < g[0] ? g[0] : v > g[1] ? g[1] : v;
  }
  function renderCase() {
    var d = DATA.court;
    /* 案情屏自己的脸：公堂正面（10-11 起走高清原件，§50-十二 的九张欠账销掉第一张）。
       以前借用本章堂上底 —— 卷宗摊在载酒堂/书房里，跟"案情"两个字不搭。 */
    set("sc-court2-2.webp");
    var h = panel({ k: "卷宗", v: (d.caseRows || []).length + " 条" });
    // 同 `.book` 那两屏：标题收进纸里，不挂在那张会被纸盖住的匾上
    var rows = [];
    (d.caseRows || []).forEach(function (r) {
      rows.push('<div class="row"><span>' + r[0] + "</span><i>" + r[1] + "</i></div>");
    });
    h += bookPaper("案情 · " + d.caseName,
      d.caseSub || "话本层：机锋与神探都出明清小说，不在正史", rows,
      DATA.lines.cold.t + "　" + DATA.lines.cold.src);
    h += backTab();
    layer(h);
  }

  // ── 骨架 ────────────────────────────────────────────
  var _screen = "hub", _dlgFrom = "hub";
  /* 来源屏的名目。「回堂上」那句死文案就是 P1-5 的形状：规则有四处入口
     （堂上／读帖／灶前／席间），从灶前翻开再按返回，按钮写着回堂上、按下去落回今日屏，
     而今日屏上的「灶前」是**重新进关**（newStove 起一炉新锅）—— 烧了一半的锅、
     席面的欢值、已上过的菜全部静默清零，连弃锅那 1 时辰的提示都没有。 */
  var BACK_NAME = { hub: "今日", court: "堂上", stove: "灶前", tie: "读帖", banquet: "席间", taste: "尝菜",
    street: "上街", book: "食单", letter: "来信", wall: "信墙", map: "舆图",
    travel: "行旅", end: "章末", finale: "终局", cover: "封面", snd: "声", credit: "制作" };
  /* 规则与案情是"换掉整层而**不动 S.screen**"的覆盖屏，所以回得去靠的是照屏名重描一遍，
     不是靠记一个没人读的变量。状态不在（锅已结算、关没进）就退回今日屏，不许白屏。 */
  function repaint(s) {
    s = s || S.screen;
    if (s === "court" && S.court) renderCourt();
    else if (s === "stove" && S.stove) renderStove();
    else if (s === "tie" && S.stove) renderTie();
    else if (s === "banquet" && S.banquet) renderBanquet();
    else if (s === "street" && S.street) renderStreet();
    else if (s === "book") renderBook(S.bookWhich === "verses" ? "verses" : "dishes");
    else if (s === "letter" && S.mailTo) renderLetter(S.mailTo);
    else if (s === "wall") renderWall();
    else if (s === "map") renderMap();
    else if (s === "taste") renderTaste();
    else if (s === "travel") renderTravel();
    else if (s === "end") renderEnd();
    else if (s === "finale") renderFinale();
    else if (s === "cover") renderCover();
    else if (s === "snd") renderSnd();
    else if (s === "credit") renderCredit();
    else { S.screen = "hub"; renderHub(); }
  }
  function backTab() {
    return tabs([{ t: "回" + (BACK_NAME[_screen] || "今日"), cls: "t2", act: "back" }]);
  }
  var CUR_BG = "";                          // 这一屏铺的是哪张背景，plate() 拿它查空白匾
  var CUR_BOARD = -1;                       // 这一屏的标题落没落进匾里：1 落进 / 0 走横带 / -1 这一屏没标题
  var CUR_SUB = -1;                         // 副题收进匾里没有：1 收进 / 0 落到匾下素墙 / -1 这一屏没走匾那一支
  function set(img) {
    var e = document.getElementById("bg");
    // CUR_BG 记的仍是**逻辑名**（素材/ 那一张）：BOARDS 那张匾面表按它查，
    // 换成高清路径去查就全查不到了 —— 高清只换像素，不换身份。
    CUR_BG = img;
    e.style.backgroundImage = 'url("' + (hdPick(img) || "素材/" + img) + '")';
    e.className = "";                       // 只有对话屏才压暗，切回关卡屏要亮回来
  }
  /* 章背景：本章没配这张图就退回黄州那一张，绝不留白屏。 */
  function bg(key, fb) { return DATA.chapter[key] || fb; }
  function layer(html) {
    document.getElementById("layer").innerHTML = html;
    // 把「这一屏到底画的是谁」钉在 DOM 上。无头截图只看文件新不新，
    // 路由悄悄落回 hub 时它照样报 OK —— 有了这个戳，验收器才拦得住那种假绿。
    document.getElementById("stage").setAttribute("data-screen", S.screen || "");
    document.getElementById("stage").setAttribute("data-board", CUR_BOARD);
    document.getElementById("stage").setAttribute("data-sub", CUR_SUB);
    CUR_BOARD = -1;                          // 下一屏重新量，别把上一屏的结论带过来
    CUR_SUB = -1;
    sfxAmbience();
    sfxMusic();
    musStamp();
    /* 三个排版修正器**抛异常不许把后面的 stampFault 一起带走**。10-09 证伪 A1 就是这么
       骗过所有几何闸的：删掉 `fitShelf` 里两行、留下一行引用未定义的 `tips`
       → TypeError → `data-fault`/`data-tiny`/`data-shrink` 一个都没写 → 那一屏"全绿"。
       崩了要响，不能装作没这回事。 */
    FIT_ERR = "";
    try { fitOverflow(); } catch (e) { FIT_ERR = "fitOverflow " + ((e && e.message) || e); }
    /* 信纸那对数（格线窗宽/正文宽）由 `fitPages()` 写，所以清空要**在它之前** ——
       放在下面那一堆锚点旁边，等于刚写上就擦掉（第一版就是这么静默量不到）。 */
    document.getElementById("stage").setAttribute("data-sheet", "");
    try { fitPages(); } catch (e) { FIT_ERR += " · fitPages " + ((e && e.message) || e); }                              // 竖排信纸的页码只有量得出来
    try { fitBookPages(); } catch (e) { FIT_ERR += " · fitBookPages " + ((e && e.message) || e); }                          // 册子那一叶装得下几行，同样只有量得出来
    /* 「锅是不是自己走的」要能被机器看见，不能只写在笔记里：这一屏钉一个 `turn/turns`，
       `#章/stove/live` 那条路由断言它**大于 0**（无头 Chrome 的虚拟时间会把定时器跑掉几拍）。 */
    var stg = document.getElementById("stage");
    stg.setAttribute("data-pot",
      S.screen === "stove" && S.stove ? (S.stove.turn + "/" + S.stove.turns) : "");
    /* 尝菜屏的账：`菜id/夹死几味/共几味/尝过几口`。验收器要判的是
       "贪心机一口一口拨，夹死的味数必须单调涨到 5"，那只能从 DOM 上读。 */
    stg.setAttribute("data-taste", S.screen === "taste" ? TASTE_MARK : "");
    /* 回信候选那一层的位置是 `renderLetter()` 画完之后自己量的；
       离开信屏要清掉，否则"候选在纸右边"这件事会跟着下一屏一起被读成成立。 */
    stg.setAttribute("data-pick", "");
    /* 引导那一步点亮了哪一块，同理：`tutPlace()` 在 layer() 之后写，这里只管清。 */
    stg.setAttribute("data-tut", "");
    /* 「有没有档」由 `renderCover()` 在 layer() 之后写（它决定「继续」灰不灰），这里先清。 */
    stg.setAttribute("data-save", "");
    /* 天气与住户的戳：data-fx 是"这一屏天上飘着什么"（空串＝室内/无），
       data-qb 是"今日屏坐的是哪一位"。验收要能问"定州今日屏真的在下雪吗"，
       答案必须钉在 DOM 上而不是截图里。 */
    weatherSet();
    stg.setAttribute("data-qb", S.screen === "hub" && QB_HUB[CHAPTER_KEY] ? QB_HUB[CHAPTER_KEY].art : "");
    potHalt(); potGo();                      // 只有灶前那一屏在烧，别的屏一律摘掉定时器
    stampClash();                            // 量完字号再量相交：缩过之后才是最终占位
    stampFault();                            // 再量三件"数没越界"的毛病：字被裁 / 越出舞台 / 图没落盘
    enterFx();                               // 量完再动：挂类名不影响几何，但要在 DOM 站住之后
    popTick();                               // 获得与成就都在这一次重绘之后量差额
    /* 存档挂在同一处，理由与 popTick 那条注释一样：点名式的钩子一定会漏掉后加的那几处。
       layer() 只在真的换屏时走一遍，不是每帧 —— 一关结算必然重绘，所以结算点全覆盖。
       （早先设计里写的「四个 finishX 后各写一次」就是点名式，新增一个发奖屏就得记着补一处。） */
    saveGame();
  }
  /* 牌匾与名字条都是**定尺寸的资产**，字长了就糊到框外去（用户点名的「大隐患」）。
     浏览器里没有 PIL 那套 stext，所以在插入后回读一次：超出框就一档一档缩字号。 */
  /* ── 标题被浮层盖住了没有：让引擎自己每一屏量一遍 ──────────
     9-28 一夜里连着撞见同一类毛病：信屏的标题骑在信纸正文上、册子／规则／案情／舆图四屏的
     标题被自己的纸整个盖住、灶前的记事板压住匾的下半截。**没有一处是数越界** ——
     坐标都对、字号也缩过、断言全绿，唯一能发现它的办法是把那一屏裁开用眼睛看。
     眼睛看不了 149 屏，所以把"看"写成量：标题框（匾或横带）与任何一张自带纸的浮层
     只要相交超过 6 px，就把交叠记在 `#stage[data-clash]` 上，交给 shot_game 逐屏回读。
     与 data-screen／data-board 是同一条路子：**能钉在 DOM 上的结论，才轮得到验收器去断言。** */
  function stampClash() {
    var st = document.getElementById("stage");
    var t = document.querySelector("#layer .onb") || document.querySelector("#layer .plate");
    if (!st || !t || !t.getBoundingClientRect) { if (st) st.setAttribute("data-clash", ""); return ""; }
    var a = t.getBoundingClientRect(), bad = [], i;
    /* 副题在匾不够高的那一屏是**另起一个 `.subw` 落在匾下的素墙上**的，
       它不在 `.onb` 的方框里 —— 只量匾就会漏掉"标题没事、副题被压住"这一种。
       定州灶前正是这种：匾 y 只到 175，副题挂在 y201..235，而记事板从 y214 起。 */
    var sw = document.querySelectorAll("#layer .subw");
    for (i = 0; i < sw.length; i++) {
      var s = sw[i].getBoundingClientRect();
      a = { left: Math.min(a.left, s.left), right: Math.max(a.right, s.right),
            top: Math.min(a.top, s.top), bottom: Math.max(a.bottom, s.bottom) };
    }
    var ov = document.querySelectorAll("#layer .z-notes, #layer .book, #layer .letterimg," +
      " #layer .route, #layer .intent, #layer .dboxbg");
    for (i = 0; i < ov.length; i++) {
      var b = ov[i].getBoundingClientRect();
      var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 6 && h > 6)
        bad.push(ov[i].className.split(" ")[0] + " " + Math.round(w) + "x" + Math.round(h));
    }
    st.setAttribute("data-clash", bad.join(" | "));
    return bad.join(" | ");
  }
  /* ── 把"字被裁了 / 跑出画了 / 图没在盘上"写成量 ──────────────────
     data-clash 只盯标题与自带纸的浮层。另外三种毛病同样**一个数都不越界**：
       · cut —— 元素自己 scroll 宽/高大于 client，而 overflow 是 hidden：字被静默吃掉。
                fitOverflow 只救它点名的那一串选择器，新加的格子不在名单里就没人缩字号。
       · out —— 元素越出 1280×720 舞台。#stage 有 overflow:hidden，越出去等于不存在。
       · img —— <img> 加载失败（naturalWidth 0）。立绘有三级 onerror 兜底链，
                兜底成功时 src 会悄悄换成别人的脸，这一步先把"根本没图上来了"抓住。
       · hit —— 看得见但点不动：一颗按钮中心点上摸到的是别的东西。见下面那段。
       · spill —— 定高纸（册子那一叶）装不下、翻页也救不回来的那几行。见下面那段。
       · edge —— 匾上的字横出素面框，压在织金回纹与木头上。见下面那段。
     与 data-screen／data-clash 一条路子：钉在 DOM 上，才轮得到验收器逐屏回读。 */
  function stampFault() {
    var st = document.getElementById("stage"), lay = document.getElementById("layer");
    if (!st || !lay || !st.getBoundingClientRect || !lay.querySelectorAll) { return ""; }
    var sr = st.getBoundingClientRect(), k = sr.width / 1280;
    // Node 里的 DOM 桩没有真布局（宽 0），真浏览器里 k 恒 > 0 —— 量不出就什么都不写，
    // 免得 harness 把每一屏都报成"越出舞台"。
    if (!k || k < 0.02) { st.setAttribute("data-fault", ""); return ""; }
    var cut = [], out = [], img = [], tiny = [], all = lay.querySelectorAll("*"), i, j;
    for (i = 0; i < all.length; i++) {
      var e = all[i], cs = window.getComputedStyle ? getComputedStyle(e) : null;
      if (!cs || cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) continue;
      var own = "";
      for (j = 0; j < e.childNodes.length; j++)
        if (e.childNodes[j].nodeType === 3) own += e.childNodes[j].nodeValue;
      own = own.replace(/\s+/g, " ");
      if (own.trim()) {
        var dw = e.scrollWidth - e.clientWidth, dh = e.scrollHeight - e.clientHeight;
        if (dw > 1 && (cs.overflowX === "hidden" || cs.overflowX === "clip"))
          cut.push("宽+" + Math.round(dw) + " " + nm(e) + " " + tx(own));
        if (dh > 1 && (cs.overflowY === "hidden" || cs.overflowY === "clip"))
          cut.push("高+" + Math.round(dh) + " " + nm(e) + " " + tx(own));
      }
      var r = e.getBoundingClientRect(), w = r.width / k, h = r.height / k;
      if (w < 3 || h < 3) continue;
      /* · tiny —— 正文**实际渲染出来几号字**。上面那条 `cut` 只抓 overflow:hidden 的静默裁切，
         而 `fitOverflow` 把牌面小字一路缩到 9px 的地板，缩完就不溢出了 —— 于是"这行字读不出"
         这件事在整条链上一个数都没有：截图里它清清楚楚是 9 号字，闸上它是绿的。
         9px 是 CSS 里写死的，还是被缩下来的，只有在这儿量才分得出来。 */
      var fsz = parseFloat(cs.fontSize) || 0;
      if (fsz > 0 && fsz < 13 && own.trim()) tiny.push([fsz, nm(e), tx(own)]);
      var x = (r.left - sr.left) / k, y = (r.top - sr.top) / k;
      if (x < -4 || y < -4 || x + w > 1284 || y + h > 724) {
        // 只有**带字或带图**的元素才算内容：`.desk` 那类是 `bottom:-58px` 故意出画的装饰
        if (own.trim() || e.tagName === "IMG" || (e.getElementsByTagName && e.getElementsByTagName("img").length))
          out.push(nm(e) + " [" + Math.round(x) + "," + Math.round(y) + "," + Math.round(w) + "x" + Math.round(h) + "]" +
            (own.trim() ? " " + tx(own) : ""));
      }
    }
    /* 一屏几十处小字全写出来没人读，所以按字号升序、同一名目只留最小的那一处，取前 10 条；
       行首那个数是**没去重之前的总数**——去重后看着只有 3 处、其实同一格刷了 20 遍，
       这两种情况要分得开。 */
    tiny.sort(function (p, q) { return p[0] - q[0]; });
    var tseen = {}, trow = [];
    for (i = 0; i < tiny.length && trow.length < 10; i++) {
      if (tseen[tiny[i][1]]) continue;
      tseen[tiny[i][1]] = 1;
      trow.push(Math.round(tiny[i][0] * 10) / 10 + "px " + tiny[i][1] + " " + tiny[i][2]);
    }
    st.setAttribute("data-tiny", tiny.length + (trow.length ? ";" + trow.join(" | ") : ""));
    /* 被缩过的格数。与 data-tiny 是两回事：tiny 量"现在几号字"，
       这一个量"有没有东西被按下去过"——地板以下才有前者，地板本身只有后者。 */
    st.setAttribute("data-shrink", SHRUNK);
    st.setAttribute("data-stuck", STUCK.length + (STUCK.length ? ";" + STUCK.join(" | ") : ""));
    if (FIT_ERR) { st.setAttribute("data-fault", "fit 崩了 " + FIT_ERR); return "fit"; }
    /* · crowd —— 一排 nowrap 的格子里，内容比格子本身还宽。
       上面那条 `cut` 抓不到它，因为 `cut` 要 `overflow:hidden`（内容被静默裁掉才报），
       而 `.band .cell` 是 `overflow:visible`：它不裁，**它骑到隔壁那一格上去**。
       10-08 把 `.bk/.bv` 的地板从 6.1px 提到 9px 之后，上街八张牌那一屏底部糊成一串
       （`银钱 −20情+物议+3`）—— 其实六号字的时候就在挤，只是小得看不出挤。
       这一条**先只钉数不判红**（`data-fault` 里判红会把别的真毛病淹在噪声里），
       等版式定了再并进去。`.in2`（牌名＋品类）同一类，一起量。 */
    var crowd = [], crows = lay.querySelectorAll(".band .cell, .plate2 .in2"), i3;
    for (i3 = 0; i3 < crows.length; i3++) {
      var ce = crows[i3], cw = ce.scrollWidth - ce.clientWidth;
      /* 带上这一格自己的文字（`textContent` —— `.in2` 的字全在子 span 里，`own` 是空的），
         否则只知道"第 3 格溢出 41px"，不知道该去改哪张牌的名字。
         再按溢出从大到小排：只留前 6 条，最狠的那条必须在里面。 */
      if (cw > 1) crowd.push([Math.round(cw), nm(ce) + " 溢出 " + Math.round(cw) + "px " +
        tx((ce.textContent || "").replace(/\s+/g, " "))]);
    }
    crowd.sort(function (x, y) { return y[0] - x[0]; });
    /* 同一类"字压在别的东西上"：牌心那张定高纸（`.note`）淌到菜图（`.art`）上去了。
       10-09 要把 `.plate2` 抬高压 `.note` 之前，得先知道 `.note` 现在离 `.art` 有多少余地 ——
       没有这一条，"抬高度会不会把摊语顶进菜里"就只能靠眼睛，而眼睛过不了 241 屏。
       与上面同一张数：先只报数不判红。 */
    var cds = lay.querySelectorAll(".card"), i4;
    for (i4 = 0; i4 < cds.length; i4++) {
      var nt = cds[i4].querySelector ? cds[i4].querySelector(".note") : null,
          ar = cds[i4].querySelector ? cds[i4].querySelector(".art") : null;
      if (!nt || !ar || !nt.getBoundingClientRect) continue;
      var ra = nt.getBoundingClientRect(), rb = ar.getBoundingClientRect();
      var box = Math.round((Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)) / k);
      /* **量墨不量框**。`.note` 是 `max-height:34%` 的额度（字只写到其中一段），
         `.art` 是 flex 底对齐的**容器**（图自己的盒子才等于看得见的像素）。
         原来这两个框一相交就报 12px，可那 12px 落在图的空白上沿里 ——
         10-10 把惠州那张牌放大三倍看过，字与图之间还有余地。
         所以拿 `Range.getClientRects()` 的末行墨底去对 `img` 的上沿，
         框那个数**照旧带着报**，两条一起看，别把换判据当成把判据调松。 */
      var inkB = ra.bottom, rs = null;
      if (document.createRange) {
        var rg = document.createRange();
        rg.selectNodeContents(nt);
        rs = rg.getClientRects ? rg.getClientRects() : null;
        if (rs && rs.length) inkB = rs[rs.length - 1].bottom;
      }
      var aim = ar.querySelector ? ar.querySelector("img") : null;
      var top = aim && aim.getBoundingClientRect ? aim.getBoundingClientRect().top : rb.top;
      var ov = Math.round((inkB - top) / k);
      if (ov > 1 || box > 1) crowd.push([Math.max(ov, box), "div.card.note 墨压菜图 " + ov +
        "px 框 " + box + "px " + tx((nt.textContent || "").replace(/\s+/g, " "))]);
    }
    crowd.sort(function (x, y) { return y[0] - x[0]; });
    var crows2 = [];
    for (i3 = 0; i3 < crowd.length && i3 < 6; i3++) crows2.push(crowd[i3][1]);
    st.setAttribute("data-crowd", crowd.length + (crows2.length ? ";" + crows2.join(" | ") : ""));
    /* · spill —— 定高纸把淌出去的那几行**静默吃掉**。上面那条 `cut` 只查自带文本的元素，
       而册子的字全在子节点里；纸底离舞台底还有 110px，`out` 也够不着 ——
       于是儋州清欢册少了两行插一句，验收一路绿灯。现在拿 `data-fit` 那对数点闸：
       这一叶画到的高度越过窗口自己的底，就是切到了（翻页翻不动的那种：一行比一叶还长）。 */
    var spill = [], pp = lay.querySelectorAll(".brows"), i2;
    for (i2 = 0; i2 < pp.length; i2++) {
      var bx = pp[i2], oh = bx.scrollHeight - bx.clientHeight;
      var fit = (bx.getAttribute && bx.getAttribute("data-fit")) || "";
      var q = fit.split("/");
      if (oh > 2 && !fit) spill.push("册子淌出 +" + Math.round(oh) + "px · 没人量过这一叶");
      else if (q.length === 2 && +q[1] > +q[0] + 1)
        spill.push("这一叶切到第 " + q[1] + "px · 窗口只有 " + q[0] + "px");
    }
    /* · edge —— 匾上的字**压过匾框**。`.onb` 那个盒子就是 BOARDS 量出来的素面，
       字比它宽就横到织金回纹与木头上去了。两条老闸都抓不到：
       `cut` 要 overflow 是 hidden（`.onb h1` 是 nowrap + visible，`fitOverflow` 一路缩到
       9px 的地板还是缩不下，它自己不报），`out` 要越出 1280×720（匾在画面正中，差 20px 算什么）。
       定州与惠州那两块匾的标题各 22 字，实测各横出框外 12／23 px —— 一直看得见，只是没人量。 */
    var edge = [], onb = lay.querySelector(".onb");
    if (onb && onb.querySelectorAll) {
      var or = onb.getBoundingClientRect(), ok2 = onb.querySelectorAll("h1, p"), i3;
      for (i3 = 0; i3 < ok2.length; i3++) {
        var kr = ok2[i3].getBoundingClientRect();
        var dl = (or.left - kr.left) / k, dr = (kr.right - or.right) / k;
        var dt = (or.top - kr.top) / k, db = (kr.bottom - or.bottom) / k;
        if (dl > 2 || dr > 2 || dt > 2 || db > 2)
          edge.push("匾字出框 左" + Math.round(dl) + " 右" + Math.round(dr) +
            " 上" + Math.round(dt) + " 下" + Math.round(db) + " " + tx(ok2[i3].textContent));
      }
    }
    var ims = document.images;
    for (i = 0; i < ims.length; i++)
      if (ims[i].complete && ims[i].naturalWidth === 0)
        img.push((ims[i].getAttribute("src") || "").slice(0, 46) + " @" + nm(ims[i]));
    /* · hit —— 看得见但点不动：一颗真有 data-act 的按钮，把它**看得见的那一块**的中心
        拿去 elementFromPoint，摸到的不是它自己（被一张纸／一条浮层压住了）。
        这一类"点了没反应"在模拟层永远查不到 —— sim 直接调 act()，绕开了唯一坏掉的那一段。
        两条必须先排掉的假阳性：
          · `data-act=""` 是**点不动的入口**（tabs() 里 off 那一档），本来就不该摸得到；
          · 被祖先 overflow 裁到整块看不见（信纸翻页翻出去的那几列），不是"被挡"，是"没画出来"。 */
    var hits = [], btns = document.elementFromPoint ? lay.querySelectorAll("[data-act]") : [];
    /* · ovl —— 灶前那一屏的三块常驻面板（笔记／读数／案上实物）两两不许相交。
       它们是各自 absolute 出来的，谁也不管谁：读数栏一长高就顶进笔记板下半截，
       而笔记板是不透明的 —— 「下一拍」那行等于白写。`hit` 只摸得到按钮，摸不到读数。 */
    var ovl = [], zp = [".z-notes", ".z-meters", ".z-tray"], a1, a2, q1, q2;
    for (i = 0; i < zp.length; i++) {
      q1 = lay.querySelector(zp[i]);
      if (!q1) continue;
      for (j = i + 1; j < zp.length; j++) {
        q2 = lay.querySelector(zp[j]);
        if (!q2) continue;
        a1 = q1.getBoundingClientRect(); a2 = q2.getBoundingClientRect();
        var ow = Math.min(a1.right, a2.right) - Math.max(a1.left, a2.left);
        var oh = Math.min(a1.bottom, a2.bottom) - Math.max(a1.top, a2.top);
        if (ow > 4 / k && oh > 4 / k)
          ovl.push(zp[i].slice(2) + "×" + zp[j].slice(2) + " " + Math.round(ow * k) + "x" + Math.round(oh * k));
      }
    }
    for (i = 0; i < btns.length; i++) {
      var b = btns[i], bs = window.getComputedStyle ? getComputedStyle(b) : null;
      if (!bs || bs.display === "none" || bs.visibility === "hidden" || +bs.opacity < 0.05) continue;
      if (!b.getAttribute("data-act")) continue;                    // 点不动的入口
      if (bs.pointerEvents === "none") continue;                    // 本来就不接点击
      var vr = visRect(b);
      if (vr.right - vr.left < 6 || vr.bottom - vr.top < 6) continue;  // 看不见，谈不上被挡
      var cx = (vr.left + vr.right) / 2, cy = (vr.top + vr.bottom) / 2;
      if (cx < 0 || cy < 0 || cx > sr.right || cy > sr.bottom) continue;
      var top = document.elementFromPoint(cx, cy), q = top;
      while (q && q !== document.body && !(q.getAttribute && q.getAttribute("data-act"))) q = q.parentNode;
      if (q === b) continue;
      hits.push(nm(b) + " 被 " + (q && q !== document.body ? "另一颗 " + nm(q) : nm(top)) + " 压住");
    }
    var bad = cut.slice(0, 6).concat(out.slice(0, 6).map(function (s) { return "out " + s; }))
      .concat(spill.slice(0, 2).map(function (s) { return "spill " + s; }))
      .concat(edge.slice(0, 2).map(function (s) { return "edge " + s; }))
      .concat(img.slice(0, 4).map(function (s) { return "img " + s; }))
      .concat(ovl.slice(0, 3).map(function (s) { return "ovl " + s; }))
      .concat(hits.slice(0, 6).map(function (s) { return "hit " + s; }));
    st.setAttribute("data-fault", bad.join(" | "));
    /* 顺手把**标题落在哪一格、用的什么色**也钉出来。字看不清看不清，只有拿截图像素去量，
       而"量哪一块"这件事引擎知道、脚本不知道 —— 所以引擎把它说清楚（设计坐标，未缩放）。 */
    var ink = [];
    /* `.plaque h1` 是舆图第二面叠在画里素牌上的州名，`.seal p` 是章末那五行小结，
       `.tiehead` / `.tielist .row` 是读帖那张纸上的题与配方行 ——
       它们和匾上的字是同一类东西：**底是画出来的，字是 HTML**，看不看得清只有拿截图像素去量。
       （章末那五行原本是淡金压亮天、对比 32，就因为不在选择器里，闸一声不响。） */
    var ts = lay.querySelectorAll(".onb h1, .onb p, .subw, .plaque h1, .seal p, .tiehead, .tielist .row, .cover h1, .cover .cvsub");
    for (i = 0; i < ts.length; i++) {
      var te = ts[i], tr = te.getBoundingClientRect(), tc = getComputedStyle(te);
      if (tr.width < 4 || tr.height < 4) continue;
      ink.push([Math.round((tr.left - sr.left) / k), Math.round((tr.top - sr.top) / k),
        Math.round(tr.width / k), Math.round(tr.height / k), tc.color].join(","));
    }
    st.setAttribute("data-ink", ink.join(" | "));
    return st.getAttribute("data-fault");
  }
  /* 元素**真正看得见**的那一块：把自己逐层与祖先的裁剪框求交。
     `#stage` 有 overflow:hidden，信纸的 `.scut` 也是 —— 不先算这一步，
     翻页翻出画外的列会被当成"被挡住"，而它其实是"没画出来"。 */
  function visRect(e) {
    var r = e.getBoundingClientRect(), n = e.parentNode;
    while (n && n.nodeType === 1 && n !== document.body) {
      var cs = getComputedStyle(n);
      if (cs && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
        var q = n.getBoundingClientRect();
        r = { left: Math.max(r.left, q.left), top: Math.max(r.top, q.top),
              right: Math.min(r.right, q.right), bottom: Math.min(r.bottom, q.bottom) };
      }
      n = n.parentNode;
    }
    return r;
  }
  function nm(e) {    var s = e.tagName.toLowerCase() + (e.className ? "." + String(e.className).trim().split(/\s+/)[0] : "");
    var p = e.parentNode;
    if (p && p.id !== "layer" && p.className !== undefined && p.tagName !== "BODY") s = nm(p) + ">" + s;
    return s.slice(0, 60);
  }
  function tx(s) { s = s.trim(); return s.length > 12 ? s.slice(0, 12) + "…" : s; }
  function fitOverflow() {
    var els = document.querySelectorAll("#layer .plate h1, #layer .plate p, #layer .onb h1, #layer .subw, #layer .stop b, #layer .stop i," +
      "#layer .seat .nm2, #layer .card .nm, #layer .card .note, #layer .intent .in b, #layer .intent .in em");
    for (var i = 0; i < els.length; i++) {
      var e = els[i], p = e.parentNode;
      if (!p) continue;
      /* 尺子要取**父净空与自己盒子**里更窄的那一条：`.card .note` 自己有 max-height + overflow:hidden，
         父级 `.in` 却比它宽得多 —— 只量父级就会「父级装得下、自己已经被切」，
         上街八张牌的摊子小字各被吃掉 8~61 px，验收全绿。 */
      var pw = Math.min(p.clientWidth || 1e9, e.clientWidth || 1e9);
      var ph = Math.min(p.clientHeight || 1e9, e.clientHeight || 1e9);
      var fs = parseFloat(window.getComputedStyle(e).fontSize) || 16, n = 0;
      while ((e.scrollWidth > pw + 1 || e.scrollHeight > ph + 1) && fs > 9 && n++ < 14) {
        /* 夹住 9：`fs > 9` 只挡整数起点，而 `max(12px, calc(...))` 常算出半号字
           （9.9 减 1 = 8.9）—— 10-10 证伪 C1 当场量到 8.9px，引擎自己声明的地板漏了。 */
        fs = Math.max(9, fs - 1); e.style.fontSize = fs + "px";
      }
    }
    fitShelf();
  }
  /* 博古架的开口是**量出来的定尺寸洞**，比原来那排整宽木格窄得多
     （最窄那格只有 44x59 px）。一个 span 缩字号救不了一对 span ——
     所以拿格子本体当尺子：格子溢出就把里面所有字一起降一档。 */
  var FIT_ERR = "";                         // 修正器自己崩了要能被闸看见
  var SHRUNK = 0;                       // 这一屏有几格木劄被降过档，由 data-shrink 说出去
  var STUCK = [];                       // 缩到底还装不下的那一格：名目 / 余量 / 最后字号，由 data-stuck 说出去
  function fitShelf() {
    var i, slots = document.querySelectorAll("#layer .panel .tag");
    SHRUNK = 0; STUCK = [];                        // 这一屏有几格被降过档，见 data-shrink
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], kids = s.querySelectorAll(".tk, .tv");
      if (!kids.length) continue;
      /* ⚠ 量之前先把悬浮介绍摘掉。`.tip` 是这一格里唯一**绝对定位**的孩子：
         232px 宽、四行字（~82px 高），压着 `top:50%` 往上下各溢出一截，而它自己 12px 写死、
         跟着字号缩不动 —— 于是 `scrollHeight > clientHeight` 恒真，下面那圈 18 次降档永远走满，
         名目与数被一路按到 8px 的地板。10-03 用户点名"里面的字号什么的大一些 我简直看不清"，
         CSS 把 13/14 提到 16/17，**运行时全被这一圈吃了回去**：屏幕上一直是 8px。
         这条洞是 10-08 拿 `data-tiny` 量出来的（8.0px 在 466 屏里出现 564 次）。 */
      var tips = s.querySelectorAll(".tip"), m;
      for (m = 0; m < tips.length; m++) tips[m].style.display = "none";
      for (var n = 0; n < 18 &&
        (s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1); n++) {
        for (var j = 0; j < kids.length; j++) {
          var k = kids[j], fs = parseFloat(window.getComputedStyle(k).fontSize) || 16;
          /* 地板与 `fitOverflow` 那一处（同一个 `fs > 9` 配 `Math.max(9, fs - 1)`）取同一个数：两条降档路子共用一档，
             验收才敢只写一条判据「屏幕上没有低于 9px 的字」。原先这里是 8，
             于是"引擎声明的地板"有两个数，而 8 那一档正是木札被按扁的那一格。 */
          if (fs > 9) k.style.fontSize = Math.max(9, fs - 1) + "px";  // 同上：半号字不许漏过地板
        }
      }
      /* 缩完再量一次余量，而且要在**把 `.tip` 恢复显示之前**量：那颗雷就是这一圈白缩 18 次的起因，
         放回来再量等于自己踩回去。这里要的数是"格子里那些字到底放平了没有"。
         与 SHRUNK 的分别：降过档不等于装得下（10-03 就是降到地板还没装下），
         装得下也不等于没降档（本来就只开这么小的洞）。判据该钉的是前者。 */
      var over = Math.max(s.scrollWidth - s.clientWidth, s.scrollHeight - s.clientHeight);
      if (over > 1) {
        var minfs = 0;
        for (j = 0; j < kids.length; j++) {
          var fz = parseFloat(window.getComputedStyle(kids[j]).fontSize) || 0;
          if (fz > 0 && (!minfs || fz < minfs)) minfs = fz;
        }
        STUCK.push(tx((kids[0].textContent || "").replace(/\s+/g, "")) +
          " 余" + Math.round(over) + "px@" + (Math.round(minfs * 10) / 10) + "px");
      }
      for (m = 0; m < tips.length; m++) tips[m].style.display = "";
      /* 降过档就记一笔。**为什么要有这个数**：地板提到 9 之后，"被按到 9px"这件事
         再也撞不到「低于 9px」那条线 —— 也就是说 10-03 那个 bug 现在能原地复活而字号闸全绿
         （10-09 证伪 A1 就是这么露出来的：摘掉 `.tip` 那两行，屏上回到 9px，闸一声不响）。
         所以真正要钉的是"这一格有没有被缩过"，不是"缩到几号以下"。 */
      if (n > 0) SHRUNK++;
    }
  }

  var _toast = null, _toastT = 0;
  function toast(msg) {
    var e = document.createElement("div");
    e.className = "toast"; e.innerHTML = msg;
    document.getElementById("layer").appendChild(e);
    if (_toast) _toast.parentNode && _toast.parentNode.removeChild(_toast);
    _toast = e;
    _toastT = 2600;
  }

  // ── 获得提示与成就：两个都不进 #layer（layer() 每次重绘会把它们抹掉），挂在 #stage 上 ──
  function popBox(id, cls) {
    var b = document.getElementById(id);
    if (!b) { b = document.createElement("div"); b.id = id; b.className = cls;
      document.getElementById("stage").appendChild(b); }
    return b;
  }
  function popPush(box, cls, html, keep) {
    var e = document.createElement("div");
    e.className = cls; e.innerHTML = html;
    box.appendChild(e);
    // 用 childNodes[0] 不用 firstChild —— 验收桩里的假 DOM 没有 firstChild，
    // removeChild(undefined) 什么也删不掉，那条 while 会在 Node 里死循环（真浏览器里反而正常）。
    // 上限四条：条子改成 25px 高的半透明细条之后，四条连间距 115px，
    // 锚点 158 还留着 43px 余量。（上一版收三条是因为那时一条有 66px，四条会顶出画外。）
    while (box.childNodes.length > 4) box.removeChild(box.childNodes[0]);
    // keep=0 表示不摘（#pops 那条验收路由要用）：无头 Chrome 的虚拟时间会一路跑到 6 秒，
    // 光冻住 CSS 淡出没用，JS 的摘除定时器照样会把它们全收走 —— 拍出来就是两个空容器。
    if (keep) setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, keep);
  }
  // 分类→配色。新增一类而忘了在这儿登记，字会退回鎏金（看不出来配错），
  // 所以 validate_cards.js 有一条断言盯着：popGain 用到的类名必须都在这张表里。
  var POP_CLS = { 银钱: "money", 食单: "dish", 清欢册: "verse",
    人情: "ren", 身体: "body", 物议: "yi",
    /* 「方子」与「食单」必须两种色：一个是"这道菜我吃过、帖上收了"，
       一个是"这一味我自己尝定了"。同色就等于告诉玩家同一件事发生了两次。 */
    方子: "recipe" };
  function popGain(k, v, hold) {
    popPush(popBox("pops", "pops"),
      "pop " + (POP_CLS[k] || "money") + (hold ? " hold" : ""),
      '<span class="k">' + k + '</span><b>' + v + '</b>', hold ? 0 : 3300);
  }
  function popAchv(r, hold) {
    popPush(popBox("achvs", "achvs"), "achv-pop" + (hold ? " hold" : ""),
      '<img src="' + artSrc(sealArt(DATA.chapter.seal.kind, true)) + '" alt="">' +
      '<div class="tx"><span class="kd">成就 · 得句</span><b>' + r.t + '</b>' +
      '<em>' + r.src + '</em></div>', hold ? 0 : 5400);
    sfx("seal");
  }
  var ACHV_SEEN = {};
  // 一进场就把「本来就成立」的那些记成看过：Steam 也不会为已经拿到的成就再弹一次
  function seedAchv() {
    var rows = achvRows(), i;
    ACHV_SEEN = {};
    for (i = 0; i < rows.length; i++) if (rows[i].hit) ACHV_SEEN[rows[i].k] = 1;
  }
  function checkAchv(hold) {
    var rows = achvRows(), i, popped = 0;
    for (i = 0; i < rows.length; i++) {
      if (!rows[i].hit || ACHV_SEEN[rows[i].k]) continue;
      ACHV_SEEN[rows[i].k] = 1; popAchv(rows[i], hold); popped++;
    }
    return popped;
  }
  var POP_BASE = null;
  function keysOf(o) { var a = [], k; for (k in o) a.push(k); return a; }
  /* `S.recipes` 的键是 `zhizhu` 这种 id，直接弹出来玩家看见的是英文 ——
     与清欢册那一条同一个坑（那边查 `DATA.lines`，这边查 `ZAO.BOOK`）。 */
  function recipeNames() {
    var out = [], k, i, bk = ZAO.BOOK || [], nm;
    for (k in S.recipes) if (S.recipes.hasOwnProperty(k) && S.recipes[k]) {
      nm = k;
      for (i = 0; i < bk.length; i++) if (bk[i].id === k) { nm = bk[i].nm; break; }
      out.push(nm);
    }
    return out;
  }
  function diffOf(a, b) { return b.filter(function (x) { return a.indexOf(x) < 0; }); }
  // 挂在 layer() 尾巴上：玩家看得见的那次状态变化一定伴随一次重绘，
  // 所以不必在每个发奖的地方点名 —— 点名的版本一定会漏掉后加的那几处。
  function popTick(hold) {
    var b = S.bars;
    var now = { m: b.银钱, d: keysOf(S.got), v: keysOf(S.verses),
      rcp: recipeNames(),
      ren: Math.round(b.人情), body: Math.round(b.身体), yi: b.物议 };
    if (POP_BASE) {
      var dm = now.m - POP_BASE.m;
      if (dm) popGain("银钱", (dm > 0 ? "+" : "−") + Math.abs(dm) + " 文", hold);
      /* 9-27 右栏换成五枚木札之后，人情／身体／物议 不再常驻 ——
         那它们就必须**每次变化都闪一条**，否则"从面板上拿掉"等于"玩家再也看不见"。
         借印扣多少、讲堂耗多少、伪作掉多少，全指着这一条。 */
      var dr = now.ren - POP_BASE.ren;
      if (dr) popGain("人情", (dr > 0 ? "+" : "−") + Math.abs(dr), hold);
      var db = now.body - POP_BASE.body;
      if (db) popGain("身体", (db > 0 ? "+" : "−") + Math.abs(db), hold);
      var dy = now.yi - POP_BASE.yi;
      if (dy) popGain("物议", (dy > 0 ? "+" : "−") + Math.abs(dy), hold);
      diffOf(POP_BASE.d, now.d).forEach(function (nm) { popGain("食单", nm + " 入册", hold); });
      diffOf(POP_BASE.rcp, now.rcp).forEach(function (nm) { popGain("方子", nm + " 尝定", hold); });
      // S.verses 的键是 rain／lone 这种短 id，直接把键弹出来玩家看见的是英文。
      // 册子里那一行印的是句子（renderBook 走 DATA.lines[k].t），这儿必须同源。
      diffOf(POP_BASE.v, now.v).forEach(function (k) {
        var L = (DATA.lines || {})[k];
        popGain("清欢册", (L && L.t ? L.t : k), hold);
      });
    }
    POP_BASE = now;
    checkAchv(hold);
  }

  function act(a, arg) {
    if (!a) return;
    if (a === "go") {
      if (arg === "court") { enterCourt(); }
      else if (arg === "stove") {
        newStove();
        if (zaoTie() && !S.read.done) {
          if (!S.flags.tieSeen && say("tieOpen", "go/stove")) { S.flags.tieSeen = true; return; }
          S.flags.tieSeen = true;
          S.screen = "tie"; renderTie();
        }
        else if (!S.flags.stoveAsked && say("stoveFirst", "go/stove2")) { S.flags.stoveAsked = true; }
        else { S.screen = "stove"; renderStove(); }
      }
      /* 「回帖再圈一遍」：漏圈一个动词，那一味在这章就永远锁着（配额查的是章级 `S.read[k]`）。
         没有这条回头路，玩家只看见"那一手用不了"，看不见为什么。 */
      else if (arg === "tie") {
        /* 没留下菜谱原文的章（定州/儋州）压根没有帖这一屏 —— 直接 renderTie 会拿 null.text 崩。 */
        if (!zaoTie()) { S.screen = "stove"; if (!S.stove) newStove(); renderStove(); return; }
        if (!S.stove) newStove();
        S.screen = "tie"; renderTie();
      }
      else if (arg === "street") { newStreet(); S.screen = "street"; renderStreet(); }
      /* 尝菜不挑锅：灶上有没有半成品都进得去 —— 它读的是 `S.notes`，不是 `S.stove`。
         这条很要紧：`repaint()`/哈希路由都要能在没起锅的屏上进它，否则截图验收只能拍到 hub。 */
      else if (arg === "taste") { S.screen = "taste"; renderTaste(); }
      else if (arg === "banquet") {
        newBanquet();
        if (say("seatTake", "go/banquet2")) return;
        S.screen = "banquet"; renderBanquet();
      }
      // court2 / stove2 / banquet2 ＝「开场白播完了，直接把这一屏画出来」，
      // 不能再指回 go/court，否则会重新进关、再播一遍开场白。
      // 冷启动（无头截图直接 #章/banquet2）时局面还没立，先补一个 init 再画 ——
      // 不补的话 renderBanquet 摸到 S.banquet 是 null 就抛，页面静静退回 hub，
      // 截图看着是"绿的"，其实拍的是另一屏。
      else if (arg === "banquet2") { if (!S.banquet) newBanquet(); S.screen = "banquet"; renderBanquet(); }
      // 话本层借席间那一套引擎（bnData 换表），屏名照旧 banquet —— 换屏名就会长出第二套发牌逻辑
      else if (arg === "huaben") {
        // 只有黄州摆了那一桌。入口 tab 本来就按 DATA.huaben 出现，这里挡的是手敲哈希与旧档：
        // 没有表还去 newBanquet("话本") 就是读 undefined.guests —— 页面不报错，只是点不动。
        if (!DATA.huaben) { S.screen = "hub"; renderHub(); return; }
        newBanquet("话本");
        if (say("hbOpen", "go/huaben2")) return;
        S.screen = "banquet"; renderBanquet();
      }
      else if (arg === "huaben2") {
        if (!DATA.huaben) { S.screen = "hub"; renderHub(); return; }
        if (!S.banquet) newBanquet("话本");
        S.screen = "banquet"; renderBanquet();
      }
      else if (arg === "court2") { if (!S.court) newCourt(); S.screen = "court"; renderCourt(); }
      else if (arg === "stove2") { if (!S.stove) newStove(); S.screen = "stove"; renderStove(); }
      else if (arg === "book") { S.bookWhich = "dishes"; S.screen = "book"; renderBook("dishes"); }
      else if (arg === "verses") { S.bookWhich = "verses"; S.screen = "book"; renderBook("verses"); }
      else if (arg === "mail") { renderMail(S.mailTo); }
      else if (arg === "map") { S.screen = "map"; renderMap(); }
      else if (arg === "finale") { S.screen = "finale"; renderFinale(); }
      // 章首对白播完落回今日，走的是**这一条具名的**分支，不是兜底 else：
      // 兜底那条对任何拼错的 arg 都长成「回 hub」，谁也无法分辨它是设计还是事故（P0-1 的教训）。
      else if (arg === "hub") { S.screen = "hub"; renderHub(); }
      else { S.screen = "hub"; renderHub(); }
    } else if (a === "chap") {
      if (switchChapter(arg)) { location.hash = arg; renderHub(); }
      else toast("这一章还没开工");
    /* 重走本章要按两下（问7①）：第一下只弹话，第二下才真清。
       一刀切下去会带走时辰、这一章的牌与两本册子 —— 那是"重开"，不该是一次单击。 */
    } else if (a === "rechap") {
      if (S.rechap !== arg) { S.rechap = arg; toast("再点一次就从头再走「" + DATA.chapter.name +
        "」：时辰、手牌、食单与清欢册都会清空"); renderMap(); return; }
      S.rechap = "";
      if (switchChapter(arg)) { location.hash = arg; renderHub(); }
    } else if (a === "play") {
      if (S.screen === "court") playCourt(arg);
      else if (S.screen === "stove") playStove(arg);
      else if (S.screen === "street") buy(parseInt(arg.slice(1), 10));
      else if (S.screen === "banquet") serve(parseInt(arg.slice(1), 10));
    } else if (a === "finishCourt") { finishCourt(); }
    else if (a === "finishStove") { finishStove(); }
    else if (a === "finishBanquet") { finishBanquet(); }
    else if (a === "finishStreet") { finishStreet(); }
    else if (a === "dnext") { dlgNext(); }
    else if (a === "dskip") { dlgDone(); }
    /* 「‹ 返回」＝真返回（问6①）：回打开这段对话前的那一屏，**不执行 then**。
       原来它和「跳过剧情」走同一条 dlgDone()，于是"返回"会把玩家顺着续段推进下一关 ——
       读信的开场白按返回直接落到信屏，写的和做的两回事。 */
    else if (a === "dback") {
      DLG.key = ""; DLG.i = 0; DLG.then = null;
      S.screen = _dlgFrom; repaint(_dlgFrom);
    }
    else if (a === "pick") { pickGuest(arg); }
    else if (a === "quip") { sayAside(); }
    else if (a === "hush") { hushAside(); }
    else if (a === "mail") { sfx("paper"); renderMail(); }
    else if (a === "wall") { sfx("paper"); renderWall(); }
    else if (a === "wallby") { S.wallBy = arg || ""; renderWall(); }
    else if (a === "openmail") { sfx("paper"); renderMail(arg); }
    else if (a === "reply") { var pa = String(arg).split(":"); reply(pa[0], parseInt(pa[1], 10)); }
    // 「挑一句回」不能叫 pick —— 那个名字早给席间的"换靶"占了，撞上是静默的：点了只会重排手牌
    else if (a === "pickmail") { S.lpicking = true; S.lpage = 0; renderLetter(arg); }
    else if (a === "unpickmail") { S.lpicking = false; renderLetter(S.mailTo); }
    else if (a === "lpage") { sfx("paper"); S.lpage = Math.max(0, (S.lpage || 0) + parseInt(arg, 10)); renderLetter(S.mailTo); }
    /* 册子翻页不重描：重描会把叠层抹掉（规矩与案情是盖在别的屏上的，S.screen 还停在来源屏），
       而这一翻只改"哪几行画出来" —— 直接量、直接藏，屏还是那张屏。
       纸声要等**页真动了**才放：灰掉的那一枚按下去什么也没变，不该有反馈。 */
    else if (a === "bpage") {
      var bp0 = S.bpage || 0;
      S.bpage = Math.max(0, bp0 + parseInt(arg, 10));
      fitBookPages();                        // 越界由它夹回来（共几叶只有量得出来）
      if ((S.bpage || 0) !== bp0) sfx("paper");
    }
    else if (a === "nextmail") { S.lpicking = false; S.lpage = 0; renderMail(); }
    else if (a === "disperse") { endBanquet(); }
    else if (a === "pass") { S.court.round++; if (S.court.round > DATA.court.rounds) endCourt(); else { drawHand(); renderCourt(); } }
    else if (a === "mark") { markTie(arg); }
    else if (a === "light") { lightStove(); }
    else if (a === "leave") { if (S.screen === "tie") { S.screen = "hub"; renderHub(); return; } S.shichen++; S.stove = null; S.screen = "hub"; renderHub(); }
    else if (a === "leave2") leaveStreet();
    else if (a === "rules") { _screen = S.screen; renderRules(); }
    else if (a === "achv") { _screen = S.screen; renderAchv(); }
    /* 封面那两枚：「开始」在有档时要先确认再覆盖（玩到惠州的人不该被一下回到黄州），
       「继续」走的就是刷新那条老路（loadGame 把 S 摆回档里那一章的今日）。 */
    else if (a === "coverstart") {
      if (saveInfo() && !S.coverAsk) { S.coverAsk = 1; renderCover(); return; }
      S.coverAsk = 0;
      try { if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY); } catch (e) { }
      /* 「开始」＝从黄州重新出发，所以章也要**换回去**：
         有档时引擎已经 loadGame 到惠州了，只清档不换章的话，
         玩家按了"重新开始"却仍然站在惠州——这条是新断言当场抓出来的。 */
      useChapter(JOURNEY[0].key);
      reset(); S.arrive = true; S.screen = "hub"; renderHub();
    }
    else if (a === "coverresume") {
      S.coverAsk = 0;
      if (loadGame()) renderHub(); else renderCover();
    }
    /* 引导的「下一步／明白了／跳过」都走这一手：越界（第三步再往前）一律落成 -1，
       这样"看完"与"跳过"在存档里是同一个值，不必两处各记一份。 */
    else if (a === "tut") {
      sfx("paper");
      S.tut = parseInt(arg, 10);
      if (!(S.tut >= 0 && S.tut < TUT.length)) S.tut = -1;
      if (S.screen === "hub") renderHub();
    }
    else if (a === "case") { _screen = S.screen; renderCase(); }
    else if (a === "back") { SND_OPEN = 0; repaint(_screen); }   // 回**来源屏**，不是"只认堂上、其余落今日"
    else if (a === "end") { sfx("seal"); if (say("seal", "end2")) return; S.screen = "end"; renderEnd(); }
    else if (a === "end2") { S.screen = "end"; renderEnd(); }
    else if (a === "gochap") { goChapter(); }
    else if (a === "next") {
      var nx2 = nextChapter();
      if (nx2 && nx2.on) {
        // 有下一程的每一站都先落在路上那一屏；只有验收（nodlg／demo）才直接翻书
        if (!NODLG && nx2.hop) { S.screen = "travel"; renderTravel(); return; }
        switchChapter(nx2.key); location.hash = nx2.key; renderHub();
      }
      else if (nx2) { S.screen = "map"; renderMap(); toast(nx2.nm + "章尚未开工：先把" + DATA.chapter.name + "走完"); }
      // 最后一章走完 → 终局那一屏（三枚章并排在一张纸上）
      else if (S.seals[CHAPTER_KEY]) { S.screen = "finale"; renderFinale(); }
      else { S.screen = "map"; renderMap(); }
    }
    // 不重绘：每屏自己的 render 函数签名不一（renderBook 还要带 dishes/verses），
    // 为一个小开关铺一层分发不值当。给一声 toast，标签等下一次自然重绘自己就变了。
    /* 「静音」这条老路由还认（老闸不断）：一键把两轨全按下去。
       页签那一格现在开的是声设置弹层（act "snd"）。 */
    else if (a === "mute") { sfxMute(!SND.mute); toast(SND.mute ? "静音了" : "开了声"); }
    else if (a === "snd") { _screen = S.screen; SND_OPEN = 1; renderSnd(); }
    else if (a === "credit") { _screen = S.screen; renderCredit(); }
    else if (a === "sndk") { sndKey(arg); }
    else if (a === "again") { reset(); renderHub(); }
    /* 终局后的自由行：盖完三枚章还想留下的玩家，把儋州的六格时辰还给他。
       锅要倒掉（S.stove 是上一局的残局），时辰清零 —— 之后该跑的还得跑，
       时辰用尽今日屏会再给「章末盖章」，盖完还是终局那一屏，闭环自己咬合。 */
    else if (a === "free") { S.shichen = 0; S.stove = null; S.screen = "hub"; renderHub(); }
    /* 开场演示的两下：盖下去（只余空心朱框），然后出门。
       不进账、不掉时辰 —— 它是一次演示，不是一关。 */
    else if (a === "edict") { S.edict = 1; sfx("seal"); renderEdict(); }
    else if (a === "edictout") { edictDone(); S.edict = 0; S.screen = "hub"; renderHub(); }
    // 舆图屏转个方向：只换这一屏画哪一幅，不动章、不动账
    else if (a === "mapface") { S.mapFace = arg === "chap" ? "chap" : "trip"; renderMap(); }
    /* ── 尝菜屏的三手 ─────────────────────────────────
       换菜 / 拨算盘 / 尝这口。都不掉时辰：这一屏是"坐下来算账"，
       花的是银钱，不是时间 —— 与上街、读帖同一类。 */
    else if (a === "tsel") { S.dial = { d: arg }; renderTaste(); }
    else if (a === "tdial") {
      var tp = String(arg).split(":"), dg = ZAO.DIAL[tp[0]];
      if (!dg) return;
      var cur = tasteDial(tp[0], dg);
      S.dial[tp[0]] = cur + (tp[1] === "-" ? -dg[2] : dg[2]);
      renderTaste();
    }
    else if (a === "taste") {
      var r = tasteSel(), g = ZAO.DIAL[arg];
      if (!r || knownOf(r) || !g) return;
      if (S.bars["银钱"] < ZAO.REC_FEE) { toast("银钱不够这一口（要 " + ZAO.REC_FEE + " 文）"); sfx("reject"); return; }
      var pv = ZAO.probeAt(r, arg, tasteDial(arg, g));
      if (!pv) return;
      /* 先把"尝完会变成什么样"算一遍：一个字没变，就是这一格刚尝过 ——
         不扣钱、不写流水，把理由说出来就行。用户报的第二条正是这个：
         同一个读数再点一口，那行话原样不动，等于花 6 文买一句重复的话。 */
      var was = JSON.stringify(S.notes),
          nxt = ZAO.notesAdd(clone(S.notes), r.id, [pv]);
      if (JSON.stringify(nxt) === was) {
        toast("这一格刚尝过了：拨一下算盘换个读数，才尝得出新东西");
        sfx("reject");
        return;
      }
      S.bars["银钱"] = clamp(S.bars["银钱"] - ZAO.REC_FEE, 0, 999);
      S.notes = nxt;
      zn("尝" + DIM_NM[arg] + " " + pv.v + "：" + pv.w, "taste");
      sfx("taste");
      renderTaste();
    }
    else if (a === "trec") {
      var rr = tasteSel();
      if (!rr || knownOf(rr)) return;
      if (!ZAO.recDone(ZAO.recState(S.notes, rr.id, rr.need))) {
        toast("还有味没夹死 —— 定方等于把猜的写进食单"); sfx("reject"); return;
      }
      S.recipes[rr.id] = true;
      sfx("seal");
      zn("方子记下了：" + rr.nm + " —— 回灶前，那一锅的区间就摊开了", "taste");
      renderTaste();
    }
  }

  document.addEventListener("click", function (e) {
    var n = e.target;
    while (n && n !== document.body && !(n.getAttribute && n.getAttribute("data-act"))) n = n.parentNode;
    if (!n || n === document.body) return;
    act(n.getAttribute("data-act"), n.getAttribute("data-arg") || "");
  });

  /* ── #章/屏/full —— 把这一章**玩到最后那一格**摆出来给验收器看 ──────────
     一百六十九屏全是冷启动：食单九行全「未见」、清欢册全空、银钱永远三位数、
     信一封没回、插一句一条没说。而会长、会挤、会溢的那些东西，
     恰恰只在玩到中后段才出现 —— 一行字被切掉、一格木牌放不下四位数。
     这一条不是作弊：它不改判定，只把**已经存在**的终态提前摆出来让像素量得到。 */
  function fillAll() {
    var bk = DATA.book || {}, ls = DATA.letters || [];
    (bk.dishes || []).forEach(function (d) { S.got[d.nm || d] = true; });
    (bk.verses || []).forEach(function (v) { S.verses[v.k || v] = true; });
    // 插一句全部说过（含那条伪作），清欢册里要长出"未得／已得／伪作"三种色
    (DATA.asides || []).forEach(function (q, n) { S.quips.push({ i: n, t: q.t, src: q.src, lie: !!q.lie }); });
    S.aside = (DATA.asides || []).length;
    // 只回**这一局收得到的**，另一支不该同时挂出来（与 #章/wall/kuang 同一条规矩）。
    // 留一封没回的：全回完 `pending()` 就空了，`#章/letter` 会静默退回 hub，
    // 那三屏（读信／挑一句／已回）在深状态这一趟里反而拍不到 —— 第一版就踩了这个。
    var keep = null;
    ls.forEach(function (L) {
      if (!mailOpen(L)) return;
      if (keep === null) { keep = L.id; return; }
      if (!S.replied[L.id]) S.replied[L.id] = L.replies[0].k;
    });
    /* 尝菜屏的三种桌景状态要在两趟里都拍得到（与上面"留一封没回的信"同一条理由）。
       第一道留白＝冷桌与「还差 5 味」那一句；最后一道夹死但**不定方**，
       这样 `ok` 那张桌景与那颗「定方」按钮才有人拍到（写了 `S.recipes` 钮就消失）。
       读数一律拿模型自己的 `probeAt` 落在真区间中点 —— 手搓数字会造出
       "看着锁住、其实三格里还活着两格"的假深状态。 */
    var tds = ZAO.dishesOf(CHAPTER_KEY), ti, tk, pv, nv, g;
    S.notes = {};
    for (ti = 1; ti < tds.length; ti++) {
      if (tds[ti].known) continue;
      for (tk = 0; tk < ZAO.RECDIMS.length; tk++) {
        if (ti < tds.length - 1 && tk > 1) break;      // 中间那道只灌两味
        nv = (tds[ti].need || {})[ZAO.RECDIMS[tk]];
        if (!nv) continue;                             // 本章没这味（定州无油无酱、儋州无醋）
        /* 中间那道：第一味往区间**外侧**探一口 —— 只留下单侧读数，那一格就是 `part`
           （写的正是「下限在它之上／还剩几格合得上」这句话，最该被拍到）；
           第二味落在中点，三格里只剩真区间 ⇒ `ok`。外侧够不着的退回中点。 */
        pv = null;
        g = ZAO.DIAL[ZAO.RECDIMS[tk]];        // 补丁二原来漏了这一行：g 只声明没赋值
        if (ti < tds.length - 1 && tk === 0) {
          if (nv[0] - 1 >= g[0]) pv = ZAO.probeAt(tds[ti], ZAO.RECDIMS[tk], nv[0] - 1);
          else if (nv[1] + 1 <= g[1]) pv = ZAO.probeAt(tds[ti], ZAO.RECDIMS[tk], nv[1] + 1);
        }
        if (!pv) pv = ZAO.probeAt(tds[ti], ZAO.RECDIMS[tk], Math.round((nv[0] + nv[1]) / 2));
        if (pv) S.notes = ZAO.notesAdd(S.notes, tds[ti].id, [pv]);
      }
    }
    if (tds.length > 1) S.dial.d = tds[tds.length - 1].id;   // 深状态那一屏停在夹死那道
    S.read.done = true;
    S.kongYin = 5;                                   // 跨章的债：章末与定州那一屏要带着它画
    S.seals[CHAPTER_KEY] = { nm: DATA.chapter.name, t: "试盖", got: true, score: 31, yin: 5 };
    // 数值取**最宽与最窄两端**：四位数银钱压木牌、身体见底的消渴疾措辞、物议负数
    S.bars.银钱 = 1280; S.bars.身体 = 7; S.bars.人情 = 143; S.bars.物议 = -28; S.bars.火候 = 100;
    S.shichen = S.maxShichen;                        // 时辰用尽：右栏那枚天色要落到「夜」那一档
  }

  window.addEventListener("resize", scale);
  setInterval(function () {
    if (_toast) { _toastT -= 400; if (_toastT <= 0) { if (_toast.parentNode) _toast.parentNode.removeChild(_toast); _toast = null; } }
  }, 400);

  reset(); scale();
  /* 带哈希的一律是验收路由（138 条截图、#章/demo、#sfxtest…），那种跑法既不读档也不回写。
     不这样做会同时犯两个错：玩家的档让 #章/demo 拍到另一章，而跑完一遍验收把档覆盖成
     「儋州刚开局」—— **丢档比没档糟**，所以这道闸比存档本身更要紧。 */
  NO_SAVE = !!(location.hash || "").replace(/^#/, "");
  /* 「从头再玩」是 东坡行旅\从头再玩.bat 那一下双击，它只比正常起机多带一个 ?fresh。
     清档必须排在 loadGame 之前；而清完照旧会写 —— 写回去的是这一局新的黄州，不是旧档。
     token 用 ASCII：中文查询串进 URL 会被 percent-encode，`location.search` 里就不是那几个字了。
     为什么要这个口：分支信墙的设计是「没走的那条路不出现」，想看另一条只能重开一局，
     而让玩家为了一次重开去按 F12 敲 localStorage，等于把改版要表达的东西锁在控制台后面。 */
  var FRESH = /[?&]fresh\b/.test(location.search || "");
  if (FRESH) {
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY); } catch (e) { }
  }
  /* 冷启动必须播章首白（审计 P1-3）：`S.arrive` 原来只在 `switchChapter()` 里置位，
     而"双击、无档、无哈希"这条**玩家真正走的路**一步都不经过它 —— 每个新玩家开局落在
     今日屏，全游戏的第一场戏被跳过。读档不重播（那是回来的人）。 */
  if (!loadGame()) S.arrive = true;
  /* 不带哈希（玩家那一下双击）才先落在封面上；带哈希的一律是验收路由，
     它们要的是"某一屏本来长什么样"，直接进那一屏，别被封面拦成两百张同一张图。 */
  sndLoad();                                 // 声设置先归位再画第一屏：封面曲的音量不能等玩家点开弹层才对
  if (NO_SAVE) renderHub(); else renderCover();
  if (FRESH) toast("已清空存档 · 从黄州重新出发");
  // 开发用钩子：无头截图与自动化验收直接调 DP.act / DP.state，不必模拟点击
  window.DP = { act: act, state: function () { return S; }, play: function (a) { act("play", a); },
    /* 引导要点亮哪几块，验收器要能照着同一张表查 —— 别在验收器里另抄一份选择器，
       那份一定会漂（只开测量用的口，不碰判定；与 tick/stoveOn 同一条路子）。 */
    tutSteps: function () { return TUT.map(function (t) { return t.sel; }); },
    read: readTie, fb: imgFallback, sfx: sfx, mute: sfxMute, sfxStats: function () { return SFX_TEL; },
    /* 声设置这条线只开测量用的口，不碰判定（与 tick/stoveOn 同一条路子）：
       snd 读 SND 现值；musFor/musNow 让验收器问"这一屏该唱哪支/现在唱哪支"；
       musStats 看"哪支真的被点过名"。 */
    snd: function () { return SND; }, sndKey: sndKey,
    musFor: musFor, musNow: function () { return MUS_NOW; }, musStats: function () { return MUS_TEL; },
    /* 真浏览器才有意义的一口：封面曲到底**正在响**没有（autoplay 被拦、文件 404、
       musVol 为 0 都会表现为"该唱没唱"）。Node 桩里没有 Audio，恒 false —— 它归 check_audio 管。 */
    musPlaying: musPlaying,
    /* nodlg(v)：把「一次性过场白全跳过」这个验收开关对外开个口。
       没这个口，真人模式（对白一句句播）就永远没法在 Node 里跑 —— 而 P0-1 那个
       来信死循环正是只有真人模式才踩得到的东西（engine_harness 有一段专门验它）。 */
    nodlg: function (v) { NODLG = !!v; return NODLG; }, myName: myName,
    /* tick(n)：手动让锅走 n 拍 —— 决策⑧那半句"harness 用 DP.tick 手动走拍"之前没挂上。
       Node 桩里 setInterval 是 `() => 0`，没有这个口，"活锅"这一条在验收里根本不可测。 */
    tick: function (n) { n = n || 1; while (n-- > 0) potBeat(); return S.stove ? S.stove.turn : -1; },
    /* 验收专用：把灶前钉在**指定那道菜**上重画一遍。
       没有这个口，"未录方的锅不印区间、录过的印"这条只能靠 newStove 随机挑到谁去碰，
       那等于一条会随天气变绿的断言（与 tick/potLive 同一条路子：只开测量用的口，不碰判定）。 */
    stoveOn: function (id) {
      var ds = ZAO.dishesOf(CHAPTER_KEY), i;
      for (i = 0; i < ds.length; i++) if (ds[i].id === id) {
        S.stove = ZAO.newPot(ds[i]); S.zao = []; S.screen = "stove"; renderStove();
        return ds[i].id;
      }
      return null;
    },
    potLive: function (v) { LIVE_POT = !!v; return LIVE_POT; } };
  // #章 / #章/界面 直接进（无头截图用）：#dingzhou、#dingzhou/court、#court
  var hh = (location.hash || "").replace(/^#/, "").split("/");
  NODLG = hh.indexOf("nodlg") >= 0;
  /* /full ＝ 把这一章填到"玩到中后段"那一格再画（见 fillAll 那段注释）。
     与 nodlg 同一条路子：它是**哈希上的一次性开关**，不碰判定、不写档。 */
  var FULL = hh.indexOf("full") >= 0;
  /* #章/stove/live —— 唯一放行活锅定时器的验收路由（LIVE_POT）。
     默认带哈希的跑法不放行：虚拟时间会在一屏截图里把八拍全烧完，拍到的永远是糊锅那一格。 */
  LIVE_POT = hh.indexOf("live") >= 0;
  hh = hh.filter(function (x) { return x !== "nodlg" && x !== "full" && x !== "live"; });
  var hScr = hh[1] || (CHAPTERS[hh[0]] ? "" : hh[0]);
  if (CHAPTERS[hh[0]] && switchChapter(hh[0]) && !hScr) { if (FULL) fillAll(); renderHub(); return; }
  if (FULL) fillAll();
  if (hScr === "demo" || hh[1] === "demo") demo();
  else if (hScr === "all" || hh[0] === "all") demoAll();
  // #sfxtest —— 真浏览器里把四章一路点完，然后把音效遥测打进 DOM 给无头 Chrome 回读。
  // demoAll() 是同步的，所以跑完这一行，所有该响的都响过了。
  else if (hScr === "sfxtest" || hh[0] === "sfxtest") {
    demoAll();
    dumpTel();
  }
  // #sfxsweep —— 不为了通关好看，只为了一个数：清单里这 20 支，游戏真跑起来**能响到几支**。
  // #sfxtest 看不见 lid／taste／paper：贪心自动机不会打「罨火」「尝味」那两张，
  // nodlg 开关又把对话整段压掉，而翻页声只长在 dlgNext() 上。
  else if (hScr === "sfxsweep" || hh[0] === "sfxsweep") {
    sfxSweep();
    dumpTel();
  }
  else if (hScr === "wall") {
    S.shichen = 5;
    /* 分支必须两屏都拍得到。`#章/wall/kuang` ＝ 把所有能回「旷」的都回旷，
       于是这一局收得到的是马正卿那一支；`/hui` 是参寥子那一支。
       不这么开一条路，验收只会覆盖默认那一支，另一支有没有接上没人知道。 */
    var WK = { kuang: "旷", hui: "灰", tao: "逃", zhuang: "壮" };
    var wk = hh[2] || "", ls0 = DATA.letters || [], ii0;
    if (wk === "one") { var pw = pending(); if (pw[0]) S.replied[pw[0].id] = pw[0].replies[0].k; }
    else if (WK[wk]) for (ii0 = 0; ii0 < ls0.length; ii0++) {
      // 只回**这一局收得到的**：照单全收会把另一支也标成已回，两条分支就同时挂出来了
      if (!mailOpen(ls0[ii0])) continue;
      if ((ls0[ii0].replies || []).some(function (x) { return x.k === WK[wk]; }))
        S.replied[ls0[ii0].id] = WK[wk];
    }
    renderWall();
  }
  else if (hScr === "letter") {
    S.shichen = 5;
    /* 三种状态都要能单独拍到：读信 / 挑一句 / 已回。
       不这么做的话验收只覆盖第一态，"点下去才出现的东西"（三个候选、那枚戳）永远是盲区。 */
    var lp = hh[2] || "", ps0 = pending(), L0 = ps0[0];
    if (L0 && lp === "pick") { S.mailTo = L0.id; S.lpicking = true; S.screen = "letter"; renderLetter(L0.id); }
    else if (L0 && lp === "replied") {
      S.replied[L0.id] = L0.replies[0].k; S.mailTo = L0.id;
      S.screen = "letter"; renderLetter(L0.id);
    }
    else renderMail();
  }
  // #章/travel —— 路上那一屏要先有「已盖下的章」才进得去（renderTravel 读的是 nextChapter）。
  // 补一枚假的章不是作弊：这一屏的文案与图全部从 JOURNEY 现读，跟章末那一枚无关。
  else if (hScr === "travel") {
    S.seals[CHAPTER_KEY] = { nm: DATA.chapter.name, t: "试盖", got: true, score: 12, yin: 0 };
    S.screen = "travel"; renderTravel();
  }
  // 「插一句」要过了第一个时辰才冒得出来，截图时先把时辰拨一格
  /* #章/aside —— 这一条以前只是把时辰拨到 1 就 renderHub。
     但来信提醒与「插一句」**共用同一块匾位**（`renderMailNote() || renderAside()`），
     而时辰 1 正好有一封到期 —— 于是这条路由拍到的永远是那封信，
     插一句那一屏从来没进过两百多张图（屏名都是 hub，`data-screen` 分不出谁赢）。
     所以这里先把已到期的信统统回掉，逼这一屏落到插一句上。 */
  else if (hScr === "aside") {
    S.shichen = 1;
    pending().forEach(function (L) { S.replied[L.id] = L.replies[0].k; });
    renderHub();
  }
  /* #章/tut/<第几步> —— 三步都要单独拍得到。只拍第一步的话，
     「下一步点了不推进」与「第三步根本画不出来」这两种坏都没有图能证明
     （与信三态、开场两态同一条理由）。不传步号就是第一步。 */
  /* #章/cover 与 #章/cover/saved、#章/cover/ask —— 封面那三态都要单独拍得到。
     只拍第一态的话，「继续」亮着写的是哪一章、「按下开始要先确认覆盖哪一局」这两句话
     就永远没有图能证明（与信三态、开场两态同一条理由）。 */
  else if (hScr === "cover") {
    var cv = hh[2] || "";
    if (cv === "saved" || cv === "ask") COVER_FAKE = CHAPTER_KEY;
    if (cv === "ask") S.coverAsk = 1;
    renderCover();
  }
  else if (hScr === "tut") {
    TUT_FORCE = 1;                    // 带哈希的路由本来一律不亮，这一条是特意要看它才来的
    S.tut = hh[2] === undefined ? 0 : (parseInt(hh[2], 10) || 0);
    renderHub();
  }
  /* #章/edict 与 #章/edict/2 —— 开场那枚空印的**两态**都要拍到。
     只拍第一态的话，"盖下去是空的"这个结果永远没有图能证明（与信三态同一条理由）。 */
  else if (hScr === "edict") { S.edict = hh[2] === "2" ? 1 : 0; S.screen = "edict"; renderEdict(); }
  // #pops —— 验收用：一次挂满获得条与成就卡。带 /real 就走**真实计时**（会淡掉），
  // 用来验"三秒够不够读完、堆到第三条会不会顶出画外"；不带就冻结，好让无头 Chrome 拍得到。
  else if (hScr === "pops") {
    var live = hh.indexOf("real") >= 0;
    renderHub();
    // 四类各一条，正好铺满上限，好让人一眼比出四种分类色
    popGain("银钱", "+5 文", !live);
    popGain("食单", "东坡肉 入册", !live);
    popGain("清欢册", "一蓑烟雨任平生。", !live);
    popGain("人情", "徐君猷 +3", !live);
    (DATA.achv || []).slice(0, 2).forEach(function (a) {
      popAchv({ t: a.t, src: a.src, k: "__demo" }, !live);
    });
  }
  // 读帖是灶前的第一段，得先立一锅才进得去
  // #章/场景 之外，还允许 #章/某场对话 直接进（验收要逐场拍脸）；
  // 第三段是句序 —— #章/对话键/3 拍到第 4 句，否则只能拍到开口那一句
  else if (hScr === "dlg" || (DATA.dlg || {})[hScr]) {
    /* 两种写法都要认：`#章/<对话键>/<句序>` 与验收表实际发的 `#章/dlg/<对话键>`。
       原来这一条只把 hScr（="dlg"）当键去查，查不到就静默退回 "arrive" ——
       于是**二十二场对话拍出来是同一张脸同一句诗**，而 data-screen 照抄 "dlg"，
       验收一路绿。名字在撒谎、戳却不说谎，这一类已经栽过两回（g_court 那次）。 */
    var dk = hScr === "dlg" ? (hh[2] || "arrive") : hScr;
    DLG.key = (DATA.dlg || {})[dk] ? dk : "arrive";
    DLG.i = Math.min((hScr === "dlg" ? hh[3] : hh[2]) | 0, (DATA.dlg[DLG.key] || []).length - 1);
    DLG.then = null;
    S.screen = "dlg"; renderDlg();
  }
  else if (hScr === "tie") { newStove(); if (zaoTie()) { S.screen = "tie"; renderTie(); } else act("go", "stove"); }
  // 案卷/规则要先立一副堂上局面才拍得到（它们是二级的叠层，不是 go 目标）
  /* 但叠层真正的入口有四处（堂上／读帖／灶前／席间），而「返回」坏得最狠的那三条恰恰是后三处
     —— 只拍 `#章/rules` 这一条等于没拍。三段式 `#章/<来源屏>/rules(或 case)` 从来源屏进去再叠层，
     验收断言的是**叠层前后的 data-screen 必须相等**（相等＝来源屏没被换掉＝返回回得去）。 */
  else if (hh[2] === "rules" || hh[2] === "case") {
    var ovSrc = hh[2], ovScr = hh[1];          // #章/<来源屏>/rules(或 case)
    if (ovScr === "stove" || ovScr === "stove2" || ovScr === "tie") {
      newStove();
      S.screen = (ovScr === "tie" || (ovScr === "stove" && zaoTie())) ? "tie" : "stove";
      if (S.screen === "tie" && !zaoTie()) S.screen = "stove";   // 定州/儋州没有帖，那条路由只能落在灶上
      if (S.screen === "tie") renderTie(); else renderStove();
    }
    else if (ovScr === "banquet") { newBanquet(); S.screen = "banquet"; renderBanquet(); }
    else { newCourt(); S.screen = "court"; renderCourt(); }
    act(ovSrc);
  }
  else if (hScr === "case" || hScr === "rules") { newCourt(); S.screen = "court"; act(hScr); }
  // 成就墙是今日屏的一枚入口，不是 `go` 的目标：哈希路由要自己走那一条 act
  else if (hScr === "achv") { act("achv"); }
  // 声设置与制作授权同为覆盖屏入口：哈希路由自己走那一条 act（与 achv 同一条路子）
  else if (hScr === "snd") { act("snd"); }
  else if (hScr === "credit") { act("credit"); }
  /* #章/jing —— 「被破那一拍」的样子必须单独拍得到：直接摆出 `foeE="jing"` 再画。
     不这么做的话验收只覆盖常态那一张，换表情有没有接上没人知道
     （与信三态、开场两态同一条理由）。这不改判定，只改这一屏画成什么样。 */
  else if (hScr === "jing") { newCourt(); S.court.foeE = "jing"; S.court.foeHit = true;
    S.screen = "court"; renderCourt(); }
  /* 册子第二叶：翻页这件事要拍到才算数。只拍第一叶的话，「下一叶根本点不动」与
     「翻过去是空白」这两种坏都查不出来 —— 而它们正是 display:none 那套最容易犯的。 */
  else if (hScr === "verses" && hh[2] === "p2") { act("go", "verses"); act("bpage", "1"); }
  /* #章/map/chap —— 舆图那一屏的第二面。与 edict 两态同一条理由：
     只拍「全行旅」那一面的话，"本章那一幅的素牌上叠着州名"这件事永远没有图能证明。 */
  else if (hScr === "map" && hh[2] === "chap") { S.mapFace = "chap"; act("go", "map"); }
  else if (hScr) act("go", hScr);

  // 开发用：按验收过的通关线自动走完**当前章**，好让无头 Chrome 拍到章末那一屏。
  // 一律从模型现读现算，不写死黄州的手法与件数 —— 定州那案上根本没有油盐酱。
  function readTie() {
    // 贪心玩家＝会去读帖的玩家：把动词全圈了再开火
    if (S.screen !== "tie" || !S.stove) return;
    tieMarks().forEach(function (m) { if (!S.stove.read[m.act]) act("mark", m.act); });
    act("light");
  }
  /* 通关线就是模型里那份 nextMove —— tools/stove_greedy.js 验的也是它。
     自动机烧得成，玩家看着案上数字才算得出来；这条心法从牌桌搬到了灶上。
     循环条件带上 S.stove.over：结算之后 S.stove 还要留着（对话与 finishStove 要用），
     不带上它就会对着已出锅的锅再补一手。 */
  function stoveAuto() {
    var guard = 0;
    readTie();
    while (S.stove && !S.stove.over && guard++ < 20) act("play", ZAO.nextMove(S.stove) || "serve");
  }
  // 开发用：把遥测打进 DOM，无头 Chrome 用 --dump-dom 回读。
  var DUMP_ERR = null;
  function dumpTel() {
    var box = document.createElement("pre");
    box.id = "sfxout";
    box.textContent = JSON.stringify({ tel: SFX_TEL, ids: SFX.map(function (x) { return x.id; }),
      err: DUMP_ERR });
    document.getElementById("layer").appendChild(box);
  }
  // 开发用：四章里**每一张牌、每一场对话、每一种胜负**都过一遍，只求覆盖，不求打得好看。
  // 它动的只是 S，玩家看不到这一屏；存在的意义是把「20 支里游戏真能响到几支」变成量出来的数。
  function sfxSweep() {
    var keep = NODLG, ci, guard;
    NODLG = true;                          // 过场白仍由本函数自己按场推进（见下面那段 for di）
    try {
      for (ci = 0; ci < JOURNEY.length; ci++) {        var key = JOURNEY[ci].key;
        if (!CHAPTERS[key]) continue;
        switchChapter(key);
        // 对话：逐场开屏，再一句句翻页 —— 翻页声只长在 dlgNext() 上
        for (var dk in DATA.dlg) {
          DLG.key = dk; DLG.i = 0; DLG.then = null; S.screen = "dlg"; renderDlg();
          guard = 0;
          while (S.screen === "dlg" && guard++ < 40) act("dnext");
        }
        // 灶前：案上每件都下手一次 —— 按手法分的那几支音（柴／水／罨／刀／尝／油／着）才各自命中得到。
        // 一锅烧完另起一锅接着试：配额与读帖都挡着，一件东西往往要几锅才轮得完。
        // 第一锅走正门（go/stove → 读帖 → 开火），笔尖声与开火那一声只长在这条路上。
        var triedZ = {}, zguard = 0;
        act("go", "stove");
        if (S.screen === "tie") readTie();
        while (zguard++ < 160) {
          if (!S.stove) {
            newStove();
            tieMarks().forEach(function (m) { ZAO.mark(S.stove, m.act); });
            S.screen = "stove";
          }
          var pend = zaoActs().filter(function (a) {
            return !a.serve && !triedZ[a.k] && ZAO.cap(S.stove, a.k) - S.stove.used[a.k] > 0;
          });
          if (!pend.length) {
            act("play", "serve");
            if (zaoActs().every(function (a) { return a.serve || triedZ[a.k]; })) break;
            continue;
          }
          triedZ[pend[0].k] = 1;
          act("play", pend[0].k);
        }
        // 堂上：把每种牌都递一次 —— 用印／出牌／判下／递不上去四条音都在这儿
        act("go", "court");
        guard = 0;
        while (S.court && guard++ < 60) {
          var ch = S.court.hand;
          if (!ch.length) { act("pass"); continue; }
          act("play", ch[guard % ch.length].id);
        }
        // 席间：三位客人轮流当靶，能上的菜都上一遍，尽欢与冷场两种反应都要响到。
        // 换靶即重排手牌（pickGuest），所以一口就够 —— 这里原先要「连打两口」，是因为
        // 手牌按上一个靶子排着序，第一口注定打不中 +4：**验收器在迁就引擎**，方向反了。
        for (var bp = 0; bp < 4; bp++) {
          act("go", "banquet");
          guard = 0;
          while (S.banquet && guard++ < 16) {
            act("pick", DATA.banquet.guests[guard % DATA.banquet.guests.length].id);
            var bh = S.banquet.hand;
            if (!bh || !bh.length) break;
            act("play", "d" + bh[0]);
          }
          if (S.banquet) act("disperse");
        }
        // 上街：每个摊都付一次钱（铜板声），再离开
        act("go", "street");
        for (var ti = 0; ti < DATA.street.stalls.length; ti++) act("play", "s" + ti);
        act("leave2");
        /* 回信：一封一次，而且只回**这一局收得到的**。
           分支接上之后不能照数组顺序硬回 —— 母信还没回的时候分支信是关着的，
           硬回等于凭空造出一封没寄到的信（原来那版还会对同一封落两次笔，第二次盖掉第一次）。
           外层再走几轮：上一轮刚打开的那一封，这一轮才轮得到它。 */
        var pass, opened;
        for (pass = 0; pass < 4; pass++) {
          opened = false;
          for (var li = 0; li < DATA.letters.length; li++) {
            var L = DATA.letters[li];
            if (S.replied[L.id] || !mailOpen(L)) continue;
            S.shichen = Math.max(S.shichen, L.when);
            act("reply", L.id + ":0");
            opened = true;
          }
          if (!opened) break;
        }
        act("end");                        // 盖章
        guard = 0;
        while (S.screen === "dlg" && guard++ < 40) act("dskip");
      }
    } catch (e) {
      // 中途抛了也要把遥测吐出去 —— 不然「没读到 sfxout」这条既不说是路由坏了，
      // 也不说是哪一屏坏了，下一个读的人会当成 Chrome 的问题。
      DUMP_ERR = "sweep 在 " + (key || "?") + " 章抛了：" + e.message;
    } finally { NODLG = keep; }
  }
  function courtAuto() {
    var d = DATA.court, guard = 0;
    while (S.court && guard++ < 30) {
      var it = intent(), hand = S.court.hand, pick = hand[0], pk = -1, i;
      for (i = 0; i < hand.length; i++) {
        var c = hand[i], k = base(c, it) * 10 - (c.risk || 0);
        if (!canAfford(c)) k -= 1000;   // 借不动 / 讲不动的牌不算候选
        if (k > pk) { pk = k; pick = c; }
      }
      act("play", pick.id);
    }
  }
  // 开发用：一路走完**全部四章**，最后停在终局那一屏。
  // 这是唯一能验到「空印跨章兑现」和「三枚章并排」的路径 —— 单章 demo 看不见。
  function demoAll() {
    for (var i = 0; i < JOURNEY.length; i++) {
      if (!JOURNEY[i].on || !CHAPTERS[JOURNEY[i].key]) continue;
      switchChapter(JOURNEY[i].key);
      demo();                                   // 走完本章并停在章末（此时已记 S.seals）
      if (i < JOURNEY.length - 1) act("next");   // 下一程：换章 + 还债
    }
    S.screen = "finale"; renderFinale();
  }
  // 开发用：把「插一句」全部走一遍 —— 真句子就说，伪作就咽下去。
  // 这样 #demo 与 #all 拍到的章末屏里，清欢册真的带着岔出去的那几句。
  function playAsides() {
    var g = 0, q;
    while ((q = pendingAside()) && g++ < 8) act(q.lie ? "hush" : "quip");
  }
  function demo() {
    // 自动驱动器不该被过场白挡住：以前 act("go","court") 会先播 courtOpen、
    // 屏幕停在 dlg，于是 courtAuto() 那 30 次 act("play") 全是空转 ——
    // **堂上这一关在 demo/#all 路径下从来没被真正玩过**，S.kongYin 一路是 0，
    // 而 #all 恰恰是文档里"唯一能验空印跨章兑现"的那条路。
    // 只关 say()（一次性过场白），不关 sayOne()（席间当场反应，那是要演的）。
    var keepNodlg = NODLG;
    NODLG = true;
    try { demoRun(); } finally { NODLG = keepNodlg; }
  }
  function demoRun() {
    act("go", "stove"); stoveAuto(); playAsides();
    act("go", "court"); courtAuto(); playAsides();
    act("go", "street");
    DATA.street.need.forEach(function (nm) {
      var idx = -1;
      for (var j = 0; j < DATA.street.stalls.length; j++) if (DATA.street.stalls[j].nm === nm) idx = j;
      if (idx >= 0) act("play", "s" + idx);
    });
    act("leave2"); playAsides();
    playBanquet(); playAsides();
    playLetters();
    var g = 0;
    while (S.shichen < S.maxShichen && g++ < 12) { act("go", "stove"); stoveAuto(); playAsides(); }
    act("end");
  }

  // 开发用：把待回的信都回掉（每封选第一个选项）
  function playLetters() {
    var guard = 0;
    while (pending().length && guard++ < 8) {
      renderMail();
      var L = pending()[0];
      reply(L.id, 0);
    }
  }

  // 开发用：席间的贪心线（与 tools/validate_cards.js 里那条一致）——每巡伺候最不欢的那位
  function playBanquet() {
    act("go", "banquet");
    var b = DATA.banquet;
    for (var r = 0; r < b.rounds && S.banquet; r++) {
      var s = S.banquet;
      var g = b.guests.slice().sort(function (x, y) { return s.joy[x.id] - s.joy[y.id]; })[0];
      act("pick", g.id);
      s = S.banquet;
      var best = -1, bv = -1;
      for (var i = 0; i < s.hand.length; i++) {
        var di = s.hand[i], d = b.dishes[di];
        if ((s.used[di] || 0) >= d.uses) continue;
        var v = d[b.dimKey[g.want]];
        if (v > bv) { bv = v; best = di; }
      }
      if (best < 0) break;
      act("play", "d" + best);
    }
    if (S.banquet) endBanquet();
  }
})();
