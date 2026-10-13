/* 东坡行旅 · 对话推进 + 舞台缩放 + 公共件
   say()/dlgNext() 那一套逐句推进、scale() 那块 1280×720 舞台的等比缩放（A09 的 k 下限）、
   以及 btn()/tabs()/cardFace()/plate()/panel() 这些每屏都用的摆放件。 */
"use strict";
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
  var READ_MODE = false;   // #章/屏/readtest：每一屏画完顺手把可读性/键盘语义量一遍（只量不判）
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
  /* 整体缩小不等于还能读（审计 10-13 A09）。1280×720 的舞台乘 0.293 到 375px 手机上，
     16px 的正文就剩 4.7px —— 那只保证"没出屏幕"，不保证"看得清"。
     k 有个下限 MIN_K：够不到下限就不再缩画面，而是让舞台比视口宽、由玩家推着看。
     1280×720 那一档走的是 else，一条内联样式都不多写，169 屏截图几何一字不变。 */
  var MIN_K = 0.75;
  function scale() {
    var fit = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    var k = fit < MIN_K ? MIN_K : fit, pan = fit < MIN_K;
    var e = document.getElementById("scaler"), w = document.getElementById("panwrap");
    if (pan) {
      e.style.position = "relative"; e.style.left = "0px"; e.style.top = "0px";
      e.style.transformOrigin = "0 0"; e.style.transform = "scale(" + k + ")";
      if (w) { w.style.overflow = "auto"; w.style.width = "100%"; w.style.height = "100%"; }
    } else {
      e.style.position = ""; e.style.left = ""; e.style.top = "";
      e.style.transformOrigin = "";
      e.style.transform = "translate(-50%,-50%) scale(" + k + ")";
      if (w) { w.style.overflow = ""; w.style.width = ""; w.style.height = ""; }
    }
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
