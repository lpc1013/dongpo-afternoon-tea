/* 东坡行旅 · 今日屏与门面（ui/screens/hub+cover）
   插一句、来信匾、今日那一屏的住户与光、开场空印、新手引导、封面三态。 */
"use strict";
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

