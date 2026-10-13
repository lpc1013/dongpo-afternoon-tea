/* 东坡行旅 · 四种关卡的规则与结算（gameplay）
   堂上（卡牌应意图）／灶前（活锅，模型在 灶前.js）／上街（预算与购买）／席间（菜就是话）。
   A03 的 spendMoney、A07 的 argIdx 与 serve 校验、A08 的"先结算再播白"都在这里。
   灶前那口锅本身的数值在 灶前.js（window.ZAO），这一份只管它挂进故事的那一头。 */
"use strict";
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
    /* 上面那一条只把"手里本来就有的"挪到最前，注释却写着「保证」（审计 10-13 §四）：
       四张都破不了这一拍意图时它照样交白卷。现在真去牌库里换一张能应的进来 ——
       代价是少摸一张后面的牌，而"这一拍有没有得打"是玩家能不能读下去的前提。 */
    if (i >= c.hand.length) {
      for (i = 0; i < c.deck.length; i++)
        if (base(c.deck[i], it) > 0) { c.hand.unshift(c.deck[i]); c.deck.splice(i, 1); break; }
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

  /* 结算是**不可逆事务**（审计 10-13 A08）：先把时辰、人情、句子落账并把这一局清掉，
     再播结算对白。以前对白播在结算之前，而「‹ 返回」会清空 DLG.then ——
     打完一回合按返回就把那一个时辰整笔逃掉，还留在堂上可以再来一遍。 */
  function endCourt() {
    var c = S.court;
    var ok = c.def >= DATA.court.need && (fullMode() || c.risk <= DATA.court.riskMax);
    var k = ok ? (yinMode() ? "courtYin" : borrowMode() ? "courtBorrow" : teachMode() ? "courtTeach" : "courtWin")
               : "courtLose";
    finishCourt();
    if (say(k, "go/hub")) return;
    renderHub();
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
    if (!p || p.over || S.screen !== "stove" || S.overlay) { potHalt(); return; }
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
    if (!S.stove || S.stove.over || S.screen !== "stove" || S.overlay) return;
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
  /* 所有「从玩家口袋里掏钱」的动作只走这一道（审计 10-13 A03）。
     本次预算管的是这一趟街，余额管的是这人手里真有多少钱 —— 原来只执行了前者，
     5 文能买下 20 文的东坡肉，银钱扣成 -15。以后新增商店或事件也归这里管。 */
  function spendMoney(n, why) {
    if (!(S.bars.银钱 >= n)) {
      toast("银钱不足：" + why + "要 " + n + " 文，手里只剩 " + S.bars.银钱 + " 文");
      sfx("reject");
      return false;
    }
    S.bars.银钱 -= n;
    return true;
  }

  function bookKey(x) { return x.book || x.nm; }
  function inBook(nm) { return DATA.book.dishes.indexOf(nm) >= 0; }

  function buy(i) {
    var d = DATA.street, s = S.street, st = d.stalls[i];
    /* 下标合法性不交给 UI：手敲 s999／s0.5 都不该动到任何一笔账（审计 10-13 A07）。 */
    if (i < 0 || !st || s.bought[st.nm]) return;
    if (s.spent + st.price > d.budget) { toast("超了：今日只用" + d.budget + "钱"); return; }
    if (!spendMoney(st.price, st.nm)) return;          // 余额这一道在预算之后，两道是并列不是替代
    s.spent += st.price; s.bought[st.nm] = true;
    var fake = st.tag === "传说", bk = bookKey(st);
    sfx("coin");
    if (!fake && inBook(bk)) S.got[bk] = true;
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
    var b = bnData(), s = S.banquet, d = di < 0 ? null : b.dishes[di];
    /* 鼠标只会递来手牌里那四个下标，键盘与手敲会递来别的：
       牌库外的菜不许上，也不许因为一个 undefined 就白屏（审计 10-13 A07）。 */
    if (!d || s.hand.indexOf(di) < 0) return;
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

