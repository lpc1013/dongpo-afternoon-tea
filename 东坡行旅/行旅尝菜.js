/* 东坡行旅 · 尝菜与录方
   算盘上拨读数、把"夹死哪几味"记进 S.notes、把方子定进 S.recipes。
   这是灶前那口锅的**信息层**：锅本身在 行旅玩法.js 与 灶前.js。 */
"use strict";
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

