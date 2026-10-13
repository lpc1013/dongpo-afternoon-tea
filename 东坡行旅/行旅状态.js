/* 东坡行旅 · 状态与存档（core）
   S 这个容器、reset()/switchChapter()、写档读档与坏档校验都在这一份。
   报告 A01 点名的"改存档机制会连带影响关卡恢复与切章"，就是把这三件事混在一份 4200 行的
   控制器里的结果；A02／A04／A06 三条修复也都落在这里。
   约束不变：file:// 双击直跑 —— 不用 module、不用 fetch、不用外链。 */
"use strict";

  var S = {
    screen: "hub",
    /* 盖在当前屏上的那一层（rules／achv／case／snd／credit）。
       以前它根本不存在：renderRules() 只重画画面，S.screen 还停在 stove，
       于是活锅定时器照着 1.8 秒一拍继续烧，还把规则页盖回灶前（审计 10-13 A05）。 */
    overlay: "",
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
  /* 关卡进行中的那一局**不写档**（审计 10-13 A04）：席间每上一道菜都重绘一次，
     而一个时辰要到 finishBanquet 才扣 —— 于是「上菜→存档→刷新」能把食单与人情白拿走，
     成本留在没提交的那一半。写档只发生在一关真正结算之后（四个 finishX 都会落到 hub）。
     判据用局面对象本身，不点名数屏：以后再加一关，只要它也把局面挂在 S 上就自动受管。 */
  function inLevel() { return !!(S.court || S.stove || S.banquet || S.street); }
  function saveGame() {
    if (NO_SAVE) return;
    if (inLevel()) return;
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
  /* 「JSON 解得开」与「这份档能用」是两回事（审计 10-13 A06）：手工改档、版本迁移、
     意外写坏都会送来一份合法而残缺的东西 —— 例如 bars 是 null，它一路通过原来那三道检查，
     直到 panel() 去读 S.bars.物议 才崩，玩家看见的是白屏。
     这里逐字段对型：数字对数字、字典对字典、章名必须在 CHAPTERS 里。
     对不上就**整份弃用**（不修补、不猜），并把原件挪到 .bad 那一份备份 ——
     玩家自己手改的档不该被静默销毁。 */
  function isDict(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  var SAVE_DICT = ["bars", "got", "verses", "replied", "tone", "read", "flags", "seals",
    "mailSeen", "notes", "recipes"];
  var SAVE_NUM = ["shichen", "aside", "kongYin", "debt", "tut"];
  function badSave(o) {
    var i, k;
    if (!isDict(o)) return "整份不是对象";
    if (o.v !== 1) return "版本号不对";
    if (typeof o.chapter !== "string" || !CHAPTERS[o.chapter]) return "章名不存在";
    for (i = 0; i < SAVE_NUM.length; i++)
      if (o[SAVE_NUM[i]] !== undefined && !isNum(o[SAVE_NUM[i]])) return SAVE_NUM[i] + " 不是数";
    for (i = 0; i < SAVE_DICT.length; i++)
      if (o[SAVE_DICT[i]] !== undefined && !isDict(o[SAVE_DICT[i]])) return SAVE_DICT[i] + " 不是字典";
    if (o.bars) for (k in o.bars)
      if (Object.prototype.hasOwnProperty.call(o.bars, k) && !isNum(o.bars[k])) return "bars." + k + " 不是数";
    if (o.seals) for (k in o.seals)
      if (Object.prototype.hasOwnProperty.call(o.seals, k) && !isDict(o.seals[k])) return "seals." + k + " 不是对象";
    if (o.quips !== undefined && !Array.isArray(o.quips)) return "quips 不是数组";
    if (o.dongpoName !== undefined && typeof o.dongpoName !== "boolean") return "dongpoName 不是真假";
    if (o.mailAsked !== undefined && typeof o.mailAsked !== "boolean") return "mailAsked 不是真假";
    if (isNum(o.shichen) && o.shichen < 0) return "时辰是负的";
    if (isNum(o.tut) && (o.tut < -1 || o.tut > 99)) return "引导步数出了量程";
    return "";
  }
  /* 五根条按**本章基线**补齐再收档里的数：档里少写一根、或多写一根没见过的，
     都不许带着 undefined 进 panel()。 */
  function fixBars(o) {
    var base = clone(DATA.bars), k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k))
      S.bars[k] = isNum(o.bars && o.bars[k]) ? o.bars[k] : base[k];
  }
  /* 读到档就返回 true 并把 S 摆回那一章的「今日」；档坏了（版本号不对、章名没了、
     结构残缺）一律当作没档，从黄州重开 —— 不许因为一个旧档把游戏弄成白屏。 */
  function loadGame() {
    var o = null, i;
    try {
      if (typeof localStorage === "undefined") return false;
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      o = JSON.parse(raw);
    } catch (e) { return false; }
    if (!o) return false;
    var why = badSave(o);
    if (why) {
      try { localStorage.setItem(SAVE_KEY + ".bad", raw); } catch (e2) { }
      return false;
    }
    reset();
    useChapter(o.chapter);
    for (i = 0; i < SAVE_F.length; i++) if (o[SAVE_F[i]] !== undefined) S[SAVE_F[i]] = o[SAVE_F[i]];
    if (o.bars !== undefined) fixBars(o);
    S.screen = "hub";
    S.court = S.stove = S.street = S.banquet = null;
    POP_BASE = null; seedAchv();
    return true;
  }

