/* 东坡行旅 · 骨架与"把看得见的毛病写成量得出"
   layer() 那块画布、fitOverflow/fitPages/fitBookPages/fitShelf 的缩字、
   stampClash/stampFault 的相交与越界、kbStamp() 的键盘语义、获得提示与成就弹出。
   报告 §5.3 承认的"已经做对的视觉工程"集中在这一份。 */
"use strict";
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
  /* 键盘语义（审计 10-13 A10）补在**真节点**上，不动 innerHTML 那一串字。
     先试过往串里插 `role="button" tabindex="0"`：链上十几处老断言与 check_lic 认的就是
     `data-act="x">` 这种相邻写法，插前面插后面都把它们整批判红 —— 那是改闸的理由，
     不是改引擎的理由。节点上补属性，浏览器与读屏看到的是同一件事。
     `data-act=""` 是刻意摆灰的那一枚（没档时的「继续」），不进焦点序。 */
  function kbStamp() {
    var box = document.getElementById("layer");
    var list = box && box.querySelectorAll ? box.querySelectorAll("[data-act]") : null;
    if (!list || !list.length) return;               // Node 桩里没有真树，这一段只在浏览器里做事
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el.getAttribute("data-act")) continue;
      if (el.tagName !== "BUTTON") el.setAttribute("role", "button");
      if (!el.getAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  }

  function readStamp() {
    var stg = document.getElementById("stage");
    if (!stg || !window.getComputedStyle) return;
    var e = document.getElementById("scaler"), w = document.getElementById("panwrap");
    var m = e && e.style ? String(e.style.transform).match(/scale\(([-\d.]+)\)/) : null;
    var k = m ? parseFloat(m[1]) : 1;
    var pan = !!(w && /auto|scroll/.test(String(w.style.overflow)));
    var i, el, cs, fs, minPx = 0, minTxt = "";
    var list = null;
    try { list = document.querySelectorAll("#layer div,#layer span,#layer b,#layer em"); } catch (er) { }
    for (i = 0; list && i < list.length; i++) {
      el = list[i];
      if (el.children && el.children.length) continue;          // 只量真正装着字的那一层
      if (!(el.textContent || "").replace(/\s/, "")) continue;
      fs = parseFloat(window.getComputedStyle(el).fontSize) || 0;
      if (fs > 0 && (!minPx || fs < minPx)) { minPx = fs; minTxt = (el.textContent || "").replace(/^\s+/, "").slice(0, 6); }
    }
    var acts = null, nAct = 0, nNoRole = 0, minW = 0, minH = 0;
    try { acts = document.querySelectorAll("#layer [data-act]"); } catch (er2) { }
    for (i = 0; acts && i < acts.length; i++) {
      el = acts[i];
      if (!el.getAttribute("data-act")) continue;               // 摆灰的那枚不算可点
      nAct++;
      if (el.tagName !== "BUTTON" && el.getAttribute("role") !== "button") nNoRole++;
      else if (!el.getAttribute("tabindex")) nNoRole++;
      cs = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (cs && cs.width && (!minW || cs.width < minW)) { minW = cs.width; minH = cs.height; }
    }
    /* Enter 这一枪用**真事件**：dispatchEvent 出来的 KeyboardEvent 会走浏览器完整的冒泡与
       监听器派发，Node 桩里 keyOn() 量不到的那一半在这里补上。
       挑节点有讲究：牌面上第一枚往往是"打出去这张牌"，按下去会把这一屏换掉 ——
       所以①优先挑 `go` 那一类只换屏不改账的；②量到的屏名 `scr` 先钉下来，
       这一枪放最末尾，免得它自己把自己量的那一屏改了。（第一版就是栽在这：
       报告里 `court` 那一行量完屏名成了 `hub`，因为第一枚节点是张牌。）
       分隔符一律用 `/`：`>` 会被 --dump-dom 转义成 `&gt;`，回读的正则当场判成"没换屏"。 */
    var scr0 = S.screen, enter = "no-node";
    if (nAct) {
      var f = null, fi;
      for (fi = 0; f == null && fi < acts.length; fi++)
        if (acts[fi].getAttribute("data-act") === "go" && acts[fi].getAttribute("data-arg")) f = acts[fi];
      if (!f) for (fi = 0; f == null && fi < acts.length; fi++)
        if (acts[fi].getAttribute("data-act")) f = acts[fi];
      var fa = f.getAttribute("data-arg") || "", fAct = f.getAttribute("data-act");
      try {
        f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        enter = fAct + "/" + fa + "/" + (S.screen === scr0 ? "same" : S.screen);
      } catch (er3) { enter = "throw-" + ((er3 && er3.message) || er3); }
    }
    stg.setAttribute("data-read", [window.innerWidth + "x" + window.innerHeight,
      "k=" + k.toFixed(3), "pan=" + (pan ? 1 : 0), "scr=" + scr0,
      "min=" + (minPx * k).toFixed(1) + "px(" + minPx.toFixed(1) + "@" + minTxt + ")",
      "act=" + nAct, "norole=" + nNoRole,
      "tap=" + (minW ? (minW * k).toFixed(1) + "x" + (minH * k).toFixed(1) : "-"),
      "enter=" + enter].join("|"));
  }

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
    kbStamp();                               // 键盘语义补在刚立起来的那批节点上（A10）
    stampClash();                            // 量完字号再量相交：缩过之后才是最终占位
    stampFault();                            // 再量三件"数没越界"的毛病：字被裁 / 越出舞台 / 图没落盘
    enterFx();                               // 量完再动：挂类名不影响几何，但要在 DOM 站住之后
    popTick();                               // 获得与成就都在这一次重绘之后量差额
    /* 存档挂在同一处，理由与 popTick 那条注释一样：点名式的钩子一定会漏掉后加的那几处。
       layer() 只在真的换屏时走一遍，不是每帧 —— 一关结算必然重绘，所以结算点全覆盖。
       （早先设计里写的「四个 finishX 后各写一次」就是点名式，新增一个发奖屏就得记着补一处。） */
    if (READ_MODE) readStamp();                    // 验收口：这一屏的字有多小、钮有多小、Enter 走不走得出去
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

  /* "d3"→3、"s0"→0，其余（空／负／小数／字母）一律 -1。
     原来直接 parseInt(arg.slice(1))："d0.5" 被吞成 0，等于凭空多上一道牌。 */
  function argIdx(arg, pfx) {
    if (typeof arg !== "string" || arg.charAt(0) !== pfx) return -1;
    var t = arg.slice(1);
    if (!/^[0-9]+$/.test(t)) return -1;
    return parseInt(t, 10);
  }

