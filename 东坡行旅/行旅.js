/* 东坡行旅 · 派发、验收钩子与起机（routing + boot）
   act() 那一层把鼠标/键盘/验收工具送来的动作派给各玩法模块；
   window.DP 是验收工具的口；文件末尾是起机（读档 → 封面/今日）与 #章/屏 那套哈希路由。
   一个循环（六个时辰）+ 三种关卡（堂上/灶前/上街）+ 两本册子（食单/清欢册）+ 五根条。
   约束：file:// 双击直跑 —— 不用 module、不用 fetch、不用外链，图全部走相对路径。
   ⚠ 这一段必须**最后加载**：前面八份都是声明，起机的那几行语句在这里。 */
"use strict";

/* 这一段被包回 IIFE，只为起机那一句顶层 `return`（脚本顶层不许 return）。
   act() 是别的段在运行时真要调的（行旅公共件.js 的 dlgDone 走它就靠这一步），
   所以显式交回全局；function 声明在本作用域内提前成立，这句赋值放在最前也拿得到。 */
(function () {
globalThis.act = act;
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
      if (switchChapter(arg)) renderHub();
      else toast("这一章还没开工");
    /* 重走本章要按两下（问7①）：第一下只弹话，第二下才真清。
       一刀切下去会带走时辰、这一章的牌与两本册子 —— 那是"重开"，不该是一次单击。 */
    } else if (a === "rechap") {
      if (S.rechap !== arg) { S.rechap = arg; toast("再点一次就从头再走「" + DATA.chapter.name +
        "」：时辰、手牌、食单与清欢册都会清空"); renderMap(); return; }
      S.rechap = "";
      if (switchChapter(arg)) renderHub();
    } else if (a === "play") {
      if (S.screen === "court") playCourt(arg);
      else if (S.screen === "stove") playStove(arg);
      else if (S.screen === "street") buy(argIdx(arg, "s"));
      else if (S.screen === "banquet") serve(argIdx(arg, "d"));
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
    else if (a === "rules") { _screen = S.screen; S.overlay = "rules"; renderRules(); }
    else if (a === "achv") { _screen = S.screen; S.overlay = "achv"; renderAchv(); }
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
    else if (a === "case") { _screen = S.screen; S.overlay = "case"; renderCase(); }
    else if (a === "back") { SND_OPEN = 0; S.overlay = ""; repaint(_screen); }   // 回**来源屏**，不是"只认堂上、其余落今日"
    else if (a === "end") { sfx("seal"); if (say("seal", "end2")) return; S.screen = "end"; renderEnd(); }
    else if (a === "end2") { S.screen = "end"; renderEnd(); }
    else if (a === "gochap") { goChapter(); }
    else if (a === "next") {
      var nx2 = nextChapter();
      if (nx2 && nx2.on) {
        // 有下一程的每一站都先落在路上那一屏；只有验收（nodlg／demo）才直接翻书
        if (!NODLG && nx2.hop) { S.screen = "travel"; renderTravel(); return; }
        switchChapter(nx2.key); renderHub();
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
    else if (a === "snd") { _screen = S.screen; SND_OPEN = 1; S.overlay = "snd"; renderSnd(); }
    else if (a === "credit") { _screen = S.screen; S.overlay = "credit"; renderCredit(); }
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

  /* 键盘派发（审计 10-13 A10）：role/tabindex 只解决"能走到"，走到之后按下去要有反应。
     Enter 与 Space 等价于一次点击；**不认的键一概不动** —— 把任意键当 Enter，
     玩家翻一封信就会顺手触发三枚按钮。 */
  document.addEventListener("keydown", function (e) {
    var k = e && e.key;
    if (k !== "Enter" && k !== " " && k !== "Spacebar") return;
    var n = e.target;
    while (n && n !== document.body && !(n.getAttribute && n.getAttribute("data-act"))) n = n.parentNode;
    if (!n || n === document.body) return;
    var a = n.getAttribute("data-act");
    if (!a) return;
    if (e.preventDefault) e.preventDefault();
    act(a, n.getAttribute("data-arg") || "");
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
    potLive: function (v) { LIVE_POT = !!v; return LIVE_POT; },
    /* 只开测量用的口，不碰判定（与 tick／potLive／stoveOn 同一条路子）：
       这一拍「手里能应上意图的牌」与「牌库里还能应的张数」——
       drawHand 那句「保证」的凭据只能由引擎自己报，harness 不许另抄一份 base()。 */
    handCheck: function () {
      var c = S.court, it = c ? intent() : "", ok = [], deckN = 0, i;
      if (!c) return { intent: it, ok: ok, deck: 0 };
      for (i = 0; i < c.hand.length; i++) if (base(c.hand[i], it) > 0) ok.push(c.hand[i].id);
      for (i = 0; i < c.deck.length; i++) if (base(c.deck[i], it) > 0) deckN++;
      return { intent: it, ok: ok, deck: deckN };
    },
    /* 保底那句「保证」**造出来才量得到**：自然牌序里从来没出现过
       "四张全应不上、而牌库里还躺着一张能应的"那一格（10-13 灌缺陷证伪抓到的 ——
       把下面那段补换整段坏掉，光量自然牌序的 30 拍照绿，等于这条闸没开）。
       这个口**只跑引擎自己那个 drawHand**，判定一字不改；手牌与牌库由验收器摆好。
       浏览器里玩家走的是同一条路：drawHand 是每一拍补手牌的唯一入口。 */
    drawProbe: function () { drawHand(); return window.DP.handCheck(); } };
  // #章 / #章/界面 直接进（无头截图用）：#dingzhou、#dingzhou/court、#court
  var hh = (location.hash || "").replace(/^#/, "").split("/");
  NODLG = hh.indexOf("nodlg") >= 0;
  /* /full ＝ 把这一章填到"玩到中后段"那一格再画（见 fillAll 那段注释）。
     与 nodlg 同一条路子：它是**哈希上的一次性开关**，不碰判定、不写档。 */
  var FULL = hh.indexOf("full") >= 0;
  /* #章/stove/live —— 唯一放行活锅定时器的验收路由（LIVE_POT）。
     默认带哈希的跑法不放行：虚拟时间会在一屏截图里把八拍全烧完，拍到的永远是糊锅那一格。 */
  LIVE_POT = hh.indexOf("live") >= 0;
  /* `#章/屏/nodlg/readtest` —— 可读性与键盘语义只有真布局量得出来（审计 10-13 A09／A10）。
     这个 token 与 nodlg／full／live 同一类：**只开测量口，不碰判定**。
     打开后每屏画完顺手把结论钉在 `#stage[data-read]` 上，由 tools/check_readability.py
     逐档视口回读。与 data-clash／data-fault／data-taste 同一条路子 ——
     能钉在 DOM 上的结论，才轮得到验收器去断言。 */
  READ_MODE = hh.indexOf("readtest") >= 0;
  hh = hh.filter(function (x) { return x !== "nodlg" && x !== "full" && x !== "live" && x !== "readtest"; });
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
