/* 灶前 · 烧菜（原型，可双击直跑）
   设计口径：
     · **火不是话，不该有牌** —— 案上摆的是实物（柴束、草盖、水瓢、肉、盐糖醋油酱），点它 = 下料。
     · **锅是活的**：每一拍炭还在烧，你不碰它火候也往上走；越过这道菜的火候上限就开始积糊锅。
       所以"守"有主体了 —— 你在照看一口会自己变的锅，不是解一道算术题。
     · **食谱是核心**：解锁了的菜把目标向量摊在匾上（有靶子才叫可读）；
       没解锁的不给数，只有「尝味」吐出方向性的话（"淡""该来点酸""火还生"），
       试对了自动入食单 —— 这就是「不解锁食谱就只能靠经营去试」。
   约束：file:// 双击直跑 —— 不用 module／fetch／外链，图全走相对路径。 */
(function () {
  "use strict";

  // ── 实物 ────────────────────────────────────────────
  // ic 用现有资产。六件调料（盐／糖／醋／油／酱／蜜）与各自主料现在都有自己的图
  // （图标/jar-*.png 与 图标/ing-*.png，即梦产的 2K 白底件走 cutout + icon_pack）。
  // col ＝ 这件东西的**本色**，画在角标下沿 —— 图形分得开之后颜色退成第二层辨识，
  // 但仍不许只靠颜色区分（盐白／糖米黄／醋褐／油金黄／酱黑）。
  var ACTS = [
    { k: "stoke", nm: "添柴", ic: "图标/ico-fire.png", uses: 4, col: "#c8562a",
      fx: { stoke: 1 }, say: "添柴 · 炭势 +1" },
    { k: "lid",   nm: "压盖", ic: "图标/prop-basket.png", uses: 3, col: "#c9b48a",
      fx: { lid: 1, hf: 4 }, say: "压盖 · 火闷住，这一拍更旺" },
    { k: "unlid", nm: "掀盖", ic: "图标/prop-basin.png", uses: 3, col: "#8fa8b8",
      fx: { lid: -1, hf: -9 }, say: "掀盖 · 热气跑了，火候 -9" },
    { k: "water", nm: "着水", ic: "图标/ico-water.png", uses: 3, col: "#7fa3b8",
      fx: { hf: -6, tang: 1, salt: -1 }, say: "少著水 · 火候 -6 汤 +1 咸 -1" },
    { k: "meat",  nm: "下肉", ic: "dish-rou-1-cut.png", uses: 1, col: "#a83a2a",
      fx: { meat: 1, hf: -10, oil: 2 }, say: "肉下锅 · 油 +2 火候 -10" },
    /* 「下鱼」是黄州第二样主料：《煮鱼法》"以鲜鲫或鲤治之"——
       鱼羹那口锅的主料是它，不是下肉。两件都在案上，下错了不是判废，
       是做完一锅"猪肉鱼羹"——数字说了算，嘴上说的才算数。 */
    { k: "fish",  nm: "下鱼", ic: "图标/stall-fish.png", uses: 1, col: "#7f96a8", ing: 1,
      fx: { meat: 1, hf: -9, tang: 1 }, say: "鲫鱼入锅 · 汤 +1 火候 -9 —— 冷水下的是它" },
    { k: "salt",  nm: "盐",   ic: "图标/jar-salt.png", uses: 3, col: "#efe6d5", jar: "盐",
      fx: { salt: 3 }, say: "盐 · 咸 +3" },
    { k: "sugar", nm: "糖",   ic: "图标/jar-sugar.png", uses: 2, col: "#e8d9a0", jar: "糖",
      fx: { sugar: 3 }, say: "糖 · 甜 +3" },
    { k: "sour",  nm: "醋",   ic: "图标/jar-vinegar.png", uses: 3, col: "#8a5a3a", jar: "醋",
      fx: { sour: 3 }, say: "醋 · 酸 +3" },
    { k: "oil",   nm: "油",   ic: "图标/jar-oil.png", uses: 2, col: "#d8a63a", jar: "油",
      fx: { oil: 3, sc: 1 }, say: "油 · 油 +3 糊 +1" },
    { k: "sauce", nm: "酱",   ic: "图标/jar-sauce.png", uses: 2, col: "#3a2a20", jar: "酱",
      fx: { salt: 2, oil: 1, sc: 1 }, say: "酱 · 咸 +2 油 +1 糊 +1" },
    /* 「催」是设计里早就写了、一直没做的那颗陷阱：
       《猪肉颂》明写「待他自熟莫催他」，所以它快、但一定烧糊。
       火不够时它特别想按 —— 这就是它存在的意义，不是给玩家一个更快的按钮。
       ⚠ 图形不能和「添柴」同一张：两件事在灶上是两回事（添柴加炭、扇风催火），
       第一版都用了 ico-fire，只差一个角标颜色，玩家必按错。 */
    { k: "urge",  nm: "催",   ic: "图标/ico-fan.png", uses: 3, col: "#8c2820", trap: 1,
      fx: { hf: 20, sc: 2 }, say: "扇风催他 · 火候立刻 +20 糊 +2 —— 帖上明明说莫催他" },
    { k: "chestnut", nm: "下栗", ic: "图标/prop-sealblank.png", uses: 1, col: "#8a5a3a", ing: 1,
      fx: { meat: 1, hf: -6 }, say: "生栗入盆 · 火候 -6（烝栗的「主料」就是它）" },
    { k: "song",    nm: "下菘", ic: "图标/ing-song.png", uses: 2, col: "#6f9a5a", ing: 1,
      fx: { hf: -5, salt: 1 }, say: "菘菜入锅 · 火候 -5" },
    { k: "radish",  nm: "芦菔", ic: "图标/prop-slip.png", uses: 2, col: "#e0d6b8", ing: 1,
      fx: { hf: -4, sugar: 2 }, say: "芦菔（萝卜）· 甜 +2" },
    { k: "turnip",  nm: "苦蔓菁", ic: "图标/prop-inkstick.png", uses: 2, col: "#8f9a7a", ing: 1,
      fx: { hf: -3, sour: 2 }, say: "苦蔓菁 · 酸 +2 —— 帖里点名的就是它" },
    { k: "taro",  nm: "煨芋", ic: "图标/prop-cushion.png", uses: 2, col: "#c9a86a", ing: 1,
      fx: { hf: -4, body: 7 }, say: "煨芋 · 身体 +7（这一锅是唯一回身体的东西）" },
    /* 「下芋」是玉糁羹的主料：苏过"以山芋作玉糁羹"——
       煨芋是烤着吃的零嘴（回身体），下芋是下锅的料。同一根芋，两件案上事。 */
    { k: "shanyu", nm: "下芋", ic: "图标/dish-yu.png", uses: 1, col: "#c9a86a", ing: 1,
      fx: { meat: 1, hf: -5, sugar: 1, body: 3 }, say: "山芋下锅 · 甜 +1 身体 +3 —— 玉糁羹的主料" },
    { k: "oyster",nm: "撬蚝", ic: "图标/dish-hao2.png", uses: 1, col: "#8fa8a0", ing: 1,
      fx: { meat: 1, hf: -6, oil: 1, sour: 1 }, say: "撬壳下蚝 · 带一点自带的咸鲜" },
    { k: "coconut",nm: "椰子", ic: "图标/ing-coconut.png", uses: 2, col: "#e8e0c8", ing: 1,
      /* 椰子水回一点身体：儋州那堂上要耗 18 分，光靠煨芋（14）还差一截 ——
         关卡之间要真的互相喂，这一章就得有第二样能下肚的东西。
         消渴疾到他身上正是「渴」，椰浆在他自己的诗里就是解渴的。 */
      fx: { sugar: 3, tang: 1, hf: -3, body: 3 }, say: "椰子入锅 · 甜 +3 汤 +1 身体 +3" },
    { k: "honey", nm: "蜜",   ic: "图标/jar-honey.png", uses: 2, col: "#e0a63a", jar: "蜜",
      fx: { sugar: 4 }, say: "蜜 · 甜 +4" },
    /* ── 案板：切一刀也是一拍 ──────────────────────────
       切不是免费加成：它要走一拍（炭在烧、香在短），换来入味 ×1.25、火候下限降 8。
       而有的菜**不许切** —— 烝栗整颗蒸、羊脊骨整副煮，切了就不是那道菜，直接判废。
       ⚠ 菜刀与木案板都还没有图（列在 tools/stove_needs.txt），先拿木牌与案几顶位。 */
    { k: "prep",  nm: "切",   ic: "图标/prop-hangboard.png", uses: 2, col: "#b8b0a0", board: 1,
      fx: { chop: 1 }, say: "在案板上切一刀 · 走一拍：入味 ×1.25 火候下限 -8" },
    { k: "taste", nm: "尝味", ic: "图标/ico-tastecup.png", uses: 3, col: "#96c896", quiet: 1,
      say: "" },
    { k: "serve", nm: "起锅", ic: "图标/dish-geng.png", uses: 99, col: "#f2c66a", serve: 1,
      say: "起锅" }
  ];

  /* ── 四章四个厨房 ────────────────────────────────────
     扩下去才看清：它们不是同一口锅换菜，是**四套动作**。
       黄州 猪肉 —— 讲究慢，"火候足时他自美"，催它就是错；
       定州 烝栗 —— 没有油盐酱，案上只有炭与水，靠**翻**防糊；
       惠州 羹   —— 《东坡羹颂》通篇就一句禁令：不用肉；
       儋州 炙蚝 —— 火要猛、壳要撬，而且只有这一锅回身体。
     lab 是每章给同一件动作起的本地名（添柴→添炭、起锅→起盆）。 */
  var CHAPS = [
    { id: "huangzhou", nm: "黄州", age: "四十五岁", bg: "素材/fx-stove-c-4.webp",
      lab: {},
      acts: ["stoke", "lid", "unlid", "water", "meat", "fish", "salt", "sugar", "sour", "oil", "sauce", "prep", "urge", "taste", "serve"] },
    { id: "dingzhou", nm: "定州", age: "五十七岁", bg: "素材/fx3-dz-stove-b-3.webp",
      lab: { stoke: "添炭", lid: "罨炭", unlid: "翻栗", water: "洒水", serve: "起盆", urge: "催" },
      /* 这一章整章没有留下菜谱原文 → 案上那颗陷阱不许再引用"帖上明明说莫催他"（悬空引用）。
         陷阱照留（催＝快而成糊，四章一致），只把话改成这一锅自己的道理。措辞是拟的，不托古人。 */
      say: { urge: "扇风催火 · 火候立刻 +20 糊 +2 —— 烝栗要的是慢火匀，催它就是糊" },
      acts: ["stoke", "lid", "unlid", "water", "chestnut", "salt", "honey", "prep", "urge", "taste", "serve"] },
    { id: "huizhou", nm: "惠州", age: "五十八岁", bg: "素材/fx3-hiz-stove-c-2.webp",
      /* 案上**故意不放糖罐醋瓶油壶酱碟**：《东坡羹颂》"用菘苦蔓菁及芦菔法，不用肉……不以酒醢"。
         酸甜只能从帖里点名的那三样菜来 —— 留着糖醋罐子，读帖这一层就白设了
         （验收器 ⑦ 就是这么抓到"帖是装饰"的）。 */
      lab: { meat: "下肉", serve: "起锅" },
      /* 惠州这一锅的帖是《东坡羹颂并引》：「用菘苦蔓菁及芦菔法，不用肉。煮以沸汤，不以酒醢。」
         通篇**没有一句讲火候、更没有"莫催他"** —— 那是黄州《猪肉颂》的话。
         默认那句「帖上明明说莫催他」用在这一章等于替他把没写过的话说了（定州儋州 9-29 已改，惠州是漏网的那一个）。
         陷阱照留（催＝快而成糊，四章一致），话只说他帖里真有的那半句。 */
      say: { urge: "扇风催火 · 火候立刻 +20 糊 +2 —— 帖上只写了「煮以沸汤」，没写要猛火" },
      acts: ["stoke", "lid", "unlid", "water", "song", "radish", "turnip", "meat", "salt", "honey", "prep", "urge", "taste", "serve"] },
    { id: "danzhou", nm: "儋州", age: "六十一岁", bg: "素材/fx3-dan-stove-b-2.webp",
      lab: { stoke: "添柴", serve: "起锅" },
      /* 同定州：儋州也没有留下方子原文，那句"帖上"就是编的。 */
      say: { urge: "扇风催火 · 火候立刻 +20 糊 +2 —— 蚝要的是猛火，可一催就糊上一层" },
      acts: ["stoke", "lid", "unlid", "water", "oyster", "taro", "shanyu", "coconut", "salt", "honey", "prep", "urge", "taste", "serve"] }
  ];

  // ── 食谱 ────────────────────────────────────────────
  // need 全部是**区间**；meat 0 = 这道菜不许下主料（惠州那羹通篇就这一句禁令）。
  // known:true 一上来就把区间摊在匾上；known:false 只给菜名，靠「尝」试出来。
  // ⚠ 未解锁的菜谱**不给他编方子**：帖里没留下做法的，hint 就明说"方子没留下来"，
  //   绝不假托一句"原文" —— 这条线立身之本就是不编台词。
  var NOBOOK = "食单上有这一味，可方子没留下来 —— 这一锅得你自己试。";
  var BOOK = [
    { id: "zhurou", chap: "huangzhou", nm: "黄州猪肉", known: true, turns: 8, start: 18,
      hint: "净洗铛，少著水，柴头罨烟焰不起。　《猪肉颂》",
      need: { hf: [80, 100], salt: [6, 9], sugar: [0, 2], sour: [0, 1], oil: [3, 6], sc: [0, 2], meat: 1, slow: 4 },
      note: "要慢：至少烧满四拍才算「火候足」" },
    { id: "yanggu", chap: "huangzhou", nm: "煮羊脊骨", known: false, turns: 8, start: 18,
      hint: "「其味如蟹螯」—— 大意，帖是写给子由的。",
      need: { hf: [70, 92], salt: [7, 10], sugar: [0, 1], sour: [3, 6], oil: [2, 5], sc: [0, 3], meat: 1, cut: 0 },
      note: "未解锁：蟹味靠的是哪一味" },
    { id: "zhizhu", chap: "huangzhou", nm: "旋炙猪皮肉", known: false, turns: 8, start: 18,
      hint: NOBOOK,
      need: { hf: [105, 130], salt: [4, 7], sugar: [0, 1], sour: [0, 2], oil: [1, 4], sc: [0, 1], meat: 1, cut: 1 },
      note: "未解锁：火要大，可又不许糊 —— 这一锅最难" },
    /* 黄州第四道（把 tast2/bill 的第 4 号桌景接活）：《煮鱼法》是有原文的，
       所以 known:true、有帖 —— 主料是「下鱼」，帖里圈的就是它。 */
    { id: "zhuyu", chap: "huangzhou", nm: "鲫鱼羹", known: true, turns: 8, start: 18, main: "fish",
      hint: "以鲜鲫或鲤治之，入泠水中，入盐如常法。　《煮鱼法》·黄州【有据（篇名）；字句各本小异，未回校】",
      need: { hf: [70, 95], salt: [4, 7], sugar: [0, 1], sour: [0, 2], oil: [0, 2], sc: [0, 1], meat: 1, cut: 1 },
      note: "冷水下的鱼，文火出的白汤 —— 火一大汤就浑" },
    { id: "zhengli", chap: "dingzhou", nm: "烝栗 · 北地冬", known: true, turns: 8, start: 16,
      hint: "寄君东阁闲烝栗。　《寄馏合刷瓶与子由》·定州任上【有据】",
      need: { hf: [58, 96], salt: [0, 2], sugar: [0, 2], sour: [0, 1], oil: [0, 1], sc: [0, 3], meat: 1, slow: 2, cut: 0 },
      note: "这一案上没有油盐酱 —— 烝栗只讲火：罨炭、翻栗、洒水" },
    { id: "lizhi", chap: "dingzhou", nm: "蜜渍荔枝", known: false, turns: 6, start: 16,
      hint: NOBOOK,
      need: { hf: [20, 45], salt: [0, 2], sugar: [8, 12], sour: [0, 2], oil: [0, 1], sc: [0, 1], meat: 0, cut: 0 },
      note: "未解锁：生渍的东西，火一大就毁了" },
    { id: "dongpo", chap: "huizhou", nm: "东坡羹 · 不用肉", known: true, turns: 8, start: 18,
      hint: "用菘苦蔓菁及芦菔法，不用肉。　《东坡羹颂并引》【篇名有据】",
      need: { hf: [76, 96], salt: [5, 8], sugar: [1, 3], sour: [2, 4], oil: [0, 2], sc: [0, 2], meat: 0, cut: 1 },
      note: "下主料即废 —— 这是《东坡羹颂》唯一不许的那一样" },
    { id: "yangmei", chap: "huizhou", nm: "杨梅", known: false, turns: 6, start: 16,
      hint: NOBOOK,
      need: { hf: [20, 60], salt: [0, 2], sugar: [6, 10], sour: [3, 6], oil: [0, 1], sc: [0, 2], meat: 0, cut: 0 },
      note: "未解锁：又甜又酸，还不敢大火" },
    { id: "zhihao", chap: "danzhou", nm: "炙蚝 · 分我此美", known: true, turns: 7, start: 16,
      hint: "海物惟错，而蟹与蚝为尤。　《食蚝》【有据，《苏轼文集》佚帖】",
      need: { hf: [95, 125], salt: [3, 6], sugar: [0, 2], sour: [0, 3], oil: [1, 4], sc: [0, 2], meat: 1, cut: 0 },
      note: "燎壳要猛火，可蚝一老就缩" },
    { id: "yezishuo", chap: "danzhou", nm: "东坡椰子船", known: false, turns: 7, start: 16,
      hint: NOBOOK,
      need: { hf: [55, 80], salt: [0, 3], sugar: [6, 10], sour: [0, 2], oil: [0, 2], sc: [0, 2], meat: 1, cut: 1 },
      note: "未解锁：椰子要甜，火却只能温" },
    /* 儋州第三道：苏过以山芋作玉糁羹，有诗有题（调研档儋州段【有据（篇名与句）】）。
       known:true —— 方子是父子俩当场试出来的，瞒不住；但**不给帖**：
       「读帖」那一层的闸（stove_greedy ⑦b）钉的是"定州儋州整章无原文"，
       玉糁羹的诗不是操作手册（没有动词可圈），硬圈一个"作"字就是编。 */
    { id: "yusheng", chap: "danzhou", nm: "玉糁羹", known: true, turns: 7, start: 16, main: "shanyu",
      hint: "香似龙涎仍酽白，味如牛乳更全清。　《玉糁羹》·儋州作【有据（篇名与句）；卷次未回校】",
      need: { hf: [55, 82], salt: [0, 3], sugar: [1, 4], sour: [0, 1], oil: [0, 1], sc: [0, 1], meat: 1, cut: 1 },
      note: "儿子进的山芋，切了块温水慢煨 —— 清味，不是甜味" }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function newPot(recipe) {
    var p = { r: recipe, hf: recipe.start || 18, sc: 0, salt: 0, sugar: 0, sour: 0, oil: 0, tang: 0,
      meat: 0, stoke: 1, lid: 0, body: recipe.body || 100, turn: 0, turns: recipe.turns,
      chops: 0, used: {}, read: {}, over: null, log: [], lastGain: 0, lastScorch: false };
    for (var i = 0; i < ACTS.length; i++) p.used[ACTS[i].k] = 0;
    return p;
  }

  /* 这一手在这口锅上还有没有次数。
     **帖里圈过的动作才有配额**：没圈到就是 0 次，不是扣分 —— 玩家读到的信号是
     "案上这件东西是灰的、点不动"，跟他不知道还能放这个一样。 */
  function cap(p, k) {
    var a = null, t = tieOf(p.r), i;
    for (i = 0; i < ACTS.length; i++) if (ACTS[i].k === k) a = ACTS[i];
    if (!a) return 0;
    if (a.serve) return 99;
    if (t) for (i = 0; i < t.marks.length; i++)
      if (t.marks[i].act === k && !p.read[k]) return 0;
    return a.uses;
  }
  function mark(p, k) {
    var t = tieOf(p.r);
    if (!t) return { none: true };
    for (var i = 0; i < t.marks.length; i++) {
      if (t.marks[i].act !== k) continue;
      if (t.text.indexOf(t.marks[i].sub) < 0) return { notInText: t.marks[i].sub };  // 帖里根本没这两个字
      p.read[k] = true;
      return { ok: t.marks[i] };
    }
    return { none: true };
  }

  // 每拍锅自己走：炭势决定涨多少，压盖再闷一层，越过上限就积糊锅。
  // 炭会烧完，但**别衰减得太快**：上一版每拍 -0.35，下肉那一拍火候只涨 1.0，
  // 头三拍锅几乎是停的 —— "它在烧"这个错觉当场破掉。现在 -0.22、基础增益 5。
  function tick(p) {
    var n = p.r.need;
    var gain = 5 + p.stoke * 8 + (p.lid > 0 ? 5 : 0);
    var was = p.hf;
    p.hf = clamp(p.hf + gain, 0, 130);
    p.stoke = Math.max(0, p.stoke - 0.22);
    if (p.lid > 0) p.lid = Math.max(0, p.lid - 1);
    p.lastGain = p.hf - was;
    p.lastScorch = p.hf > n.hf[1];
    if (p.lastScorch) p.sc += 1;
    p.body = Math.max(0, p.body - (TIRED[p.r.chap] || 0.5));   // 站着烧一锅就累，越老越累
    p.turn++;
    if (p.turn >= p.turns) p.over = settle(p, true);
    return p.over;
  }

  /* ── 下一拍会怎样（纯函数，不动锅）──────────────────────
     **公式与上面 tick() 必须同一条**，所以写在这里而不是视图里另抄一份 ——
     抄一份就会漂，漂了玩家照着一个假预告下料，比不给预告更糟。
     给的是"什么都不干"那一支：越过火候上限就说会糊，香剩几拍也说。 */
  function preview(p) {
    var n = p.r.need, gain = 5 + p.stoke * 8 + (p.lid > 0 ? 5 : 0);
    var hf = Math.min(130, Math.max(0, p.hf + gain));
    return { gain: gain, hf: hf, ceiling: n.hf[1], floor: n.hf[0], scorch: hf > n.hf[1],
      stoke: Math.max(0, p.stoke - 0.22), lid: p.lid > 0 ? Math.max(0, p.lid - 1) : 0,
      beats: Math.max(0, p.turns - p.turn) };
  }

  /* 一次下料 = 一拍。返回值只有一种形状：{say|taste, over}。
     **act 内部已经 tick 过了** —— 外面别再补一拍（验收器第一版就是这么把火候算成双倍的）。 */
  function act(p, k) {
    var a = null, i, acts = actsOf(p.r.chap);
    if (p.over) return { over: p.over };
    /* 查本章那一份而不是原始 ACTS：定州／儋州那两章的「催」话说要换（见 CHAPS 里的 say）。 */
    for (i = 0; i < acts.length; i++) if (acts[i].k === k) a = acts[i];
    if (!a) return null;
    if (!a.serve && p.used[k] >= cap(p, k)) return { empty: true, tied: cap(p, k) === 0 };
    /* 身体撑不住催火 —— 消渴疾从惠州起真的管事：做菜系统不再只是"做不出"，
       而是"撑不住"。这一条只在「催」上，别的手再累也得能扇风添柴。 */
    if (a.trap && p.body < URGE_MIN) return { weak: true, need: URGE_MIN, body: Math.round(p.body) };
    if (a.serve) { p.over = settle(p, false); return { over: p.over }; }
    p.used[k]++;
    for (var f in a.fx) {
      if (f === "stoke") p.stoke = clamp(p.stoke + a.fx[f], 0, 3);
      else if (f === "lid") p.lid = clamp(p.lid + a.fx[f], 0, 3);
      else if (f === "meat") p.meat = 1;
      else if (f === "chop") p.chops++;
      else if (f === "hf") p.hf = clamp(p.hf + a.fx[f], 0, 130);
      else if (f === "body") p.body = clamp(p.body + a.fx[f], 0, 100);
      else {
        /* 切过 = 入味快：同样一勺盐，小块吃得进 1.25 倍。
           这是"切"唯一的收益，代价是它要走一拍（炭在烧、香在短）。 */
        var v = a.fx[f];
        if (p.chops > 0 && v > 0 && ["salt", "sugar", "sour", "oil"].indexOf(f) >= 0) v = Math.round(v * 1.25);
        p[f] = Math.max(0, p[f] + v);
      }
    }
    if (k === "taste") return { taste: tasteLine(p), tvec: tasteVec(p), over: tick(p) };
    return { say: a.say, over: tick(p) };
  }

  /* 一次尝味说出口的每一句，都对应"在读数 v 上，这一味偏了哪一边"。
     把这句话结构化下来，尝菜屏才有的算 —— 措辞与判据**同一份表**，
     视图里另抄一遍字符串就会漂（审计 P2-12 那条同形错）。 */
  var TASTE_W = {
    meat: { "-1": "锅里还没有主料", "1": "放错了东西 —— 这道菜不许下主料" },
    salt: { "-1": "淡", "0": "咸度对了", "1": "齁" },
    sugar: { "-1": "还缺点回甜", "0": "回甜正好", "1": "甜得发腻" },
    sour: { "-1": "闷，该来一点酸的", "0": "酸度正好", "1": "酸得倒牙" },
    oil: { "-1": "枯，油不够", "0": "油润正好", "1": "油汪得太厚" },
    hf: { "-1": "火还生", "0": "火候正好", "1": "过火了，底要糊" },
    sc: { "1": "已经糊了一截" }
  };
  /* 糖/酸/油"不足"这一句，只在**这道菜真要求它有下限**时才说 ——
     区间是 [0,2] 的东西尝不出"还缺点回甜"，说了就是假线索。 */
  var TASTE_QUIET = { sugar: 1, sour: 1, oil: 1 };

  function tasteVec(p) {
    var n = p.r.need, out = [];
    function near(v, r) { return v < r[0] ? -1 : v > r[1] ? 1 : 0; }
    function push(a, v, d) {
      var w = TASTE_W[a] && TASTE_W[a][d];
      if (!w) return;
      if (d < 0 && TASTE_QUIET[a] && !n[a][1]) return;
      out.push({ a: a, v: v, d: d, w: w });
    }
    if (n.meat === 1 && !p.meat) push("meat", 0, -1);
    if (n.meat === 0 && p.meat) push("meat", 1, 1);
    push("salt", p.salt, near(p.salt, n.salt));
    push("sugar", p.sugar, near(p.sugar, n.sugar));
    push("sour", p.sour, near(p.sour, n.sour));
    push("oil", p.oil, near(p.oil, n.oil));
    push("hf", p.hf, near(p.hf, n.hf));
    if (p.sc > n.sc[1]) push("sc", p.sc, 1);
    return out;
  }

  // 未解锁的食谱不给数字，只给方向 —— 这就是「靠经营去试」唯一的读数。
  // 措辞一律说"主料"不说"肉"：定州那锅的主料是栗子，儋州是蚝。
  function tasteLine(p) {
    var v = tasteVec(p), out = [], i;
    for (i = 0; i < v.length; i++) if (out.indexOf(v[i].w) < 0) out.push(v[i].w);
    return out.join(" · ");
  }

  /* ── 尝菜 · 录方：把尝出来的"方向"夹成"区间" ─────────────
     攒下的每一条读数都是对某个候选区间的一次**否决**：
       在 v 上尝到"不足" ⇒ 真区间的下限必然在 v 之上；
       在 v 上尝到"过头" ⇒ 上限必然在 v 之下；
       在 v 上尝到"对了" ⇒ v 必须落在候选区间里。
     判据就照这个直接重放一遍，不做区间代数 —— 少一层推导就少一处会算错的地方。 */
  var RECDIMS = ["salt", "sugar", "sour", "oil", "hf"];

  /* 就地攒，**返回整张 notes 表**（不是那道菜的那一串）—— 调用方写成
     `S.notes = ZAO.notesAdd(S.notes, id, vec)` 才不会把表换成串。 */
  /* 读数攒成"夹"，不是攒成"流水账"。
     一味只需要四个数就装得下全部信息：
       below ＝ 尝到"不足"的最高读数 ⇒ 下限必然在它之上
       in0/in1 ＝ 尝到"正好"的最低/最高读数 ⇒ 区间必须盖住这一段
       above ＝ 尝到"过头"的最低读数 ⇒ 上限必然在它之下
     ⚠ 早先这里存的是"一条一口"的数组、还配了个 24 条的上限 —— 上限会**挤掉旧读数**，
     于是玩家尝得越多，先前夹死的一味反而可能重新松开（`check_recipes.js` ③ 当场抓到 449 处）。
     玩家挣来的信息被存档上限悄悄退货，那不是省空间，那是 bug。
     存四个数之后：每加一条只会**收紧**，永不回退，存档大小也天然有界。 */
  function notesAdd(notes, id, vec) {
    var m = notes[id] || (notes[id] = {}), i, n, e;
    for (i = 0; i < vec.length; i++) {
      n = vec[i];
      if (n.a === "meat" || n.a === "sc") continue;                    // 主料/糊锅不是"夹区间"的料
      e = m[n.a] || (m[n.a] = { below: null, in0: null, in1: null, above: null });
      if (n.d < 0) e.below = e.below === null ? n.v : Math.max(e.below, n.v);
      else if (n.d > 0) e.above = e.above === null ? n.v : Math.min(e.above, n.v);
      else {
        e.in0 = e.in0 === null ? n.v : Math.min(e.in0, n.v);
        e.in1 = e.in1 === null ? n.v : Math.max(e.in1, n.v);
      }
    }
    return notes;
  }
  function fits(cand, nb) {
    if (!nb) return true;
    if (nb.below !== null && !(cand[0] > nb.below)) return false;
    if (nb.above !== null && !(cand[1] < nb.above)) return false;
    if (nb.in0 !== null && !(cand[0] <= nb.in0)) return false;
    if (nb.in1 !== null && !(cand[1] >= nb.in1)) return false;
    return true;
  }
  /* 三个候选：真区间、往上错开一整格、再往下（贴地的往上错两格）。
     ⚠ 两条规矩，都是被 `tools/check_recipes.js` 逼出来的：
       · **必须互不重叠**，偏移量取"区间宽度 + 1"。重叠的假候选只有"正好尝在边界上"才排除得掉，
         那是逼玩家复现读数、不是推理 —— 上一版步长写死 3，45 味里 39 味永远夹不死。
       · **下限贴地（[0,x]）没有"往下"这一格**，硬往下会撞回真区间或塌成空集；这种维度改成往上错两格。
     真区间落在三格的第几格**随菜而变**（视图按数值排序画），所以"永远挑最左边"赢不了。 */
  function recCands(need, dim) {
    /* REC_FALSIFY=1：换回"互相重叠"的老写法，给 ④ 用。判据必须能红，
       不然"全夹死"只是它自己没看见。写在这里而不是测试里，是因为 `recState` 按词法直接调本函数，
       测试从外面改 `ZAO.recCands` 改不动。 */
    if (typeof process !== "undefined" && process.env && process.env.REC_FALSIFY) {
      var FL = need[dim][0], FH = need[dim][1];
      return [[FL, FH], [FL + 1, FH + 1], [Math.max(0, FL - 1), Math.max(1, FH - 1)]];
    }
    var L = need[dim][0], H = need[dim][1], s = H - L + 1;
    return [[L, H], [L + s, H + s],
            L - s >= 0 ? [L - s, H - s] : [L + 2 * s, H + 2 * s]];
  }
  /* ── 拨算盘回尝 ──────────────────────────────────────
     "尝"这件事在灶前只有三杯，而且尝在锅自己走到的那几点上 —— 于是五味的读数会全落在
     区间同一侧，那种数据**信息论上就夹不出上下限**（真区间与"往上错开那一格"都合得上）。
     尝菜屏给的是另一件事：坐在桌前，**自己挑一个读数回尝一口**。
     拨到咸 7 尝出"淡"，就等于宣布"下限在 7 之上"—— 玩家要的就是这一口一口的否决。
     措辞仍从 `TASTE_W` 取，与灶前那一行同字同调，不另写一份。 */
  var DIAL = { salt: [0, 12, 1], sugar: [0, 9, 1], sour: [0, 9, 1], oil: [0, 12, 1], hf: [0, 130, 5] };
  function probeAt(r, dim, v) {
    var g = DIAL[dim], n = r.need[dim];
    if (!g || !n) return null;
    v = clampN(v, g[0], g[1]);
    var d = v < n[0] ? -1 : v > n[1] ? 1 : 0;
    return { a: dim, v: v, d: d, w: TASTE_W[dim][d] || "" };
  }
  function clampN(v, a, b) {
    v = Math.round(Number(v) || 0);
    return v < a ? a : v > b ? b : v;
  }
  /* 一味的候选里只剩一格 ⇒ 这一味"夹死了"。五味的 `pick` 拼起来就是录下来的方子。 */
  function recDone(st) {
    var i;
    for (i = 0; i < st.length; i++) if (!st[i].locked) return false;
    return true;
  }
  function recVec(st) {
    var out = {}, i;
    for (i = 0; i < st.length; i++) out[st[i].a] = st[i].cands[st[i].pick];
    return out;
  }
  /* 这一味"夹死了"没有：三格里**只剩一格**还合得上才算。
     判的是"活口数 == 1"，不是"第 0 格还活着"—— 后者等于把答案写死在下标里，
     那等于判据永远绿（真区间就是 cands[0]）。 */
  function recState(notes, id, need) {
    var out = [], i, j, c, ok, n, pick, nb = notes[id] || {};
    for (i = 0; i < RECDIMS.length; i++) {
      c = recCands(need, RECDIMS[i]);
      ok = []; n = 0; pick = -1;
      for (j = 0; j < 3; j++) {
        ok.push(fits(c[j], nb[RECDIMS[i]]));
        if (ok[j]) { n++; pick = j; }
      }
      out.push({ a: RECDIMS[i], cands: c, ok: ok, n: n, pick: pick, locked: n === 1, seen: nb[RECDIMS[i]] || null });
    }
    return out;
  }

  /* 判定要说**差多少**，不能只说"咸不足"——
     玩家看得见区间却要自己心算，那是把设计的活儿推给玩家。 */
  /* 「还要满几拍」这一条公式**全项目只此一份**（审计 P2-12）：
     judge()、nextMove() 的兜底、以及视图里那行"还要满 N 拍"以前各写了一遍，
     注释还写着"别各写一份"。没改刀多等两拍 —— 这是设计，不是巧合。 */
  function slowBeats(n, chops) { return n.slow ? n.slow + (chops ? 0 : 2) : 0; }

  function judge(p) {
    var n = p.r.need, bad = [];
    function chk(v, r, nm) {
      if (v < r[0]) bad.push(nm + " 差 " + Math.round(r[0] - v));
      else if (v > r[1]) bad.push(nm + " 多 " + Math.round(v - r[1]));
    }
    if (n.meat === 1 && !p.meat) bad.push("没下主料");
    if (n.meat === 0 && p.meat) bad.push("下了主料：这道菜不许放");
    /* 切工三件事：该切的没切 / 不许切的切了 / 整块下锅就要多炖两拍（"火候足"的"足"字更硬）。
       切过之后火候下限降 8 —— 小块容易熟透，这是它的收益。 */
    if (n.cut === 1 && !p.chops) bad.push("没改刀");
    if (n.cut === 0 && p.chops) bad.push("改过刀：这一道整颗下锅");
    var hfLo = n.hf[0] - (p.chops ? 8 : 0);
    chk(p.hf, [hfLo, n.hf[1]], "火候");
    chk(p.salt, n.salt, "咸"); chk(p.sugar, n.sugar, "甜");
    chk(p.sour, n.sour, "酸"); chk(p.oil, n.oil, "油"); chk(p.sc, n.sc, "糊锅");
    var slow = slowBeats(n, p.chops);
    if (slow && p.turn < slow) bad.push("时候不足 还差 " + (slow - p.turn) + " 拍");
    return bad;
  }

  /* ── 结局：《猪肉颂》本身就写完了所有下场 ──────────────
     「做烂了应该变成一个东西，而不是就这么失败」——
     所以每一锅都有产出：成菜入食单，糊的送给邻翁，夹生的自己拌饭，
     水多的倒进沟里喂狗，催坏的那一句是你自己按出来的。
     五种下场全部取自《猪肉颂》原句，不另造词，也不写"失败"两个字。 */
  var ENDINGS = [
    { k: "mei",   q: "火候足时他自美", to: "这一道记入食单", ok: true },
    { k: "jiao",  q: "贵者不肯吃",     to: "焦的端给邻翁，他笑着吃了 —— 乡望不跌，菜没成" },
    { k: "sheng", q: "贫者不解煮",     to: "夹生的你自己拌了饭，肚子里记一句" },
    { k: "shui",  q: "净洗铛，少著水", to: "汤倒进沟里，街上那条狗记得你这一锅" },
    { k: "cui",   q: "待他自熟莫催他", to: "这一句是你自己按出来的 —— 催了三回，锅应三回" }
  ];
  function endingOf(p) {
    var n = p.r.need;
    if (!judge(p).length) return ENDINGS[0];
    if (p.sc > n.sc[1]) return (p.used.urge || 0) > 0 ? ENDINGS[4] : ENDINGS[1];
    if (p.tang >= 3) return ENDINGS[3];
    return ENDINGS[2];
  }

  function settle(p, timeout) {
    var bad = judge(p);
    if (timeout && !bad.length) bad = [];
    p.over = { ok: bad.length === 0, bad: bad, timeout: !!timeout,
      fresh: !p.r.known && bad.length === 0, r: p.r, end: endingOf(p) };
    return p.over;
  }

  /* ── 读帖：没学过的那一手，案上根本没有 ──────────────
     《猪肉颂》《东坡羹颂》本身就是操作手册，所以"圈出他写的动词"＝学会那一手。
     **只有留了菜谱原文的黄州、惠州有这一屏**；定州、儋州没有原文，就不硬造 ——
     硬造一句"帖"就是编台词，比少一个界面严重得多。
     没圈到的动作 `uses` 记 0：不是扣分，是**你根本不知道还能放这个**。 */
  var TIE = {
    /* 帖文一律照调研档（`调研/后半生年表与食单.md`）核过的原文，**不为了迁就圈词去改他的字**。
       早先这一行写的是「柴薪莫动烟不起」——那不是《猪肉颂》，而且把「待他自熟莫催他」整句抹掉了，
       等于把「催」那颗雷的出处一起抹了。原文里三个动词本来就都在：少著水／罨／火候足。 */
    zhurou: { src: "《猪肉颂》·黄州", text: "净洗铛，少著水，柴头罨烟焰不起。待他自熟莫催他，火候足时他自美。",
      marks: [{ sub: "少著水", act: "water", note: "学会「着水」：降火候、出汤、压咸" },
              { sub: "柴头罨", act: "lid", note: "学会「罨」：压住盖闷这一拍更旺 —— 下一句就是他自己的告诫" },
              { sub: "火候足", act: "stoke", note: "学会「添柴」：炭势是一锅的发动机" }] },
    dongpo: { src: "《东坡羹颂并引》·惠州", text: "用菘苦蔓菁及芦菔法，不用肉。煮以沸汤，不以酒醢。",
      marks: [{ sub: "菘", act: "song", note: "学会「下菘」" },
              { sub: "苦蔓菁", act: "turnip", note: "学会「苦蔓菁」：这一味自带酸" },
              { sub: "芦菔", act: "radish", note: "学会「芦菔」：萝卜带一点回甜" }] },
    /* 《煮鱼法》是黄州第二张帖（9-29 那版只有《猪肉颂》一张）。
       只圈两处：主料（鲜鲫）与咸淡（盐）—— 「菘菜心」「葱白」「橘皮线」在帖上但不圈，
       案上没有那几件东西，圈了就是把没做的手教给玩家（与「莫催他」不圈是同一条理由）。 */
    zhuyu: { src: "《煮鱼法》·黄州", text: "以鲜鲫或鲤治之，入泠水中，入盐如常法，又入菘菜心一二寸许，又入葱白数寸。",
      marks: [{ sub: "鲜鲫", act: "fish", note: "学会「下鱼」：鲫鱼或鲤，治净了冷水就锅" },
              { sub: "盐", act: "salt", note: "学会「入盐」：如常法 —— 鱼汤的咸要收着放" }] }
  };
  function tieOf(r) { return TIE[r.id] || null; }

  // 身体：站着烧一锅就累，越老越累。儋州那锅「煨芋」是全游戏唯一回身体的东西。
  var TIRED = { huangzhou: 0.5, dingzhou: 0.8, huizhou: 1.2, danzhou: 1.8 };
  var URGE_MIN = 15;        // 身体低于这条，「催」就点不动 —— 身子撑不住催火

  function chapOf(id) {
    for (var i = 0; i < CHAPS.length; i++) if (CHAPS[i].id === id) return CHAPS[i];
    return CHAPS[0];
  }
  /* 一章案上摆哪几件：按 CHAPS.acts 的顺序挑，并把本章的本地名贴上去
     （定州把「添柴」叫「添炭」、「起锅」叫「起盆」——同一件动作，四章四种说法） */
  function actsOf(chap) {
    var c = typeof chap === "string" ? chapOf(chap) : chap, out = [];
    for (var i = 0; i < c.acts.length; i++) {
      for (var j = 0; j < ACTS.length; j++) if (ACTS[j].k === c.acts[i]) {
        var a = ACTS[j], lab = (c.lab || {})[a.k], ovr = (c.say || {})[a.k];
        out.push(lab || ovr ? { k: a.k, nm: lab || a.nm, ic: a.ic, uses: a.uses, col: a.col, jar: a.jar,
          ing: a.ing, quiet: a.quiet, serve: a.serve, trap: a.trap, fx: a.fx, board: a.board,
          say: ovr || (lab ? lab + a.say.slice(a.nm.length) : a.say) } : a);
      }
    }
    return out;
  }
  function dishesOf(chap) {
    var id = typeof chap === "string" ? chap : chap.id;
    return BOOK.filter(function (d) { return d.chap === id; });
  }

  /* 一手一拍响哪一个音（SFX 台账里的 id）。写在模型里是因为三处要用同一份：
     原型 灶前.html、主游戏 行旅.js、以及音效覆盖的统计 —— 各写一份就会漂。 */
  var SND = {
    stoke: "fire", urge: "fire", water: "water", lid: "lid", unlid: "lid",
    prep: "gavel", taste: "taste", serve: "dish", oil: "scorch", oyster: "scorch",
    meat: "dish", salt: "dish", sugar: "dish", sour: "dish", sauce: "dish", honey: "dish",
    song: "water", radish: "water", turnip: "water", coconut: "water",
    chestnut: "lid", taro: "lid"
  };

  /* ── 下一步做什么：一个只看得见案上数字的玩家 ─────────────
     验收器（tools/stove_greedy.js）与开发用自动机（行旅.js 的 stoveAuto）共用这一份。
     两边各写一遍迟早会漂，漂了的后果正是那条老教训：「验收器绿着，玩家过不去」。
     顺序本身就是「可读性」的定义：主料 → 味道 → 火 → 时候，玩家从画面推得出同一条。 */
  var SRC = {
    salt: ["salt", "song"], sugar: ["sugar", "honey", "radish", "coconut"],
    sour: ["sour", "turnip", "oyster"], oil: ["oil", "sauce", "meat", "oyster"],
    meat: ["meat", "fish", "chestnut", "shanyu", "oyster"]
  };
  function usable(p, acts, k) {
    for (var i = 0; i < acts.length; i++) if (acts[i].k === k)
      return !!acts[i].serve || p.used[k] < cap(p, k);
    return false;
  }
  function first(p, acts, keys) {
    for (var i = 0; i < keys.length; i++) if (usable(p, acts, keys[i])) return keys[i];
    return null;
  }
  /* 补某一个维度时挑**增量最小**的那件 —— 这不是替玩家作弊，恰恰是"看着数字打"的定义：
     要补 1 分甜，拿蜜(+4)下去就直接越过 1–3 那扇窗。会算的人不这么干。 */
  function cheapest(p, acts, dim) {
    var best = null, bv = Infinity, i, a, v;
    for (i = 0; i < acts.length; i++) {
      a = acts[i];
      if (SRC[dim].indexOf(a.k) < 0 || !usable(p, acts, a.k)) continue;
      v = (a.fx || {})[dim] || (a.fx || {}).meat || 0;
      if (v > 0 && v < bv) { bv = v; best = a.k; }
    }
    return best;
  }
  /* 等火候那一手不猜：拿**真模型**试一手（act 自带 tick），看落点还在不在区间里。
     taste 不添火、water 压火、stoke 保火 —— 三件都印在案上，玩家有的信息它都有。 */
  function probe(p, k) {
    var c = JSON.parse(JSON.stringify(p));
    c.r = p.r;                     // 食谱要留在原引用上，不然读帖那张表按对象查就断了
    act(c, k);
    return c;
  }
  function hold(p, acts) {
    var n = p.r.need, list = ["taste", "water", "stoke", "lid"], cands = [], i, c;
    for (i = 0; i < list.length; i++) if (usable(p, acts, list[i])) cands.push(list[i]);
    for (i = 0; i < cands.length; i++) {
      c = probe(p, cands[i]);
      if (!c.over && c.hf <= n.hf[1] && c.hf >= n.hf[0] - (c.chops ? 8 : 0) && c.sc <= n.sc[1])
        return cands[i];
    }
    cands.sort(function (x, y) { return probe(p, x).hf - probe(p, y).hf; });
    return cands.length ? cands[0] : null;
  }
  function nextMove(p, noPrep) {
    var n = p.r.need, acts = actsOf(p.r.chap), dims = ["salt", "sugar", "sour", "oil"], k, i;
    if (n.cut === 1 && !p.chops && !noPrep && usable(p, acts, "prep")) return "prep";
    if (n.meat === 1 && !p.meat) {
      /* 菜谱自己报名主料（r.main）：一案有两样能当主料的东西时（黄州下肉/下鱼、
         儋州下芋/撬蚝），照 SRC 顺序挑会拿错 —— 猪肉鱼羹就是这么"做"出来的。 */
      k = (p.r.main && usable(p, acts, p.r.main)) ? p.r.main : first(p, acts, SRC.meat);
      if (k) return k;
    }
    for (i = 0; i < dims.length; i++) {
      if (n[dims[i]][0] - p[dims[i]] > 0.5) { k = cheapest(p, acts, dims[i]); if (k) return k; }
    }
    if (p.hf < n.hf[0]) return first(p, acts, ["stoke", "lid"]);
    if (p.hf > n.hf[1]) return first(p, acts, ["unlid", "water"]);
    var slow = slowBeats(n, p.chops);
    if (p.turn < slow) return hold(p, acts);
    return null;
  }

  var API = { ACTS: ACTS, BOOK: BOOK, CHAPS: CHAPS, TIE: TIE, tieOf: tieOf,
    TIRED: TIRED, URGE_MIN: URGE_MIN, ENDINGS: ENDINGS, endingOf: endingOf,
    chapOf: chapOf, actsOf: actsOf, dishesOf: dishesOf,
    newPot: newPot, act: act, tick: tick, mark: mark, cap: cap, preview: preview,
    slowBeats: slowBeats,
    tasteLine: tasteLine, tasteVec: tasteVec, judge: judge, settle: settle,
    notesAdd: notesAdd, recState: recState, recCands: recCands, fits: fits,
    recDone: recDone, recVec: recVec, probeAt: probeAt, DIAL: DIAL,
    RECDIMS: RECDIMS,
    /* 一口 6 银钱：一道菜从空表夹死要 6～8 口（`tools/check_recipes.js` ① 在盯这个数），
       即 36～48 银钱。一章能攒到的银钱只够录一两道 —— 这是"选哪道菜值得不再猜"的取舍，
       不是"攒够了全录下来"的手续费。定到 12 就变成后者了（一锅 96，玩家根本不会点）。 */
    REC_FEE: 6,
    SND: SND, SRC: SRC, usable: usable, nextMove: nextMove };
  /* 一份代码两边跑：浏览器挂 window.ZAO，Node 里挂 module.exports 给
     tools/stove_greedy.js 当贪心验收器的被测对象 —— 验收器必须跑**真的这份模型**，
     不能另抄一遍（旧线那条「平行模拟器绿了不等于游戏能玩」就是这么来的）。 */
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.ZAO = API;
})();
