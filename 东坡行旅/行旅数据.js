/* 东坡行旅 · 章数据
   台词一律取自苏轼本人诗文/书信，出处随条目走；传说与史实在 tag 上分开标。
   数值全部印在牌面上：玩家只看卡面就能算出该出哪张，不需要猜。
   CHAPTERS 下每章一份；DATA 是当前章的引用，切章 = 换引用 + 重置状态。 */
var CHAPTERS = {};

/* ── 三枚实物印章：官印／私印／空印 ──────────────────
   印面一律没有字，印文照旧由 HTML 叠上去（字要走资产就得等 1080 那批）。
   章末与终局原本三个位置共用一张 ui-seal-1，「印＝身份」这条设计就只剩文字在说。
   ⚠ **盘上的文件名和 产图交付.md 的说法是反的**：`seal-kong.png` 才是满面朱红那方，
   `seal-si.png` 是没沾过印泥的白石。这里按**图**接，不按名字接；
   `python tools/check_seals.py` 量朱砂覆盖率守着这条，谁把文件对调回去它就会红。 */
var SEAL_ART = { guan: "图标/seal-guan.png", si: "图标/seal-kong.png", kong: "图标/seal-si.png" };
function sealArt(kind, got) {
  return SEAL_ART[got ? (kind || "si") : "kong"] || "";
}

/* ── 背景自带的那块空白匾 ────────────────────────────
   即梦这批 sc-* 实景每张都在墙上画好了一块**完全空白的素面匾/屏**，
   字用 HTML 叠上去就行 —— 这样标题是「长在场景里」的，不是又贴一条红横幅。
   坐标是从原图像素量的（占整图归一化），不是估的；改背景必须同时改这张表，
   表里没有的就照旧走横带，不许硬猜。
   注：sc-banquet2-1 交付文档给的 0.41/0.20/0.34/0.30 底下沿压到桌沿，改成 .21 高。 */
var BOARDS = {
  "sc-hub2-3.webp":    [0.13, 0.16, 0.20, 0.16],
  "sc-hub-snow-1.webp": [0.10, 0.11, 0.23, 0.15],
  "sc-dz-hub-1.webp":  [0.05, 0.10, 0.33, 0.24],
  "sc-hiz-hub-3.webp": [0.08, 0.14, 0.26, 0.23],
  "sc-dan-hub2-1.webp": [0.11, 0.08, 0.23, 0.21],
  "sc-court2-2.webp":  [0.333, 0.09, 0.335, 0.21],
  /* 10-11 换新绘（1080×608，用户拍板 slot4）：金框密集核心 x 0.333..0.669，上沿人工避让瓦带取 0.09。 */
  "sc-banquet2-1.webp": [0.415, 0.175, 0.33, 0.14],
  "sc-letter2-1.webp": [0.04, 0.07, 0.38, 0.36],
  /* 下面四条是 `measure_slots.py snap <图> <种子x> <种子y>` 吸附出来的 ——
     人眼点一下匾，泛洪把它的边描出来。比全局找矩形可靠：这些画里"亮而无色"的块
     一大把（窗、天光、白砂锅），全局找必错。
     没列进来的（定州灶前／儋州堂上／黄州灶前／上街／三章席间／章末／终局）
     是泛洪顺着浅色墙漏成整幅、或匾太窄放不下标题，**不硬猜**，照旧走横带。 */
  "sc-dz-court2-1.webp":  [0.333, 0.044, 0.333, 0.196],
  "sc-hiz-court2-1.webp": [0.375, 0.056, 0.235, 0.156],
  "sc-hiz-stove2-1.webp": [0.379, 0.089, 0.267, 0.130],
  "sc-dan-stove2-1.webp": [0.331, 0.044, 0.346, 0.159],
  /* 下面五条是**人眼画框验证**定的（snap 泛洪会顺着浅色墙漏成整幅）。
     席间那三条只取匾的**上沿**：`.seated` 从 y 124 起，匾的下半截是在座客人的头，
     黄州席间那次副题压到潘大临脸上就是这么来的。所以匾上只放桌名，一行就够。
     黄州灶前 sc-stove-1 跳过 —— 那块匾只有 9.5% 宽，「灶前 · 黄州猪肉」八个字压不进去，
     硬塞就是孤字，照旧走横带。 */
  "sc-dan-hall2-1.webp":  [0.345, 0.195, 0.19, 0.11],
  "sc-dz-stove2-1.webp":  [0.33, 0.09, 0.28, 0.18],
  "sc-dz-banquet-1.webp": [0.44, 0.065, 0.34, 0.085],
  "sc-dan-banquet-1.webp": [0.41, 0.062, 0.23, 0.086],
  "sc-hiz-banquet-1.webp": [0.33, 0.06, 0.37, 0.08],
  /* ── 下面十条是 9-27 新风格那批（fx-* / fx2-*）──
     坐标来自产图侧的机读表 `素材/叠字框.json`，取的是 **face**（匾里那块真正干净的素面），
     不是 plaque（含织金边）—— 放字要用 face，边上是回纹。
     那十条坐标是 `tools/grid_overlay.py` 叠网**人工读**的，每条都过了
     `tools/face_check.py` 画框回验；自动量测在这套风格上判了死刑（产图交付 §50、§53：
     四个检测器分别把天空、竹帘、画面右侧无关亮块当成匾）。
     ⚠ 手抄一张表一定会漂 —— 所以 validate_cards 有一条断言**拿这份表去对 叠字框.json**，
     两边不一致就红。改任何一条之前先想清楚要改哪一边。
     第 5 个元素 "light" ＝ 那一屏匾下是阴影/亮雾，副题要走浅色字（定州堂前 B 下半片在影子里）。 */
  "fx-court-c-4.webp":        [0.33, 0.07, 0.35, 0.15],      // 黄州 · 堂上
  "fx-stove-c-4.webp":        [0.02, 0.12, 0.25, 0.40, "light"],      // 黄州 · 灶前（素墙，竖排三四行；x>0.27 压蓑衣斗笠。整幅还吃 #bg.deep 的 blur+brightness(.66)，深字压上去对比只剩 31）
  "fx-dan-b-3.webp":          [0.30, 0.12, 0.40, 0.30],      // 儋州 · 黎市（近纯白，必须深色字）
  "fx-hz-hub-snow-c-2.webp":  [0.40, 0.22, 0.205, 0.10],     // 黄州 · 堂前雪
  "fx-dan-hall-b-3.webp":     [0.36, 0.23, 0.28, 0.18, "light"],   // 儋州 · 载酒堂（二十屏里最大的可写面）
  // ↑ 原来标的是 "lightsub"（以为"匾面亮、只有匾下那道额枋在影里"）。9-29 晚把副题收进匾里之后
  //   像素量出来推翻了这个前提：**素面自己就在影里**（底 101／108），深字压上去只有 56／25，
  //   浅字是 131／123。旧读数里主题那行 62 也只是刚过 58 那条线 —— 换句话说这块匾一直就该走浅色，
  //   以前副题在匾外（更暗的额枋上）反而把"浅字才对"这件事遮住了。判据见 check_board_contrast。
  "fx2-hz-hub-c-4.webp":      [0.40, 0.19, 0.198, 0.11, "lightsub"],   // 黄州 · 堂前（匾面晒得亮、匾下那道门楣在檐影里）
  "fx2-hiz-hub-c-1.webp":     [0.338, 0.225, 0.297, 0.105, "lightsub"], // 惠州 · 堂前（室外屏里匾最宽；匾下暗额枋）
  "fx2-dz-hub-b-3.webp":      [0.383, 0.205, 0.175, 0.095, "light"],  // 定州 · 堂前（雪幕里连匾面都是灰的 → 堂名也要浅色字）
  "fx2-dan-hub-b2-3.webp":    [0.318, 0.232, 0.254, 0.093, "lightsub"], // 儋州 · 院前正午大旱（匾面晒白，匾下是暗屋檐）
  "fx2-dan-hub-dusk-b-3.webp": [0.31, 0.225, 0.222, 0.14],   // 儋州 · 院前傍晚（匾倾 -3°，要贴得准得转一下）
  /* 9-27 深夜产图侧补的第三批（fx3-*）：旧 fx-hiz/fx-dan 那几组**一张匾都没有**，
     他们重画了席间·堂上·灶前，并把坐标一并人工读好、过 face_check 回验。 */
  "fx3-hz-banquet-c-2.webp":   [0.075, 0.02, 0.36, 0.078],   // 黄州 · 席间（六字有余）
  "fx3-hiz-banquet-c-2.webp":  [0.25, 0.035, 0.48, 0.1],     // 惠州 · 席间（全表最宽的可写面）
  "fx3-dz-banquet-b-3.webp":   [0.345, 0.08, 0.255, 0.085, "light"], // 定州 · 席间（夜戏，匾面本身在暗部）
  "fx3-dan-banquet-b-1.webp":  [0.22, 0.1, 0.235, 0.07],     // 儋州 · 席间（只取上沿，匾实际铺到 y 0.28）
  "fx3-dz-court-b-2.webp":     [0.375, 0.195, 0.225, 0.09, "lightsub"],  // 定州 · 堂上（匾面是亮的，匾下那道额枋近黑 27 → 副题必须浅色）
  "fx3-hiz-court-c-2.webp":    [0.38, 0.195, 0.22, 0.14],    // 惠州 · 堂上
  "fx3-dz-stove-b-3.webp":     [0.145, 0.075, 0.24, 0.195, "light"],  // 定州 · 灶前（B 组：匾面本身在暗部，深褐字几乎消失）
  "fx3-hiz-stove-c-2.webp":    [0.235, 0.185, 0.235, 0.185, "light"], // 惠州 · 灶前（原件匾面白，但整幅过 #bg.deep(.66) 之后底只剩 108 → 标题也要浅色）
  "fx3-dan-stove-b-2.webp":    [0.435, 0.075, 0.28, 0.19, "light"],   // 儋州 · 灶前（同定州）
  // 黄州来信那张表里有 face（案上摊开的素纸），**故意不接**：
  // 信屏自己已经叠了一张 .letterimg 纸 + .letterbox 正文，标题再落到背景那张纸上，
  // 就是叠在正文中间的两张纸。这块留给「信屏改版」那一轮一起处理。
  "fx3-hiz-street-c-1.webp":   [0.545, 0.21, 0.185, 0.095],  // 惠州 · 上街（正对的横楣）
  "fx4-dz-street-b-2.webp":    [0.415, 0.225, 0.16, 0.11, "light"]    // 定州 · 上街（与 fx3 同宽，但倾角 0°，字是正的。石青匾面过 .66 后底 110/126，深字两边都只剩 53~65）
};
/* ── 章末那五行小结的字色 ──────────────────────────────
   `.seal p` 没有纸框，底就是**本章的章末封面本身**（`chapter.end2`）。四张封面亮度差一大截，
   一个深褐字服不了四屏 —— 10-11 那四张换到 1080 原件之后，惠州的山正好压在诗行上：
   底从 141 掉到 103，深字对比 58／50，`check_board_contrast` 判红。
   套路照 BOARDS 第 5 项：**判据写在数据表里，代码只查表**，别在 CSS 里按章名硬编。
   名单里点名的是"这一张封面要用浅字"，换封面＝换键，旧键自动失效，不会留下一个说不清的开关。 */
var SEAL_LT = {
  "cover-hiz-2.webp": 1    // 惠州 · 章末（岭南山色压住交出去／换回来那四行）
};
/* ── 开场那枚空印的文案表 ──────────────────────────────
   放在数据文件里而不是 行旅.js：验收器（shot_game）按它决定"哪一章进得去这一屏"，
   读不到就只能手抄一份映射，而手抄的映射一定会漂（`hub` fallback 那次就是这么栽的）。
   `core` 是整局游戏的一句话口径，也落在这里 —— 开场屏与规则屏共用同一句，不各写一份。 */
/* ── 整局游戏的一句话口径 ──────────────────────────────
   对外描述现在有三个动词（做菜／断案／赴席）没有主次，玩家记不住这游戏是干什么的。
   收敛成一句，**开场屏、规则屏、章末结算共用同一条**，不各写一份 —— 各写一份就会漂成三种说法。 */
var CORE = "用他写过的东西，换他活下去的地方。";
/* 舆图那一屏正中间铺的行旅图：**四章共用同一张**，因为那一屏画的是整条贬谪路线，
   不是本章一地（本章自己的图是 `map-hz/dz/hiz/dan` 那批，还没接线，见交接 §39）。
   9-30 重画的 16:9 那张（`maptrip-1`）替掉了原来 CSS 里钉死的 540×720 竖图 ——
   竖图塞进 1.77 的框按 cover 铺，等于裁掉 59% 的高度再放大 1.7 倍在糊。 */
var MAPTRIP = "maptrip-1.webp";
/* 读帖那张纸同理：CSS 里不留 url，四章都指这一张。9-30 产的横长素纸，
   替掉原来被横拉 1.85 倍的竖纸 `ui-paper-5`（那道折角被拉成了一片 flap）。 */
var TIEPAPER = "paper-wide-1.webp";
/* ── 舆图屏的第二面：本章自己的那一幅 ─────────────────────
   `chapmap` 是本章一地的舆图（9-30 重画的 `map2-*` 那批，16:9 高清 1080×608）。
   画里都留了一块**完全空白的素木牌**等叠州名 —— 即梦写不出可靠汉字，字走 HTML。
   `plaque` 就是那块素面的**可写区**，坐标是拿 2% 细网格压在 1080×608 的原件上
   一格一格读出来的（四章各读一份：提示词里钉的是同一个位置，出图却各自偏了 0.02~0.09，
   **共用一套坐标这件事在第四张上就没成立**）。四个数是 x / y / 宽 / 高，占整幅图的比例。
   ⚠ 州用的是**第二批**（`map2-dan2-3`）：第一批那张画得最好，可那条"自大陆来的极淡航线"
   正好**横穿过牌面**，州名叠上去被一条白线切开 —— 提示词里原本只禁了"山、树、屋舍压住"，
   没禁"线穿过"。重抽时把禁令写成「板面上一条线都不许有」＋「航线从牌子下方绕过去」，
   四张候选的牌面就全干净了。**"不许被压住"要按遮挡物的种类逐项列，漏一类就穿一类。** */
var EDDICT = {
  huangzhou: {
    title: "到任第一日 · 黄州",
    kicker: "元丰三年 · 御史台狱出来，到黄州任上",
    edict: "检校水部员外郎 · 黄州团练副使 · 本州安置",
    ban: "不得签书公事",
    banSrc: "《宋史·苏轼传》【有据】",
    thesis: "印是空的。他还有笔。",
    verse: "长江绕郭知鱼美，好竹连山觉笋香。",
    vsrc: "《初到黄州》",
    hint: "这一行是制词里的。印就在案上 —— 试一试。",
    core: CORE
  },
  /* 定州那一纸教的不是「印是空的」，是**空印这两个字本来是什么意思**：
     先印后书 —— 印是真的、沾了印泥的，纸却是空的。这一状要入账，
     而账不在这一章结，在惠州那一章折成人情扣掉（`court.repay` 8 分／状，人情最低 20，物议各加一分）。
     所以这一屏多两样黄州没有的东西：一枚**真官印**（`press`），和一行**债的预告**（`owe`）。
     案名与口供一律是拟的，史实锚点只有「转运使奏先印后书，因有敕根括」这一条；
     旧档把敕系于《长编拾补》卷八，复核无命中（该卷只到元祐八年十月），**故纸面上不印卷数**。 */
  dingzhou: {
    title: "到任第一日 · 定州",
    kicker: "元祐八年十二月二十三日 · 九月十四日出都，走了两个多月",
    edict: "端明殿学士 · 翰林侍读学士 · 知定州军州事",
    ban: "先印后书",
    banSrc: "有敕根括定州公使库空印文状 —— 转运使张问奏「见任守臣于文状先印后书」【有据 · 卷次待查】",
    press: "seal-guan-1-cut.png",
    thesis: "印是真的，纸是空的。",
    owe: "一状入账：进惠州先折八分人情（人情最低二十），物议各加一分。",
    verse: "知我空堂坐画灰。",
    vsrc: "《寄馏合刷瓶与子由》·定州任上，自题「元祐八年十二月二十五日醉睡中作」",
    hint: "这一枚沾了印泥。按下去 —— 纸已经盖好了，字还没填，那一栏空着，就叫空印。",
    core: CORE
  }
};
/* ── 堂上「对席」那一张脸 ──────────────────────────────
   四章的对手不是同一个人，而且**三章的对手根本没有脸**：
   黄州是佃户与地主两个龙套、定州是惯例与案牍、惠州是台谏那纸弹章 —— 都不在场，也没画像。
   没画过脸的挂虚线空框（信墙那一轮立的规矩：**挂一张不相干的脸比空着严重**），
   被破的反应由框子的震动与意图那句原话承担；只有儋州真换表情 —— 那是姜唐佐。 */
var FOE = {
  huangzhou: { nm: "两造 · 陈五 何九", art: "", why: "龙套无画像" },
  dingzhou: { nm: "转运使 · 案牍", art: "", why: "人不在堂上" },
  huizhou: { nm: "台谏 · 弹章", art: "", why: "人不在堂上" },
  danzhou: { nm: "姜唐佐", art: "dan-tuozuo-1", why: "从轼学" }
};
/* 匾上的字要留出边框与云头，四周各收一成；收完太窄就干脆别叠字。 */
/* 匾的可用区 ＝ 量出来的素面 ∩ 界面上没被常驻浮层占住的那块。
   两侧各有一道硬边界：左边入口列占到 x 102，右边檐下木牌从 x 1115 起。
   所以这里**夹**一下再返回 —— 叠字框.json 里那条 0.02 起的是「墙在哪」，
   不是「字能写到哪」；黄州灶前那面素墙就是例子：墙一直铺到 x 0.02，
   可最左那 80 px 压在入口图标底下，字写上去等于没有。
   数还是照表抄（validate_cards 有一条断言拿这张表对 叠字框.json），
   让位是代码的事。 */
var UI_LEFT = 110 / 1280, UI_RIGHT = 1115 / 1280;
function boardRect(img) {
  var b = BOARDS[img];
  if (!b) return null;
  var ix = b[2] * 0.11, iy = b[3] * 0.14;
  var L = b[0] + ix, T = b[1] + iy, w = b[2] - ix * 2, h = b[3] - iy * 2;
  if (L < UI_LEFT) { w -= (UI_LEFT - L); L = UI_LEFT; }
  if (L + w > UI_RIGHT) w = UI_RIGHT - L;
  // 高过 34 就收：标题是一行 25px × 1.3 行高 = 32.5px，40 那道线会把
  // 儋州席间那种「只取上沿」的扁匾（内缩后 36px）判死、静默退回横带。
  // 真放不下的是两行那种 —— 那由 plate() 里 room = H >= 58 分开管。
  // ⚠ room 吃的是**这里内缩之后**的高，不是 叠字框.json 里那个 face 原高：
  //   定州堂前那块 face 0.095（68px）内缩掉 28% 只剩 49 → 副题照旧落在匾下的素墙上。
  if (w * 1280 < 150 || h * 720 < 34) return null;
  return [L, T, w, h];
}

/* ── 音效清单 ────────────────────────────────────────
   实测过：file:// 拦 fetch（Godot 那条就死在这），但**不拦 `<audio>` 读本地媒体**。
   所以音效就是一个 <audio> 元素池，不引 WebAudio 合成 —— 用户明确要真素材。
   这张表就是「待产清单 + 授权台账」：
     f   文件名（素材/音效/ 下，.mp3）
     on  什么时候响
     src 出处 URL —— **拿到素材必须填**，空着就是还没落地，验收器按这个报到位率
     lic 授权（CC0 / 免费商用注明作者 / …）
   写在这里而不是 json：file:// 不许 fetch，json 读不进来。 */
var SFX_DIR = "素材/音效/";
/* 2026-09-26 落地 **20/20**，出处全部来自 OpenGameArt（服务端渲染、帖子页明写授权，
   用 tools/sfx_fetch.js + tools/sfx_run.sh 取，逐条台账在 _shots/sfx_log.jsonl）。
   `warn` 是**语义账**：素材格式买对了、意思没完全买对 —— 听感不对就换，别当成已完成。
   目前带 warn 的 7 条：card／water／lid／cold／paper／seal／brush（10-04 gavel 换真木击，warn 摘掉）。
   10-04 换源记录：gavel/lid 走 OGA 新宽词（mallet／kitchen——原判零结果的是窄词），文件从此
   不写死 .mp3：表里带 ext 的按 ext 播（wav 浏览器原生解；AIFF 手解 chunk 转 WAV——本机无
   ffmpeg、lameenc 装不上、python 3.14 无 aifc）。Pixabay 实测抓不动：改版后直链全走播放器 JS，
   搜索/详情页都无 mp3（tools/_sfx_dbg.js 留证）；淘声网搜索页空壳。cold 可达源已穷，保留 warn。
   `cap` 是**一响的上限（秒）**：素材是一整卷的（10 次翻页 9.59 秒、7 口脆响 6.90 秒），
   引擎播到点就停。能算出来的按算出来的钉 —— 卷里几次事件 ÷ 全长：paper 10 次／9.59s ≈ 0.96、
   taste 7 次／6.90s ≈ 0.99，都取 1.0；事件数就写在下面那行 `lic` 的标题里，不是猜。
   其余没写 cap 的走引擎默认 1.5 秒。素材本身不对味的那几支（card／water／brush／gavel／seal／cold）
   cap 只能止住"太长"，止不住"不像" —— 那要耳朵，见 `warn`。
  双击 `东坡行旅/音效自检.html` 可以逐条试听、逐条看时长与出处。
   取不到的词记在这里，别再试：gavel／court／judge／stamp／wax／notary／ink／sizzle／frying／
   brush／quill／pot lid／wooden knock 在 OGA 全是零结果。 */
var SFX = [
  { id: "card",    f: "card",    on: "出一张牌（堂上质证／灶前手法／席间上菜共用一声）" , q: "纸牌 翻牌 音效",
    src: "https://opengameart.org/content/equipment-clicks-ii", lic: "CC0 · OpenGameArt · Equipment Clicks II（作者 LFA）",
    warn: "取到的是 UI 点击，不是纸牌落桌" },
  { id: "gavel",   f: "gavel",   ext: "wav",
    on: "惊堂木 —— 黄州堂上判下那一瞬" , q: "惊堂木 音效",
    src: "https://opengameart.org/content/metal-and-wood-impact-sound-effects",
    lic: "CC-BY 3.0 · OpenGameArt · Metal and Wood Impact Sound Effects（作者 Ogrebane）· 取 wood4.aif：四记木击里攻击最快（27ms）、余响最长（227ms），最接近“啪——嗡”那一记" },
  { id: "seal",    f: "seal",    on: "盖章：空印／借印／章末三印，同一声但章末叠一下纸响" , q: "印章 盖章 音效",
    src: "https://opengameart.org/content/button-press", lic: "CC-BY-SA 3.0 · OpenGameArt · Button Press（作者 Gobusto）",
    warn: "0.7 秒的一声按压，听着更像按按钮不像盖石印；上一版 Single Key Press 是 21 秒的拼接，已换掉" },
  { id: "reject",  f: "reject",  on: "递不上去／被驳回：一声闷的" , q: "闷响 撞击 低频 音效",
    src: "https://opengameart.org/content/thud-underfoot", lic: "CC-BY 3.0 · OpenGameArt · Thud Underfoot（作者 spookymodem）" },
  { id: "fire",    f: "fire",    on: "开火、添柴：灶前起势" , q: "柴火 燃烧 噼啪 音效",
    src: "https://opengameart.org/content/fire-crackling", lic: "CC0 · OpenGameArt · Fire Crackling（作者 AntumDeluge）" },
  { id: "water",   f: "water",   on: "少著水、洗锅" , q: "倒水 水声 音效",
    src: "https://opengameart.org/content/running-water", lic: "GPL 3.0 或 CC-BY-SA 3.0（双授权，取其一）· OpenGameArt · Running water（作者 Arthur）",
    warn: "是溪水长流，不是倒那一下" },
  { id: "lid",     f: "lid",     ext: "wav",
    on: "罨火（草锅盖压上去）" , q: "锅盖 瓷器 碰撞 音效",
    src: "https://opengameart.org/content/kitchen-ambience-sfx",
    lic: "CC-BY 3.0 / CC-BY 4.0（取 CC-BY 3.0）· OpenGameArt · Kitchen Ambience, SFX（作者 DavidW）· 取 cookware_clatter.wav 首记敲击，裁 1.15s 带 60ms 淡出",
    warn: "是灶上锅盆轻碰的一记，不是草锅盖压上去那口闷 —— 可达源里最接近的一支，试听不满意就在 音效自检.html 里对账" },
  { id: "taste",   f: "taste",   on: "尝味" , q: "尝 吸溜 人声 音效", cap: 1.0,
    src: "https://opengameart.org/content/7-eating-crunches", lic: "CC0 · OpenGameArt · 7 Eating Crunches（作者 StarNinjas）" },
  { id: "scorch",  f: "scorch",  on: "糊锅 —— 这一声是惩罚，要难听得恰到好处" , q: "烧焦 油爆 刺啦 音效",
    src: "https://opengameart.org/content/acid-burn-sounds", lic: "CC-BY 3.0 · OpenGameArt · Acid Burn sounds（作者 mikhog）" },
  { id: "dish",    f: "dish",    on: "菜上桌：碟子碰桌面" , q: "碗碟 放桌 陶瓷 音效",
    src: "https://opengameart.org/content/cutlery-sounds", lic: "CC0 · OpenGameArt · cutlery sounds（作者 TinyWorlds）" },
  { id: "cheer",   f: "cheer",   on: "尽欢：盏响加一声极短的人声" , q: "酒杯 碰杯 欢笑 音效",
    src: "https://opengameart.org/content/cheers-0", lic: "CC0 · OpenGameArt · Immediate Cheers（作者 Nocturnal_Vanguard）" },
  { id: "cold",    f: "cold",    on: "冷场：一息空白，几乎无声" , q: "沉默 环境 底噪 音效",
    src: "https://opengameart.org/content/breeze", lic: "CC-BY 3.0 · OpenGameArt · Breeze（作者 Sharm）",
    warn: "是微风，不是那口气的空白" },
  { id: "coin",    f: "coin",    on: "上街付钱：铜钱串" , q: "铜钱 金属 碰撞 音效",
    src: "https://opengameart.org/content/coins-sounds", lic: "CC-BY 3.0 · OpenGameArt · Coins Sounds（作者 jalastram）" },
  { id: "paper",   f: "paper",   on: "拆信、翻页、读帖圈字" , q: "纸张 翻页 音效", cap: 1.0,
    src: "https://opengameart.org/content/10-book-page-flips", lic: "CC0 · OpenGameArt · 10 Book Page Flips（作者 StarNinjas）",
    warn: "一段里有十次翻页，当单次响太长" },
  { id: "brush",   f: "brush",   on: "毛笔落纸（插一句选了真句那一下）" , q: "毛笔 写字 摩擦 音效",
    src: "https://opengameart.org/content/pencil-sounds", lic: "CC0 · OpenGameArt · Pencil Sounds（作者 AntumDeluge）",
    warn: "是铅笔刮纸，毛笔的味淡；OGA 搜 brush／quill／ink 全零结果" },
  { id: "step",    f: "step",    on: "Q 版小人在市井横卷上走" , q: "脚步 石板路 音效",
    src: "https://opengameart.org/content/fantozzis-footsteps-grasssand-stone", lic: "CC0 · OpenGameArt · Fantozzi's Footsteps (Grass/Sand/Stone)（作者 Fantozzi）" },
  { id: "amb-stove", f: "amb-stove", loop: 1, on: "灶前环境：柴火噼啪＋油响" , q: "灶台 柴火 环境 循环",
    src: "https://opengameart.org/content/fireplace-sound-loop", lic: "CC0 · OpenGameArt · Fireplace Sound loop（作者 PagDev）" },
  { id: "amb-street", f: "amb-street", loop: 1, on: "上街环境：市井人声、叫卖压得很低" , q: "市集 叫卖 人群 环境",
    src: "https://opengameart.org/content/crowd-shoutingspeaking-ambience", lic: "CC0 · OpenGameArt · Crowd Shouting/Speaking Ambience（作者 StarNinjas）" },
  { id: "amb-rain",  f: "amb-rain",  loop: 1, on: "惠州环境：雨（绍圣元年他一路淋雨到任）" , q: "雨声 环境 循环",
    src: "https://opengameart.org/content/rain-gutter-loop", lic: "CC0 · OpenGameArt · Rain Gutter Loop（作者 Ogrebane）" },
  { id: "amb-sea",   f: "amb-sea",   loop: 1, on: "儋州环境：海风与浪" , q: "海浪 海风 环境 循环",
    src: "https://opengameart.org/content/beach-ocean-waves", lic: "CC0 · OpenGameArt · Beach Ocean Waves（作者 jasinski）" }
];

/* ── 配乐（BGM）表 ───────────────────────────────────────
   与 SFX 同一套规矩：真素材、src 必填、lic 原样进「制作与授权」屏（check_lic 闸盯着）。
   文件放 素材/音乐/（MUS_DIR），与音效分开 —— check_audio 两边都要扫，漏一个目录就是假绿。
   分层的分工：SFX 表 loop:1 那四支环境声管「屋里的柴火、街上的叫卖、檐下的雨、门外的浪」，
   这张表管「这一站长什么样」—— 封面一曲、四章各一主题、终局一曲，两轨各走各的音量，
   声设置弹层（#章/snd）里分开调。
   `loop: 1` 与 SFX 表同义：整支循环，不进 check_audio「一响上限」那本账。
   听感对不对**耳朵说了算**：试听台在 音效自检.html，哪支不对就换表里那一行 —— 台账跟着改。 */
var MUS_DIR = "素材/音乐/";
var MUS = [
  { id: "mu-cover",     f: "mu-cover",     ext: "ogg", loop: 1,
    on: "封面主题曲（标题那一屏起就唱）", q: "中国风 标题曲 循环",
    src: "https://opengameart.org/content/generic-2-minute-asian-arrangement",
    lic: "CC-BY 3.0 · OpenGameArt · Generic 2-Minute Asian Arrangement（作者 spring-spring）" },
  { id: "mu-huangzhou", f: "mu-huangzhou", ext: "mp3", loop: 1,
    on: "黄州主题：躬耕东坡、一口白砂锅的安顿", q: "平和 田园 管弦 循环",
    src: "https://opengameart.org/content/a-tale-of-peace-rpg-orchestral-essentials-peace-music",
    lic: "CC-BY 3.0 · OpenGameArt · \"A Tale of Peace\"（RPG Orchestral Essentials，作者 inspectorJ）" },
  { id: "mu-dingzhou",  f: "mu-dingzhou",  ext: "ogg", loop: 1,
    on: "定州主题：河北官廨，公堂上有印的两个月", q: "庄重 殿堂 管弦 循环",
    src: "https://opengameart.org/content/views-from-atop-the-jade-kings-throne",
    lic: "CC-BY 3.0 · OpenGameArt · Views From Atop the Jade Kings Throne（作者 hitctrl）" },
  { id: "mu-huizhou",   f: "mu-huizhou",   ext: "ogg", loop: 1,
    on: "惠州主题：岭南瘴雨，荔枝与山川的远谪", q: "迷蒙 山水 管弦 循环",
    src: "https://opengameart.org/content/rpg-misty-mountains",
    lic: "CC-BY 3.0 · OpenGameArt · RPG - Misty Mountains（作者 hitctrl）" },
  { id: "mu-danzhou",   f: "mu-danzhou",   ext: "mp3", loop: 1,
    on: "儋州主题：海岛讲学，载酒堂的安静", q: "安眠 宁静 循环",
    src: "https://opengameart.org/content/lull-melancholy-loop",
    lic: "CC-BY 4.0 · OpenGameArt · \"Lull\" Melancholy Loop（作者 senddnes）" },
  { id: "mu-finale",    f: "mu-finale",    ext: "mp3", loop: 1,
    on: "终局曲：三枚章并排盖在纸上之后", q: "回望 忧郁 收束 循环",
    src: "https://opengameart.org/content/melancholy-melody",
    lic: "CC-BY 3.0 · OpenGameArt · Melancholy Melody（作者 patrick-maney）" }
];

/* ── 表情差分：台词神情 → 立绘槽 ─────────────────────────────
   台词标 9 个神情词，即梦那批立绘先产了 4 个槽（平/笑/悲/正）。
   这张表把两边接上，并且**把"凑数"写明**：
     FX_EXACT 里的换脸是真对应（只有 xiao→笑 那一对）；其余是同族但不同神，
     宁可近似也不空着 —— 但近似必须是表里写得明的近似，不许是代码里悄悄塌成一样。
     jing 微惊 / xi 戏谑 / bing 病容 已排进补抽队列（tools/prompts_img.tsv 末尾，
     槽名 e=惊 f=病 g=戏），图没到之前查不到就退回原立绘。
   动作立绘（act-* / dzact-* / hizact* / danact*）不进这张表：
   它们的价值在**那个姿势**（烧火、惊堂木），换成站姿笑反而丢了戏。
   表里没有 = 不查 = 用原立绘，所以删一行就是退回，不用碰台词。 */
var FX_SLOT = { xiao: "笑", lei: "悲", si: "悲", ku: "悲", leng: "正", nu: "正",
  jing: "惊", bing: "病", xi: "戏" };   // 后三个等着补抽那批图，图没到就照旧退回原立绘
var FX_EXACT = { xiao: 1 };
var FX_FACE = {
  "dpw-1": "ex-dp45", "dpw-2": "ex-dp45",
  "dzdongpo": "ex-dp57",
  "hiz-dongpo-1": "ex-dp58", "hiz-dongpo-2": "ex-dp58",
  "dan-dongpo-1": "ex-dp62", "dan-dongpo-2": "ex-dp62",
  "guest-wang": "ex-wang",
  "guest-xu": "ex-xu2", "guest-pan": "ex-pan2",
  "dzguest-1": "ex-zeng", "dzguest-2": "ex-li",
  "hiz-guests-1-p3": "ex-guo", "hiz-guests-2-p2": "ex-cheng",
  "dan-tuozuo-1": "ex-tang",
  "dan-kids-1-p2": "ex-afu"   // 儋州学童阿福（产图交付 §264：就是 dan-kids-1-p2 那张脸）——
                              // 这批 9-27 就画好落在盘上，一直没接进 FX_FACE，于是他的差分天天退回基图
};
/* 同一个人换了任所，脸也该跟着换：王朝云到惠州已经是病容（她自己那句
   「这里的水土，我受得住」就站在这张憔悴脸上），苏过渡海之后是披旧蓑那一张。
   两批图都是产图侧**照着章画的**（`ex-wanghz-*`／`ex-guod-*`，9-27 落盘），
   但基图只有一个名字，所以按章覆盖一次。四张都拿眼睛比过：同一人、同一身衣，
   只是气色与那件蓑衣不同 —— 不是"拿别人的脸凑"。 */
var FX_CHAP = {
  huizhou: { "guest-wang": "ex-wanghz" },
  danzhou: { "hiz-guests-1-p3": "ex-guod" }
};
/* 这一章该用哪一批脸：先查按章覆盖，再查总表。 */
function fxRole(face) {
  var byChap = FX_CHAP[CHAPTER_KEY];
  return (byChap && byChap[face]) || FX_FACE[face] || "";
}
/* ── 信墙：寄信人 → 立绘批次 ────────────────────────────
   只有**已经在对话层露过脸**的才进这张表。章惇、虞策·来之邵、苏迈·苏迨、王敏仲
   四位从没画过 —— 查不到就只挂一块竖幅名牌，**不拿别人的脸凑**
   （拿一张不相干的脸挂在一个真实历史人物名下，比空着严重得多）。 */
var LETTER_FACE = {
  qin: "ex-qin", you: "ex-szhe", zhu: "ex-zhu", zeng: "ex-zeng",
  zhengfu: "ex-cheng", guo: "ex-guo", ma: "ex-ma", can: "ex-can",
  li: "ex-li", you2: "ex-szhe", zhengfu2: "ex-cheng", can2: "ex-can", tang: "ex-tang"
  /* 故意没有 `qinfuneral`：那是讣告，不是秦观来信。挂上他的脸，
     等于在墙上骗玩家说"这个人还在写"。只挂一块名牌。 */
};
/* 话本层那几封（"东坡断案""东坡在惠州""东坡在海南"）寄信的就是他自己，
   按章取那一年龄段的脸 —— 与「跨章不换脸」同一条规矩。 */
var LETTER_SELF = { huangzhou: "ex-dp45", dingzhou: "ex-dp57",
  huizhou: "ex-dp58", danzhou: "ex-dp62" };
function letterFace(L) {
  if (L.layer === "传说") return LETTER_SELF[CHAPTER_KEY] || null;
  return LETTER_FACE[L.id] || null;
}
function fxArt(face, e) {
  var role = fxRole(face), slot = FX_SLOT[e];
  if (!role || !slot) return "";
  /* 原来这里挡着一句 `FX_BLOCK["guest-wang"].leng`：当时「正」那槽三张候选画的都是束发少年，
     不是她，所以宁可退回基图。那批废稿已经挪进 `素材/_废稿/`、`ex-wang-正` 重抽成了成年女子
     （产图交付 §266-267）—— **拦路的理由没了，闸还留着，就会永久地挡住一个已经修好的东西**，
     所以整块删掉。以后再撞上"这一槽画错了人"，重抽完记得回来删。 */
  return "立绘/" + role + "-" + slot + ".png";
}
/* 不开口的那一态（席间三位常驻、对话里没标神情的句子）也走同一批图。
   不换基图的话，同一个人会在「有神情」和「没神情」两句之间换两张脸 ——
   那比整章沿用旧图更糟。这一条是用户点的名：席位图一并换。 */
function fxBase(face) {
  var role = fxRole(face);
  return role ? "立绘/" + role + "-平.png" : "";
}

CHAPTERS.huangzhou = {
  chapter: { name: "黄州", shichen: 6, year: "元丰四年", age: "四十五岁",
    office: "团练副使 · 不得签书公事",
    full: "元丰四年（1081）。检校水部员外郎、黄州团练副使，本州安置 —— 不得签书公事。判狱要靠知州委使。",
    // 印章＝身份：这一枚是「东坡居士」私印 —— 号来自马正卿请得的东坡废地（《东坡八首》叙、
    // 陆游《老学庵笔记》）。他没有官印可用，所以章末就算满乡望，盖下去的也只是私印。
    // 话本层那一关的舞台：大江两半、此岸禅院彼岸书斋，中间一舟渡僧（dlgStage 查 bg("huaben")）
    huaben: "hb-bafeng-1.webp",
    // 9-27 新风格定稿：堂前换推近重画的 fx2（匾够三到四字），堂上换 fx-court-c-4
    hub: "fx2-hz-hub-c-4.webp", hall: "fx-court-c-4.webp",
    street: "fx-hz-street-c-4.webp", banquet: "fx3-hz-banquet-c-2.webp",
    // 来信那张 fx-hz-letter-c-3（案头俯视、纸在画里）**先不接**：
    // 信屏现在自己叠了一张 .letterimg + .letterbox 正文，两张纸会叠在一起。
    // 要用它就得把正文写进背景那张被透视压斜的纸面 —— 那是信屏改版，不是接图。
    // 章末封面（V3 青绿厚涂那一档）：黄州原先没配 end2，章末与「今日」用的是同一张图
    end2: "cover-hz-4.webp",
    map: MAPTRIP, chapmap: "map2-hz-1.webp", plaque: [0.200, 0.250, 0.050, 0.240], tiepaper: TIEPAPER,
    seal: { kind: "si", on: "东坡居士 · 私印", off: "空印 · 无官可署", note: "黄州没有官印可用" } },

  // 章首定调：全部有出处
  lines: {
    arrive: { t: "长江绕郭知鱼美，好竹连山觉笋香。", src: "《初到黄州》" },
    cold:   { t: "空庖煮寒菜，破灶烧湿苇。", src: "《寒食雨二首》其二" },
    lone:   { t: "拣尽寒枝不肯栖，寂寞沙洲冷。", src: "《卜算子·黄州定慧院寓居作》" },
    rain:   { t: "一蓑烟雨任平生。", src: "《定风波》" },
    calm:   { t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语" },
    pork:   { t: "待他自熟莫催他，火候足时他自美。", src: "《猪肉颂》" },
    money:  { t: "每日限用一百五十钱，大竹筒贮之。", src: "《答秦太虚书》" },
    bone:   { t: "然此说行，则众狗不悦矣。", src: "《与子由弟书》论羊脊骨" },
    // 席上尽欢那一句本来只长在 banquet 里，册子上找不到 —— 现在它进了清欢册，
    // 键与句子同一处，日志印的和册子列的是同一行。
    wind:   { t: "惟江上之清风，与山间之明月。", src: "《赤壁赋》·黄州作【有据】" }
  },

  // 神情词表：差分图命名 = 立绘名 + "-" + 神情，如 dpw-1-lei-cut.png
  fx: ["xiao", "leng", "nu", "lei", "si", "ku", "jing", "xi", "bing"],
  heroArt: ["dpw-1","dpw-2","act-court-1","act-court-2","act-court-3","act-court-4","act-stove-1","act-stove-2","act-stove2-1","act-stove2-2","act-stove2-4"],
  bars: { 火候: 20, 银钱: 150, 人情: 30, 物议: 0, 身体: 70 },

  // ── 堂上：断案 ──────────────────────────────────────
  // 被贬的检校水部员外郎本不得判狱，这里靠知州「委使佐郡」差委才坐上质证席。
  // 所以牌面上没有「政绩」这一栏，只有辩护与风险——空印不能白拿。
  court: {
    mode: "质证",
    // 得句的键由本章配置，且必须 ∈ 下面的 book.verses —— 引擎写死 rain/lone 时，
    // 定州·儋州那两章判赢了会得到一句册子上没有的「幽灵句」（审计 P1-3）
    verseWin: "rain", verseLose: "lone",
    rounds: 7, need: 12, riskMax: 6,
    caseName: "赖佃钱 · 证人已改口",
    caseSub: "话本层：机锋与神探都出明清小说，不在正史",
    caseRows: [
      ["原告", "佃户陈五，称欠钱已偿【案名与口供一律拟：苏轼无判牍传世】"],
      ["被告", "地主何九，持状纸索债"],
      ["破口", "状纸所填年号与律式不合，邻人曾见借据"],
      ["忌讳", "证人昨夜改口，此时逼供即坐诬"],
      ["我的身份", "检校水部员外郎、黄州团练副使，本州安置 —— 判狱要靠知州委使"]
    ],
    intentSeq: ["无状", "无状", "律意", "无状", "律意", "尸伤", "无状"],
    intentText: {
      "无状": "他要的是：你没有状纸",
      "律意": "他要的是：律不该这样读",
      "尸伤": "他要的是：伤由谁致"
    },
    cards: [
      { id: "zl", nm: "问邻", tp: "功能", note: "邻人曾见其借据", def: 2, risk: 1, po: "无状" },
      { id: "yz", nm: "验状", tp: "功能", note: "状纸年号与律不合", def: 3, risk: 2, po: "无状" },
      { id: "bsg", nm: "检尸格", tp: "基础", note: "格目是县吏旧抄", def: 1, risk: 0, po: "尸伤" },
      { id: "bl", nm: "比律", tp: "基础", note: "引《刑统》折债条", def: 1, risk: -1, po: "律意" },
      { id: "zl2", nm: "问邻", tp: "功能", note: "再唤两邻同结", def: 2, risk: 1, po: "无状", same: "zl" },
      { id: "yz2", nm: "验状", tp: "功能", note: "取旧契比对", def: 3, risk: 2, po: "无状", same: "yz" },
      { id: "bl2", nm: "比律", tp: "基础", note: "引《断狱格》", def: 1, risk: -1, po: "律意", same: "bl" },
      { id: "bsg2", nm: "检尸格", tp: "基础", note: "覆视元检行人", def: 1, risk: 0, po: "尸伤", same: "bsg" },
      // 牌堆原先只有 8 张／7 回合／手牌 4：抽一补一走到第 6、7 回合只剩 3、2 张，
      // 后期不是选择，是走完流程（审计 P2-9）。补到 rounds+4，三张都 `same` 复用立绘。
      { id: "yz3", nm: "验状", tp: "功能", note: "请知州州院复核", def: 3, risk: 2, po: "无状", same: "yz" },
      { id: "bsg3", nm: "检尸格", tp: "基础", note: "移别县覆检", def: 1, risk: 0, po: "尸伤", same: "bsg" },
      { id: "bl3", nm: "比律", tp: "基础", note: "折债正条无出入", def: 1, risk: -1, po: "律意", same: "bl" }
    ],
    rules: {
      head: "被贬的官凭什么断案",
      title: "堂上三句",
      rows: [
        ["一、空印", "苏轼此时是检校水部员外郎、团练副使，本州安置不得签书公事，判狱要知州委使"],
        ["二、鞫谳分司", "问话的与定罪的不是同一人，所以你只能把事实钉住，不能自己下判"],
        ["三、风险", "牌面风险累加越过 6，这一状递上去先弹劾的是你"],
        ["应不上意图", "辩护减半：牌是好牌，但不是此刻的那一句"]
      ]
    },
    pose: { zl: "act-court-1", yz: "act-court-2", bsg: "act-court-3", bl: "act-court-4" },
    win: { t: "此狱不以印成，以两造俱服。", src: "拟苏轼语·非原文" }
  },

  // ── 灶前：做菜 ──────────────────────────────────────
  // 靶子是区间不是最大值：添柴涨得最快，但糊锅也涨得最快。
  stove: {
    // 火候/咸甜酸油/几拍/该不该切 —— 全在 灶前.js 的 BOOK 里，这里只留故事那一头
    dish: "黄州猪肉", got: "东坡肉",
    quote: { t: "净洗铛，少著水，柴头罨烟焰不起。", src: "《猪肉颂》" },
    /* 做成这一锅，册上就多那两句：「待他自熟莫催他，火候足时他自美」就是这首诗的收尾，
       不是新造的奖励（问22：黄州《猪肉颂》那一行原来没有任何入手路，挂着"待触发"骗人）。
       其余三章不配 —— 它们案上那道菜没有留下对应的原句，硬配就是编。 */
    verse: "pork",
  },

  // ── 上街：尝味与采买 ────────────────────────────────
  street: {
    budget: 150, need: ["东坡肉", "豆粥", "煮羊脊骨"],
    verseFull: "bone", verseMiss: "lone",
    quote: { t: "每日限用一百五十钱，大竹筒贮之。", src: "《答秦太虚书》" },
    stalls: [
      { nm: "东坡肉", price: 20, art: "dish-rou-1", rq: 3, wy: 0, sh: 0, note: "贱如泥土，无人解" },
      { nm: "豆粥", price: 6, art: "dish-zhou", rq: 1, wy: 0, sh: 2, note: "摩诘堂旧味" },
      { nm: "煮羊脊骨", price: 9, art: "dish-gu", rq: 0, wy: 2, sh: 0, note: "意在一二肋" },
      { nm: "旋炙猪皮", price: 14, art: "dish-zhi", rq: 0, wy: -1, sh: -1, note: "北人嫌腻" },
      { nm: "烤蚝", price: 11, art: "dish-hao", rq: 0, wy: 3, sh: -1, note: "勿与人道" },
      { nm: "麦门冬酒", price: 24, art: "dish-wine.webp", rq: 6, wy: 1, sh: -2, note: "捎给子由" }
    ]
  },

  // ── 席间：菜就是话，四维打客人的所好 ───────────────────
  // 三人都是黄州真实交往：徐君猷（知州，待苏轼不以罪人）、潘大临（清贫书生，
  // 苏轼每至其家痛饮）、王朝云（从杭州随行）。佛印的机锋一律不进这一层。
  banquet: {
    rounds: 6, need: 4,
    place: "临皋亭 · 夜酌",
    quote: { t: "客亦知夫水与月乎？", src: "《赤壁赋》" },
    guests: [
      { id: "xu", nm: "徐君猷", art: "guest-xu", want: "典", joy: 0,
        say: "他是知州，我是罪人。他先不把我当罪人。", src: "《与徐君猷书》" ,
        hit: { t: "使君元是此中人。—— 这一道，我替你把杯。", src: "《南歌子》句·黄州作【有据】，后半是拟" },
        miss: { t: "酒淡。公今日心事重。", src: "拟语·徐君猷待轼不以罪人【有据】" }},
      { id: "pan", nm: "潘大临", art: "guest-pan", want: "情", joy: 0,
        say: "囊中无一钱，床上有两轴书。", src: "黄州赠潘邠老联语·宋人笔记" ,
        hit: { t: "得此一味，胜得两轴书。", src: "拟语·潘大临「囊中无一钱，床上有两轴书」出宋人笔记" },
        miss: { t: "……某还未读懂。", src: "拟语" }},
      { id: "wang", nm: "王朝云", art: "guest-wang", want: "趣", joy: 0,
        say: "她随我到此，从杭州到黄州，一路没喊过苦。", src: "《悼朝云》叙",
        hit: { t: "一路跟公到此，就为这一口。", src: "拟语·朝云自杭州随行【有据】" },
        miss: { t: "公又忘了自己忌口。", src: "拟语·消渴疾节食【有据（病）】" }}
    ],
    // 四维＝味·典·趣·情。牌面全印出来，命中哪一维由当前这位客人决定。
    dishes: [
      { nm: "东坡肉", art: "dish-rou-1", wei: 3, dian: 1, qu: 1, qing: 2, uses: 2 },
      { nm: "豆粥", art: "dish-zhou", wei: 1, dian: 0, qu: 1, qing: 3, uses: 2 },
      { nm: "煮羊脊骨", art: "dish-gu", wei: 2, dian: 0, qu: 3, qing: 1, uses: 2 },
      { nm: "烤蚝", art: "dish-hao", wei: 3, dian: 1, qu: 2, qing: 0, uses: 2 },
      { nm: "春笋", art: "dish-bamboo.webp", wei: 2, dian: 3, qu: 1, qing: 0, uses: 2 },
      { nm: "鱼羹", art: "dish-fish.webp", wei: 3, dian: 1, qu: 0, qing: 2, uses: 2 },
      { nm: "麦门冬酒", art: "dish-wine.webp", wei: 1, dian: 2, qu: 2, qing: 3, uses: 2 },
      { nm: "荔枝", art: "dish-lychee.webp", wei: 3, dian: 0, qu: 2, qing: 1, uses: 2 }
    ],
    dimKey: { 味: "wei", 典: "dian", 趣: "qu", 情: "qing" },
    // 三人尽欢之后落的那一句，进清欢册
    verseK: "wind"
  },

  /* ── 话本层：佛印机锋 ────────────────────────────────
     这一关**摆明了是后人编的**：整屏绣像（只有墨色与纸色、面部留白不画五官）、
     标题写「话本 ·」不写「席间」、佛印每句挂【传说】，而苏轼接的话反倒句句是真句子。
     正史无苏轼与佛印斗机的记载：八风吹不动、苏小妹、东坡神探全出明清话本与禅门灯录。
     引擎借席间那一套（行旅.js 的 bnData 换表），代价只有 1 个时辰；
     接不上也只自嘲一句、不扣任何数 —— 编的东西不该伤玩家。
     四维换成三维（禅·谑·锋），牌面数字照旧全印出来：靶子必须算得出来。 */
  huaben: {
    layer: "话本", place: "金山寺 · 机锋", bg: "hb-duo-1.webp",
    rounds: 3, need: 5,
    dims: [["禅", "chan"], ["谑", "xue"], ["锋", "feng"]],
    dimKey: { 禅: "chan", 谑: "xue", 锋: "feng" },
    verseK: "wind",
    guests: [
      { id: "fo", nm: "佛印", want: "禅", joy: 0, art: "hdb2-fo-1.webp",
        say: "长老把茶盏一推：「八风」——你道是哪八风。",
        hit: { t: "点一点头：「风往哪边吹，船就往哪边去。」", src: "明清话本母题·黄州无此事【传说】" },
        miss: { t: "长老不言语，只把茶盏收回去。", src: "明清话本母题【传说】" }}
    ],
    dishes: [
      { nm: "此心安处", tp: "话", art: "hdb2-dp-1.webp", chan: 4, xue: 1, feng: 0, uses: 1,
        note: "心若在，哪里都安 · 《定风波》小序" },
      { nm: "一蓑烟雨", tp: "话", art: "hdb2-dp-2.webp", chan: 3, xue: 2, feng: 1, uses: 1,
        note: "回去便是，也无风雨也无晴 · 《定风波》" },
      { nm: "江上清风", tp: "话", art: "hdb2-dp-3.webp", chan: 3, xue: 1, feng: 2, uses: 1,
        note: "与山间之明月 · 《赤壁赋》" },
      { nm: "寒枝不栖", tp: "话", art: "hdb2-dp-4.webp", chan: 2, xue: 0, feng: 3, uses: 1,
        note: "拣尽寒枝不肯栖 · 《卜算子》" },
      { nm: "竹筒贮钱", tp: "话", art: "hdb-dp-1.webp", chan: 0, xue: 4, feng: 2, uses: 1,
        note: "答他米价，不管机锋 · 《答秦太虚书》" },
      { nm: "鱼美笋香", tp: "话", art: "hdb-dp-2.webp", chan: 2, xue: 3, feng: 1, uses: 1,
        note: "长江绕郭知鱼美 · 《初到黄州》" }
    ]
  },

  // ── 信：收信与回信 ──────────────────────────────────
  // 四类都齐：好友（秦观）· 家书（苏辙）· 公务（朱寿昌）· 话本层（佛印，明标传说）。
  // 回信的三个选项**全部是真苏轼的句子**（可跨年），选错也成立，只改本章气质与后续走向。
  letters: [
    {
      id: "qin", when: 1, from: "秦观", who: "太虚 · 友人", layer: "正史",
      paper: "ui-paper-2",
      body: "见说今日限用一百五十钱，大竹筒贮之。—— 这是你寄来的话，我读了好几遍。",
      src: "《答秦太虚书》（黄州作）",
      ask: "他其实是在问：你还笑得出来吗",
      tone: { 旷: 3, 灰: 1, 逃: 2 },
      replies: [
        { k: "旷", t: "一蓑烟雨任平生。", src: "《定风波》·黄州作" },
        { k: "灰", t: "也拟哭途穷，死灰吹不起。", src: "《寒食雨二首》其二·黄州作" },
        { k: "逃", t: "小舟从此逝，江海寄馀生。", src: "《临江仙·夜饮东坡醒复醉》·黄州作" }
      ]
    },
    {
      id: "you", when: 3, from: "苏辙", who: "子由 · 弟", layer: "正史",
      paper: "ui-paper-2",
      body: "你信上说羊脊骨那东西，剔了半日得些须肉，「然此说行，则众狗不悦矣」。我回你：少喝点酒。",
      src: "《与子由弟书》（黄州）",
      ask: "他其实是在问：家里一切都好，你为什么不好",
      tone: { 旷: 2, 灰: 3, 壮: 3 },
      replies: [
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期" },
        { k: "灰", t: "人间如梦，一尊还酹江月。", src: "《念奴娇·赤壁怀古》·黄州作" },
        { k: "旷", t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语" }
      ]
    },
    {
      id: "zhu", when: 5, from: "朱寿昌", who: "鄂州知州 · 公事", layer: "正史",
      paper: "ui-paper-1",
      body: "岳鄂间田野小人，例只养男，至有不举女者。愿公一留意。",
      src: "《与朱鄂州书》（黄州作·止溺婴）",
      ask: "这一封不是私事：我不能判案，但我可以写这一封",
      tone: { 壮: 3, 旷: 1, 灰: 1 },
      replies: [
        { k: "壮", t: "岂是闻韶解忘味，迩来三月食无盐。", src: "《腊日游孤山访惠勤惠思二僧》句·杭州期" },
        { k: "旷", t: "谁怕，一蓑烟雨任平生。", src: "《定风波》·黄州作" },
        { k: "灰", t: "世事一场大梦，人生几度秋凉。", src: "《西江月》·黄州作" }
      ]
    },
    {
      id: "fo", when: 4, from: "佛印", who: "金山寺 · 话本层", layer: "传说",
      paper: "huaben-1",
      body: "八风吹不动，一屁过江来。请公自度。",
      src: "【传说】出明清话本《东坡佛印问答》，正史无此书",
      ask: "这一关是后人编的：进去就知道不是正史",
      tone: { 旷: 3, 壮: 2, 灰: 2 },
      replies: [
        { k: "旷", t: "也无风雨也无晴。", src: "《定风波》·黄州作" },
        { k: "灰", t: "与谁同坐，明月清风我。", src: "《点绛唇》·一说非黄州" },
        { k: "壮", t: "老夫聊发少年狂。", src: "《江城子·密州出猎》·密州期" }
      ]
    },
    /* ── 分支两封（9-28 新接）────────────────────────────
       秦观那封的 ask 是「你还笑得出来吗」。回得出来（旷／逃）→ 马正卿来告诉你对那块地；
       回不出来（灰）→ 参寥子道潜自己从吴中赶过来。**两条互斥**，走一条就永远收不到另一条。
       正文一律是"对面那个人回你一句你确实写过的话"：出处标在 `src`；
       书信的措辞是拟的就明写「书辞拟」—— **拟的是信，不是他的句子**。 */
    {
      id: "ma", when: 5, from: "马正卿", who: "请地者 · 同僚", layer: "正史",
      after: { id: "qin", k: ["旷", "逃"] },
      body: "郡东有营地，仆已代公请得之，可耕而庐。公既安于此，便把这块地认作自家。",
      src: "《东坡八首》叙：马正卿为苏轼请得州东营地【有据】；「东坡居士」之号由此来（陆游《老学庵笔记》）。书辞拟",
      ask: "他给的不止一块地：从此你在世上有名字了",
      tone: { 旷: 3, 壮: 2, 灰: 1 },
      replies: [
        { k: "旷", t: "长江绕郭知鱼美，好竹连山觉笋香。", src: "《初到黄州》" },
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期" },
        { k: "灰", t: "拣尽寒枝不肯栖，寂寞沙洲冷。", src: "《卜算子·黄州定慧院寓居作》" }
      ]
    },
    {
      id: "can", when: 5, from: "参寥子", who: "道潜 · 方外友", layer: "正史",
      after: { id: "qin", k: "灰" },
      body: "「也拟哭途穷，死灰吹不起」—— 公此二句，仆诵之数过。已买舟东下，见过公于临皋。",
      src: "《寒食雨二首》其二·黄州作（公自句，仆诵之）；参寥元丰间自吴中来访公于黄州【有据】。书辞拟",
      ask: "他不劝你。他只是来 —— 怕你一个人",
      tone: { 旷: 2, 逃: 3, 灰: 1 },
      replies: [
        { k: "旷", t: "惟江上之清风，与山间之明月。", src: "《赤壁赋》·黄州作【有据】" },
        { k: "逃", t: "小舟从此逝，江海寄馀生。", src: "《临江仙·夜饮东坡醒复醉》·黄州作" },
        { k: "灰", t: "谁见幽人独往来，缥缈孤鸿影。", src: "《卜算子·黄州定慧院寓居作》" }
      ]
    }
  ],

  letterDims: { key: "气", title: "补一句 · 回哪一句都算回过 —— 只是这一章的气质跟着变" },

  // ── 对话：黄州章插入点全表 ──────────────────────────
  /* 每一句都自带 `p`（这一句他是什么动作、什么脸色）—— 同一场戏不许一张立绘站到底。
     w:"我" → 人在左、石青名牌；其余 → 人在右、朱红名牌。
     台词全部是真句子或明标的拟语；NPC 说的白话一律标「拟」。 */
  dlg: {
    arrive: [
      { w: "我", p: "dpw-1", e: "xiao", t: "长江绕郭知鱼美，好竹连山觉笋香。",
        src: "《初到黄州》·元丰三年" },
      { w: "我", p: "dpw-2", e: "si", t: "拣尽寒枝不肯栖，寂寞沙洲冷。",
        src: "《卜算子·黄州定慧院寓居作》" },
      { w: "驿吏", p: "none", t: "公自台狱来？此间团练副使，不得签书公事 —— 请公记着这一行。",
        src: "拟语·职事由《宋史·苏轼传》【有据】，口吻是拟的" }
    ],
    courtOpen: [
      { w: "何九", p: "none", t: "状纸在此，年号写得明白，他赖不了。",
        src: "拟语【案名与口供一律拟：苏轼无判牍传世】" },
      { w: "我", p: "dpw-1", t: "某狱不以印成，以两造俱服。先把邻人唤上来。",
        src: "拟苏轼语·非原文" }
    ],
    courtWin: [
      { w: "徐君猷", p: "guest-xu", t: "使君元是此中人。—— 这一状我署名，你不必管。",
        src: "《南歌子》·黄州作【有据】，前半是真句" },
      { w: "我", p: "dpw-2", t: "岂是闻韶解忘味，迩来三月食无盐。",
        src: "《腊日游孤山访惠勤惠思二僧》句·杭州期" }
    ],
    courtLose: [
      { w: "吏", p: "none", t: "此状递不上去。递上去，先弹劾的是你。",
        src: "拟语" },
      { w: "我", p: "dpw-1", e: "lei", t: "也拟哭途穷，死灰吹不起。",
        src: "《寒食雨二首》其二·黄州作" }
    ],
    stoveFirst: [
      { w: "我", p: "act-stove-1", e: "xi", t: "净洗铛，少著水，柴头罨烟焰不起。待他自熟莫催他，火候足时他自美。",
        src: "《猪肉颂》·黄州作" },
      { w: "我", p: "act-stove-2", t: "黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮。",
        src: "《猪肉颂》·黄州作" }
    ],
    tieOpen: [
      { w: "我", p: "dpw-2", t: "他写的就是三个动作。我照做，做一锅算一锅。",
        src: "拟苏轼语·非原文" }
    ],
    dishOk: [
      { w: "我", p: "act-stove2-4", t: "早晨起来打两碗，饱得自家君莫管。",
        src: "《猪肉颂》·黄州作" }
    ],
    dishFail: [
      { w: "我", p: "act-stove-3", t: "空庖煮寒菜，破灶烧湿苇。",
        src: "《寒食雨二首》其二·黄州作" }
    ],
    seatTake: [
      { w: "徐君猷", p: "guest-xu", t: "不是使君能好事，使君元是诗人。",
        src: "《临江仙·重九》·黄州作【有据】" },
      { w: "潘大临", p: "guest-pan", t: "囊中无一钱，床上有两轴书。公若不嫌，今日便饮。",
        src: "黄州赠潘邠老联语·宋人笔记" }
    ],
    banquetOk: [
      { w: "我", p: "dpw-1", t: "惟江上之清风，与山间之明月。",
        src: "《赤壁赋》" },
      { w: "我", p: "dpw-2", t: "客亦知夫水与月乎？",
        src: "《赤壁赋》" }
    ],
    banquetFail: [
      { w: "我", p: "dpw-2", e: "si", t: "与谁同坐，明月清风我。",
        src: "《点绛唇》·一说非黄州" }
    ],
    streetOk: [
      { w: "我", p: "dpw-1", t: "每日限用一百五十钱，大竹筒贮之。",
        src: "《答秦太虚书》·黄州作" }
    ],
    streetMiss: [
      { w: "我", p: "dpw-2", t: "然此说行，则众狗不悦矣。",
        src: "《与子由弟书》论羊脊骨·黄州" }
    ],
    mailOpen: [
      { w: "我", p: "dpw-2", t: "先寄一声，平安而已。",
        src: "拟苏轼语·非原文" }
    ],
    /* 话本层三场白：一律不标神情 `e` —— 绣像面部留白不画五官，标了就会被 FX 表换成厚涂脸，
       两层当场糊成一层。佛印的话全挂【传说】；「我」这几句是拟语，也照样标出来。 */
    hbOpen: [
      { w: "佛印", p: "hdb2-fo-1.webp", t: "都说八风吹不动，端坐过江来。居士那一纸字，可曾署名？",
        src: "明清话本母题·《东坡佛印和南集》一类，苏轼集内无此帖【传说】" },
      { w: "我", p: "hdb2-dp-1.webp", t: "我几时写过那一纸字。",
        src: "拟语·这一场戏整段是编的【传说】" },
      { w: "佛印", p: "hdb2-fo-2.webp", t: "那便请坐。且道「风」从何处起。",
        src: "禅门灯录母题【传说】" }
    ],
    hbOk: [
      { w: "佛印", p: "hdb2-fo-3.webp", t: "长老把茶盏一推：风往哪边吹，船就往哪边去。",
        src: "明清话本母题【传说】" }
    ],
    hbFail: [
      { w: "佛印", p: "hdb2-fo-4.webp", t: "长老不言语，只把茶盏收了回去。",
        src: "明清话本母题【传说】" },
      { w: "我", p: "hdb2-dp-2.webp", t: "回首向来萧瑟处，归去，也无风雨也无晴。",
        src: "《定风波》句·黄州作【有据】" }
    ],
    seal: [
      { w: "我", p: "dpw-1", e: "si", t: "此心安处是吾乡。",
        src: "《定风波》小序，托歌者柔奴语·黄州作" }
    ]
  },

  // 食单：章末按收集数盖章
  book: {
    dishes: ["东坡肉", "豆粥", "煮羊脊骨", "旋炙猪皮", "烤蚝", "麦门冬酒", "春笋", "鱼羹", "荔枝"],
    /* 席间这一桌的菜**系统性没有 src 元数据**（审计 P2-13），而其中两味尤其扎眼：
       荔枝是惠州的名物（《食荔枝二首》）、烤蚝是儋州的名物，黄州席上摆它们查无据。
       不删（数值与图都挂在上面，删一行要连着改席间四维），改在册子上明标「存疑」——
       玩家看得见"这一味不是这一章的"，比留一个假装考过的名目诚实。 */
    dishSrc: { "荔枝": "【存疑】荔枝是惠州名物，《食荔枝二首》在所据；黄州席上摆它无据",
               "烤蚝": "【存疑】炙蚝是儋州名物（《食蚝》）；黄州席上摆它无据" },
    verses: ["pork", "money", "bone", "rain", "calm", "lone", "wind"],
    // 这两行本局没有对应的一手可拿：money 是那封家书里的家常，calm 出柔奴那句话。
    // 与其挂「待触发」骗玩家再玩玩就有，不如明写"这一章没走到"。（审计 P2-16／问22）
    later: ["money", "calm"]
  },


  // ── 插一句：他写信写着写着就转题 ──────────────────────
  // 这不是编的性格，是他的文体：报菜价、说邻居怕老婆、顺手寄一个方子。
  // lie:true 的那句**不是他写的**（出宋人诗话附会）—— 玩家说了要掉物议，
  // 因为「一树梨花压海棠」根本不在苏轼集正文里。
  asides: [
    { t: "廪入既绝，人口不少。", src: "《答秦太虚书》·黄州作【有据】",
      hint: "他忽然报了一句家计 —— 信写到这里就换成米价了" },
    { t: "黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮。", src: "《猪肉颂》·黄州作【有据】",
      hint: "论完案情，他转头说起猪肉" },
    { t: "忽闻河东狮子吼，拄杖落手心茫然。", src: "《寄吴德仁兼简陈季常》【有据】",
      hint: "拿朋友怕老婆开涮，是他书信里的常备节目" },
    { t: "一树梨花压海棠。", src: "【传说／伪作】赠张先句，出宋人诗话附会，不在《东坡全集》正文",
      lie: true, hint: "这句人人说是他说的 —— 可它不在他的集子里" }
  ],
  // ── 成就：一律用他自己的原句命名，不另造词 ──────────────
  achv: [
    { k: "cook", t: "火候足时他自美。", src: "《猪肉颂》·黄州作【有据】" },
    { k: "dish", t: "黄州好猪肉，价贱如泥土。", src: "《猪肉颂》·黄州作【有据】" },
    { k: "letter", t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语·黄州作【有据】" },
    { k: "clean", t: "拣尽寒枝不肯栖，寂寞沙洲冷。", src: "《卜算子·黄州定慧院寓居作》【有据】" },
    { k: "saidLie", t: "事如春梦了无痕。", src: "《正月二十日与潘郭二生出郊寻春…和前韵》·黄州作【有据】—— 替他认下一句假诗，就当它没发生过" },
    { k: "hushAll", t: "也无风雨也无晴。", src: "《定风波》·黄州作【有据】" }
  ],
};

/* ── 定州章 · 元祐八年（1093）—绍圣元年（1094），虚岁五十七 ─────────
   这一章与黄州章的**唯一但根本的差别**：黄州「不得签书公事」，定州是实权知州，
   可判狱、可亲笔签书。所以堂上关卡不再打「他有没有状纸」这场架，
   而改成另一件事——**空印**。
   史实锚点：转运使奏「见任守臣于文状先印后书」，因有敕根括定州公使库空印文状，
   定州路都监张遇明冲替、张之翰放罢。旧档把这条敕系于《长编拾补》卷八，
   本轮复核**卷八无命中**（该卷只到元祐八年十月），卷次待改查卷九以后——
   所以游戏里只说「有敕根括」这件事，不印具体卷数。
   到绍圣初它成为苏轼被追论的罪之一。
   —— 也就是说：先印后书在当时是各州公使库的**通行做法**，不是罪；
   到绍圣元年它才变成罪。玩家在这一章里做的每一件合规的事，都是在给下一章攒债。
   具体案名与口供一律是拟的（苏轼两任**皆无可靠判牍传世**，市传「东坡判案」全出明清话本），
   所以 caseName 一律带「拟」字，规则面板里也写明这一条。 */
CHAPTERS.dingzhou = {
  chapter: {
    name: "定州", shichen: 6, year: "元祐八年", age: "五十七岁",
    office: "知定州军州事 · 可以签书公事",
    full: "元祐八年—绍圣元年（1093—1094）。端明殿学士兼翰林侍读学士、左朝奉郎、知定州军州事 —— 这一章你可以签书公事。",
    // 定州这一章的食单本来就薄：核到篇名的吃食只有酒与果栗。薄是史实，不是没做完。
    bookHint: "河北官斋可考的吃食只有这几样 —— 少，是因为宋人书里就这么多",
    hub: "fx2-dz-hub-b-3.webp", hall: "fx3-dz-court-b-2.webp", stove: "sc-dz-stove2-1.webp",
    street: "fx4-dz-street-b-2.webp", banquet: "fx3-dz-banquet-b-3.webp", end2: "cover-dz-1.webp",
    map: MAPTRIP, chapmap: "map2-dz-2.webp", plaque: [0.250, 0.395, 0.034, 0.150], tiepaper: TIEPAPER,
    // 系年已按《长编拾补》卷八考＋王宗稷《年谱》＋《施注苏诗》引《纪年录》改正：
    // 旧档「八月出都、九月到任」不成立。
    note: "九月十四日出都（《东府雨中别子由》），十二月二十三日方到定州任（《施注苏诗》引《纪年录》）。出都前两日，宣仁太后崩。",
    // 元祐年间他换上了真的官印 —— 这是四章里唯一一枚。全游戏三枚章并排时，中间那枚是红的。
    seal: { kind: "guan", on: "定州军州事 · 官印", off: "空印 · 未及结绝", note: "元祐八年这一枚是真的官印" }
  },

  // 章首定调。这一组全部是**核到篇名的定州任上原文**，不是借句。
  // 只有 rain 一条是密州期（因为它是「射天狼」，配得上河北边帅），src 已写明系年。
  lines: {
    arrive: { t: "今年中山去，白首归无期。", src: "《东府雨中别子由》·元祐八年九月十四日出都作" },
    cold:   { t: "知我空堂坐画灰。", src: "《寄馏合刷瓶与子由》·定州任上，公自题「元祐八年十二月二十五日醉睡中作」" },
    lone:   { t: "老人心事日摧颓，宿火通红手自焙。", src: "《寄馏合刷瓶与子由》·定州任上" },
    rain:   { t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期，非定州作" },
    calm:   { t: "异哉驳石雪浪翻，石中乃有此理存。", src: "《雪浪斋铭》·定州任上，自署「四月辛酉绍圣元」" },
    pork:   { t: "带弓而锄，佩剑而樵。", src: "《乞增修弓箭社条约状二首》之一·元祐八年十一月十一日知定州状奏" },
    money:  { t: "吾国旧供云泽米。", src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作，自注「定武斋酒用苏州米」" },
    bone:   { t: "燕南异事真堪记，三寸黄柑擘永嘉。", src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作" },
    stone:  { t: "太行西来万马屯，势与岱岳争雄尊。", src: "《雪浪石》（《次韵滕大夫三首》之一）·定州郡斋作" },
    // 同一篇铭里的另一句：席上讲起蜀中那两个没传下来的名字，就归这一行
    yuan:   { t: "尽水之变蜀两孙，与不传者归九原。", src: "《雪浪斋铭》·定州任上，自署绍圣元年四月辛酉" },
    mourning: { t: "固应祠百世，何止活千人。", src: "《大行太皇太后高氏挽辞二首》·元祐八年九月闻丧后定州作" },
    face:  { t: "祖宗之法，边帅当上殿面辞……降旨拒臣，不令上殿，此何意也？", src: "《朝辞赴定州论事状》·元祐八年九月二十六日，新知定州未赴任时上" },
    drill: { t: "自韩琦去后，不见此礼至今矣。", src: "定州人之语·《宋史·苏轼传》卷三百三十八，非苏轼语" }
  },

  // 神情词表：差分图命名 = 立绘名 + "-" + 神情，如 dpw-1-lei-cut.png
  fx: ["xiao", "leng", "nu", "lei", "si", "ku", "jing", "xi", "bing"],
  heroArt: ["dzdongpo","dzact-court-1","dzact-court-2","dzact-court-3","dzact-court-4","dzact-stove-1","dzact-stove-2","dzact-stove-3","dzact-stove-4","dzact-stove-5"],
  bars: { 火候: 20, 银钱: 400, 人情: 55, 物议: 30, 身体: 55 },
  // ── 对话：定州章插入点 ──────────────────────────────
  dlg: {
    arrive: [
      { w: "我", p: "dzact-court-4", t: "今年中山去，白首归无期。",
        src: "《东府雨中别子由》·元祐八年九月十四日出都作" },
      { w: "我", p: "dzdongpo", e: "si", t: "知我空堂坐画灰。",
        src: "《寄馏合刷瓶与子由》·定州任上，自题「元祐八年十二月二十五日醉睡中作」" },
      { w: "押衙", p: "none", t: "太师不须上殿。相公自请外任，河北的事，相公说了算。",
        src: "拟语·「求面对论边事，不许」【有据，《宋史·苏轼传》】" }
    ],
    courtOpen: [
      { w: "曾仲锡", p: "dzguest-1", t: "副总管不肯与属礼相下。公，这礼怎么行？",
        src: "拟语·定州「以属礼下之」之争【有据，《宋史·苏轼传》】" },
      { w: "我", p: "dzact-court-2", e: "nu", t: "祖宗之法，边帅当上殿面辞……降旨拒臣，不令上殿，此何意也？",
        src: "《朝辞赴定州论事状》·元祐八年九月二十六日" }
    ],
    courtYin: [
      { w: "库吏", p: "none", t: "印在这里。公先盖，字慢慢填 —— 向来如此。",
        src: "拟语·公使库文状先印后书为当时通行做法【有据】" },
      { w: "我", p: "dzdongpo", e: "ku", t: "这不是罪。",
        src: "拟苏轼语·非原文（到绍圣元年，它是）" }
    ],
    courtWin: [
      { w: "李之仪", p: "dzguest-2", t: "某从公于定武，未见州人见此礼。",
        src: "拟语·李之仪《姑溪集》题跋自记「从苏先生于定武」【有据】；「自韩琦去后不见此礼」是定州人之语，见《宋史》" },
      { w: "我", p: "dzact-court-3", t: "带弓而锄，佩剑而樵。",
        src: "《乞增修弓箭社条约状二首》之一·元祐八年十一月十一日" }
    ],
    courtLose: [
      { w: "我", p: "dzdongpo", e: "si", t: "萧索东风两鬓华，年年幡胜剪宫花。",
        src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作" }
    ],
    stoveFirst: [
      { w: "我", p: "dzact-stove-1", t: "寄君东阁闲烝栗。",
        src: "《寄馏合刷瓶与子由》·定州任上" },
      { w: "我", p: "dzact-stove-4", t: "老人心事日摧颓，宿火通红手自焙。",
        src: "《寄馏合刷瓶与子由》·定州任上" }
    ],
    dishOk: [
      { w: "我", p: "dzact-stove-5", t: "约束家僮好收拾，故山梨枣待翁来。",
        src: "《寄馏合刷瓶与子由》·定州任上" }
    ],
    dishFail: [
      { w: "我", p: "dzact-stove-2", t: "知我空堂坐画灰。",
        src: "《寄馏合刷瓶与子由》·定州任上" }
    ],
    seatTake: [
      { w: "曾仲锡", p: "dzguest-1", t: "立春了。公这里可有辛盘？",
        src: "拟语·《立春日小集呈李端叔》【有据】" },
      { w: "李之仪", p: "dzguest-2", t: "腊酒是黄柑。这一席是北地里吃的南果。",
        src: "《立春日小集呈李端叔》句·绍圣元年立春定州作【有据】" }
    ],
    banquetOk: [
      { w: "我", p: "dzact-court-2", t: "尽水之变蜀两孙，与不传者归九原。",
        src: "《雪浪斋铭》·定州任上，自署绍圣元年四月辛酉" }
    ],
    banquetFail: [
      { w: "我", p: "dzdongpo", e: "si", t: "与谁同坐，明月清风我。",
        src: "《点绛唇》·一说非黄州" }
    ],
    streetOk: [
      { w: "我", p: "dzact-court-1", t: "燕南异事真堪记，三寸黄柑擘永嘉。",
        src: "《次韵曾仲锡元日见寄》·定州作" }
    ],
    streetMiss: [
      { w: "我", p: "dzact-stove-3", t: "吾国旧供云泽米。",
        src: "《次韵曾仲锡元日见寄》·定州作，自注「定武斋酒用苏州米」" }
    ],
    mailOpen: [
      { w: "我", p: "dzact-court-4", t: "先寄一声，平安而已。",
        src: "拟苏轼语·非原文" }
    ],
    seal: [
      { w: "我", p: "dzdongpo", e: "jing", t: "异哉驳石雪浪翻，石中乃有此理存。",
        src: "《雪浪斋铭》·定州任上" }
    ]
  },

  // ── 堂上：空印 ──────────────────────────────────────
  // 与黄州章的差别全部在这里：
  // 1) 没有 riskMax。你不是在冒险递状，你是在清一州之狱。
  // 2) yin:1 的牌**无视意图**按全额结绝（印好的空白文状当然不怕对方说什么），
  //    但每用一次 +1 空印。空印不扣本章任何数，它进 S.kongYin，下一章兑现。
  court: {
    mode: "空印",
    verseWin: "stone", verseLose: "calm",
    rounds: 8, need: 16,
    caseName: "定州公使库文状 · 先印后书【案名拟】",
    caseSub: "这一章你真的有判狱权 —— 所以对手不是别人，是公使库里那摞空白文状",
    caseRows: [
      ["我的身份", "端明殿学士兼翰林侍读学士、知定州军州事 —— 可判狱、可结绝刑名、可亲笔签书"],
      ["事由", "河北案牍山积，公使库文状例先印后书：印好的空白状纸先发下去，字回来再填"],
      ["通行做法", "元祐八年这不是罪，各州皆然。转运使张问奏「见任守臣于文状先印后书」，于是有敕根括"],
      // 上面那段注释自己写了「卷八无命中……所以游戏里不印具体卷数」，可这一行照旧印着卷八 ——
      // 注释与面板打架，玩家看见的正是没复核的那一版（审计 P2-17）。
      ["连坐的人", "定州路都监张遇明冲替、与远小监当；都大提举常平张之翰放罢【有敕根括，卷次待改查】—— 都不是你我"],
      ["忌讳", "苏轼两任皆无可靠判牍传世，市传「东坡判案」全出明清公案话本。口供一律是拟的"]
    ],
    // 四类争讼的**题目**都有据（弓箭社冬教、春大阅上下之分、斫伐开耕编管、保甲折变科配），
    // 具体的两造口供是拟的——苏轼两任皆无可靠判牍传世。
    intentSeq: ["社役", "军礼", "粮米", "田耕", "社役", "军礼", "田耕", "粮米"],
    intentText: {
      "社役": "他要的是：弓箭社免冬教，另差即辞",
      "军礼": "他要的是：副总管不必与属礼相下",
      "粮米": "他要的是：这一石米算折变还是科配",
      "田耕": "他要的是：斫伐开耕该不该编管"
    },
    cards: [
      { id: "gjs", nm: "召弓箭社", tp: "本任", note: "带弓而锄，佩剑而樵", def: 4, yin: 0, po: "社役" },
      { id: "jd", nm: "举旧典", tp: "本任", note: "帅常服出帐，将吏戎服", def: 3, yin: 0, po: "军礼" },
      { id: "ws", nm: "召吏为奏", tp: "功能", note: "称疾不至？那就上奏", def: 4, yin: 0, po: "军礼" },
      { id: "bj", nm: "奏免保甲", tp: "本任", note: "折变科配 —— 朝廷不报", def: 3, yin: 0, po: "粮米" },
      { id: "bg", nm: "依法编管", tp: "基础", note: "斫伐开耕者四五火", def: 2, yin: 0, po: "田耕" },
      { id: "tl", nm: "委吏勘问", tp: "基础", note: "发回属县再问一遍", def: 2, yin: 0, po: "田耕" },
      { id: "bl", nm: "引《刑统》", tp: "基础", note: "折债之讼有正条", def: 2, yin: 0, po: "粮米" },
      { id: "ky1", nm: "空印文状", tp: "空印", note: "印在前，字在后", def: 6, yin: 1, po: "空印" },
      { id: "ky2", nm: "移文属县", tp: "空印", note: "已印的公文发出去", def: 4, yin: 1, po: "空印" },
      { id: "ky3", nm: "空印文状", tp: "空印", note: "案牍山积，只好如此", def: 6, yin: 1, po: "空印", same: "ky1" },
      { id: "qb", nm: "亲笔结绝", tp: "本任", note: "知州亲判，不用假手", def: 3, yin: 0, po: "社役" },
      { id: "ky4", nm: "移文属县", tp: "空印", note: "符到即行", def: 4, yin: 1, po: "空印", same: "ky2" }
    ],
    // 定州用五十七岁那批立绘（白须＋毛斗篷），不拿黄州四十五岁的脸跨章。
    rules: {
      head: "这一章你真的有权 —— 所以对手不是别人，是惯例",
      title: "堂上三句 · 定州",
      rows: [
        ["一、签书", "知定州军州事可判狱、可结绝刑名、可亲笔签书。黄州章不能做的事，这里全能做"],
        ["二、先印后书", "公使库文状例先印后书，是当时的通行做法，不是罪。牌面上「空印 +1」就是走这条路"],
        ["三、空印不罚在本章", "空印一状不掉任何数。它在绍圣元年才变成罪 —— 到时候会连本带利回到这一栏"],
        // 那个数不抄进玩家看得见的行里：拒绝空印仍能结绝（跑出来 17/16）由 validate_cards 那条断言守着
        ["拒绝空印", "牌上「空印」那一栏一格不填，也结绝得了。印不印是你的选择，不是系统逼的"]
      ]
    },
    pose: { gjs: "dzact-court-1", jd: "dzact-court-4", ws: "dzact-court-3", bj: "dzact-court-2",
      bg: "dzact-court-1", tl: "dzact-court-1", bl: "dzact-court-2", qb: "dzact-court-4",
      ky1: "dzact-court-3", ky2: "dzact-court-3" },
    win: { t: "这不是罪。—— 到绍圣元年，它是。", src: "玩家提示语·非引文" }
  },

  // ── 灶前：烝栗 ──────────────────────────────────────
  // 定州没有猪肉颂。河北官斋冬日可考的吃食只有栗与柑，且都只到【存疑】。
  // 靶子照旧是区间：添炭最猛，糊得也最猛。
  stove: {
    // 火候/咸甜酸油/几拍/该不该切 —— 全在 灶前.js 的 BOOK 里，这里只留故事那一头
    dish: "烝栗 · 北地冬", got: "烝栗",
    quote: { t: "寄君东阁闲烝栗。", src: "《寄馏合刷瓶与子由》·定州任上【有据】" },
  },

  // ── 上街：河北雪后 ──────────────────────────────────
  // 关键设计：**卖假历史的摊子**。定州今有「东坡吊炉烧饼」「口蘑东坡」，
  // 调研判【传说】（无宋人依据，现代地方物产营销）。买了不加食单，只掉物议。
  // 玩家必须靠牌面上的 tag 分辨，这才是可读的靶子。
  street: {
    /* 必买三味原本含"中山松醪"。降级成【传说】之后它就不能再留在必买里 ——
       `validate_cards` 有一条"必买清单里不许混假历史摊子"的断言替玩家守着这件事（它当场红了这条），
       顶上来的是同章有诗可引的蜜渍荔枝（《次韵曾仲锡承议食蜜渍生荔枝》）。审计问25 说"必买三味不动"，
       这一处**偏离**：动的是哪三味，不是买不买得到（价格 46 vs 40，预算 400 不受影响）。 */
    budget: 400, need: ["蜜渍荔枝", "烝栗", "黄柑"],
    verseFull: "bone", verseMiss: "money",
    quote: { t: "燕南异事真堪记，三寸黄柑擘永嘉。", src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作【有据】" },
    stalls: [
      /* 旧版本标 tag:"有据"、note:"任上实有，曾寄雄州守"、src 引《中山松醪寄雄州守王引进》——
         与调研档的裁定正面冲突（定州自撰诗文检索无"酿酒"一字；"中山"是郡名，后人因名附会；
         《中山松醪赋》系早年旧作）。SSOT 给的合规说法是"任上饮中山土酒"，
         所以这里降为【传说】、摊名改"中山土酒"，note 里那句"曾寄雄州守"删掉。
         数值与必买三味不动（改的是说法，不是玩法）。 */
      /* tag 用【存疑】而不是【传说】：这条规则把"传说"留给**现代地方营销追认的假历史摊**
         （吊炉烧饼、口蘑东坡 —— 买了要掉人情物议）。中山酒不一样：它有宋人同时代人的诗句为证，
         是**真的州土名物**，假的只是"他亲手酿的"那一层。所以既不判有据、也不当陷阱卖。 */
      { nm: "中山土酒", price: 40, art: "dzwine", rq: 4, wy: 2, sh: -1, tag: "存疑",
        note: "州土名物 · 非其所酿",
        src: "张舜民（时接守中山）悼轼诗「满酌中山酒，重添丈八盆」【句有据；篇名未核·存疑】—— 只证明此酒是定州名物，不证明此酒为他所酿" },
      { nm: "烝栗", price: 12, art: "dzlizi", rq: 2, wy: 0, sh: 1, tag: "有据",
        note: "东阁闲烝栗 · 官斋冬日",
        src: "《寄馏合刷瓶与子由》·元祐八年十二月二十五日自题" },
      { nm: "黄柑", price: 18, art: "dzgan", rq: 2, wy: 1, sh: 0, tag: "有据",
        note: "自永嘉来 · 北地吃南果",
        src: "《次韵曾仲锡元日见寄》·定州作" },
      { nm: "河朔白啖", price: 22, art: "dish-gu", rq: 1, wy: 1, sh: -1, tag: "有据",
        note: "白啖本河朔 · 做法未详",
        src: "《立春日小集呈李端叔》·定州作" },
      { nm: "蜜渍荔枝", price: 46, art: "dish-lychee.webp", rq: 3, wy: 2, sh: -2, tag: "有据",
        note: "得蜜犹应薄刑 · 北地腌荔",
        src: "《次韵曾仲锡承议食蜜渍生荔枝》·定州卷" },
      { nm: "东坡吊炉烧饼", price: 60, art: "dish-rou-1", rq: -6, wy: -4, sh: -2, tag: "传说",
        note: "宋人无据 · 今人追认 · 不入册" },
      { nm: "口蘑东坡", price: 80, art: "dish-fish.webp", rq: -6, wy: -5, sh: -3, tag: "传说",
        note: "菜名今有 · 宋人无考 · 不入册" }
    ]
  },

  // ── 席间：犒士 ─────────────────────────────────────
  // 张舜民时接知定州，河北同僚【有据（事）】；弓箭社社兵是无名之人，
  // 说的是拟的白话，不冒充苏轼语；王朝云是家眷，从黄州一路跟到惠州。
  banquet: {
    rounds: 6, need: 4,
    place: "雪浪斋 · 立春小集",
    quote: { t: "辛盘得青韭，腊酒是黄柑。", src: "《立春日小集呈李端叔》·绍圣元年立春定州作【有据】" },
    // 三位都是定州核到的人：李之仪（端叔，轼辟在幕府，《姑溪集》题跋自记「从苏先生于定武」）、
    // 曾仲锡（定州通判，轼有元日见寄与食蜜渍荔枝二首次其韵）、滕兴公（字希靖，定州倅，《雪浪石》即次其韵）。
    guests: [
      { id: "li", nm: "李之仪", art: "dzguest-2", want: "典", joy: 0,
        say: "他是我辟来幕下的。", src: "《姑溪集》题跋·李之仪自记【有据】" ,
        hit: { t: "某从公于定武，今日方知东阁烝栗是什么味道。", src: "拟语·李之仪自记「从苏先生于定武」【有据】" },
        miss: { t: "北地苦寒，某词拙。", src: "拟语" }},
      { id: "zeng", nm: "曾仲锡", art: "dzguest-1", want: "趣", joy: 0,
        say: "定州通判。他寄我春盘。", src: "《次韵曾仲锡元日见寄》·定州作【有据】" ,
        hit: { t: "辛盘腊酒，公竟吃得像在开封。", src: "拟语·《立春日小集呈李端叔》【有据】" },
        miss: { t: "萧索东风两鬓华。", src: "《次韵曾仲锡元日见寄》句·定州作【有据】" }},
      { id: "wang", nm: "王朝云", art: "guest-wang", want: "情", joy: 0,
        say: "北地苦寒。稚儿娇女共燔煨 —— 这一锅是家里围着的。", src: "《寄馏合刷瓶与子由》·定州作【有据】；她在定州系据年谱推",
        hit: { t: "北地这一锅，是家里围着的。", src: "《寄馏合刷瓶与子由》「稚儿娇女共燔煨」【有据】，白话是拟的" },
        miss: { t: "公，炭火边你少坐。", src: "拟语" }}
    ],
    dishes: [
      { nm: "中山土酒", art: "dzwine", wei: 2, dian: 3, qu: 2, qing: 1, uses: 2 },
      { nm: "烝栗", art: "dzlizi", wei: 3, dian: 1, qu: 2, qing: 2, uses: 2 },
      { nm: "黄柑", art: "dzgan", wei: 2, dian: 2, qu: 3, qing: 1, uses: 2 },
      { nm: "辛盘青韭", art: "dish-bamboo.webp", wei: 1, dian: 2, qu: 1, qing: 3, uses: 2 },
      { nm: "河朔白啖", art: "dish-gu", wei: 3, dian: 2, qu: 2, qing: 0, uses: 2 },
      { nm: "蜜渍荔枝", art: "dish-lychee.webp", wei: 3, dian: 3, qu: 1, qing: 1, uses: 2 },
      { nm: "苏州米", art: "dish-zhou", wei: 1, dian: 3, qu: 0, qing: 2, uses: 2 },
      // 席上有这一味，食单上没有：那是石头，不是菜。noBook 是明写，不是漏配
      { nm: "雪浪石", art: "dzstone", wei: 0, dian: 4, qu: 3, qing: 2, uses: 1, noBook: 1 }
    ],
    dimKey: { 味: "wei", 典: "dian", 趣: "qu", 情: "qing" },
    verseK: "yuan"
  },

  // ── 信 ──────────────────────────────────────────────
  // 定州的信只写核得到的往来。回信三个选项全部是真苏轼句子（可跨年，src 写清系年）。
  letters: [
    {
      id: "you", when: 1, from: "苏辙", who: "子由 · 弟", layer: "正史",
      body: "东府那场雨里你送我，说「今年中山去，白首归无期」。你现在在定州，蒸栗的时候想起我。",
      src: "《东府雨中别子由》《寄馏合刷瓶与子由》·皆定州前后亲作【有据】",
      ask: "他其实是在问：你自请外任，是不是已经知道要出事了",
      tone: { 旷: 2, 灰: 3, 壮: 2 },
      replies: [
        { k: "灰", t: "今年中山去，白首归无期。", src: "《东府雨中别子由》·元祐八年九月十四日出都作" },
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期，非定州作" },
        { k: "旷", t: "约束家僮好收拾，故山梨枣待翁来。", src: "《寄馏合刷瓶与子由》·定州任上" }
      ]
    },
    {
      id: "zeng", when: 3, from: "曾仲锡", who: "定州通判 · 幕同僚", layer: "正史",
      body: "元日寄我春盘与曾坑茶。我回他：我们这里供的是云泽米 —— 定武斋酿酒用的是苏州米。燕南异事，就这一桩值得记。",
      src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作【有据】，自注「定武斋酒用苏州米」",
      ask: "他其实是在问：你在河北，过得下去么",
      tone: { 旷: 3, 灰: 1, 壮: 2 },
      replies: [
        { k: "旷", t: "喜见春盘得蓼芽。", src: "《次韵曾仲锡元日见寄》·定州作" },
        { k: "灰", t: "萧索东风两鬓华，年年幡胜剪宫花。", src: "《次韵曾仲锡元日见寄》·定州作" },
        { k: "壮", t: "愁闻塞曲吹芦管。", src: "《次韵曾仲锡元日见寄》·定州作" }
      ]
    },
    {
      id: "tan", when: 5, from: "虞策 · 来之邵", who: "侍御史 · 弹章", layer: "正史",
      body: "轼在元祐间凡作文字讥斥先帝。吕惠卿制词曰「均输之政，自同商贾；手实之祸，下及鸡豚」；吕大防制词则曰「民亦劳止，愿闻休息之期」。凡此之类，播在人口，当原其所犯，明正典刑。",
      src: "【有据】《九朝编年备要》卷二十四，绍圣元年夏四月条。所引两句本身确是他亲草的制诰（《东坡全集》卷一百七、卷一百六）—— 台谏拿他自己的字告他自己",
      ask: "这一封回不了：它引的是你写得最好看的句子",
      tone: { 壮: 2, 灰: 3, 旷: 1 },
      replies: [
        { k: "灰", t: "也拟哭途穷，死灰吹不起。", src: "《寒食雨二首》其二·黄州作" },
        { k: "壮", t: "岂是闻韶解忘味，迩来三月食无盐。", src: "《腊日游孤山访惠勤惠思二僧》句·杭州期" },
        { k: "旷", t: "回首向来萧瑟处，归去，也无风雨也无晴。", src: "《定风波》·黄州作" }
      ]
    },
    {
      id: "hua", when: 4, from: "东坡断案", who: "明清公案话本 · 话本层", layer: "传说",
      body: "说相公在定州三日断一百二十事，吏胥不能欺，又说他以都监系狱、亲往鞫之。—— 这话本里什么都有，就是没有宋人的字。",
      src: "【传说】明清公案话本托名。苏轼两任皆无可靠判牍传世；定州确有完整判狱权是【有据】（《宋史·苏轼传》），案子是后人编的",
      ask: "这一关是后人编的：进去就知道不是正史",
      tone: { 旷: 3, 壮: 2, 灰: 2 },
      replies: [
        { k: "旷", t: "也无风雨也无晴。", src: "《定风波》·黄州作" },
        { k: "灰", t: "与谁同坐，明月清风我。", src: "《点绛唇》·一说非黄州" },
        { k: "壮", t: "老夫聊发少年狂。", src: "《江城子·密州出猎》·密州期" }
      ]
    },
    /* ── 分支两封：弹章之后 ──────────────────────────────
       虞策·来之邵那一封回得硬气（壮／旷）→ 李之仪在幕中把定州人的话带给他；
       回得灰（灰）→ 苏辙第二封来，不敢说别写，只说别署名。
       两条互斥。正文照旧是"对面的人回你一句你确实写过的话"，措辞拟的写明「书辞拟」。 */
    {
      id: "li", when: 6, from: "李之仪", who: "端叔 · 幕客", layer: "正史",
      after: { id: "tan", k: ["壮", "旷"] },
      body: "「带弓而锄，佩剑而樵」—— 公此状，都下已传诵。之仪在幕中，日见弓箭社之民，知公非空言。",
      src: "《乞增修弓箭社条约状二首》之一·元祐八年十一月十一日知定州状奏【有据】；李之仪字端叔，元祐末为定州幕客【有据】。书辞拟",
      ask: "他是来问：这状子递上去，你还回不回得来",
      tone: { 壮: 3, 旷: 2, 灰: 1 },
      replies: [
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期，非定州作" },
        { k: "旷", t: "异哉驳石雪浪翻，石中乃有此理存。", src: "《雪浪斋铭》·定州任上" },
        { k: "灰", t: "知我空堂坐画灰。", src: "《寄馏合刷瓶与子由》·定州任上" }
      ]
    },
    {
      id: "you2", when: 6, from: "苏辙", who: "子由 · 弟", layer: "正史",
      after: { id: "tan", k: "灰" },
      body: "「今年中山去，白首归无期」—— 兄此语，弟每读为兄不寐。台章之事，愿兄自今少与朝士书。",
      src: "《东府雨中别子由》·元祐八年九月十四日出都作（弟诵之）；苏辙元祐八年在开封府、十二月罢【有据】。书辞拟",
      ask: "他不敢说别写。他只说：写的时候别署你的名字",
      tone: { 灰: 3, 旷: 2, 壮: 1 },
      replies: [
        { k: "灰", t: "老人心事日摧颓，宿火通红手自焙。", src: "《寄馏合刷瓶与子由》·定州任上" },
        { k: "旷", t: "燕南异事真堪记，三寸黄柑擘永嘉。", src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作" },
        { k: "壮", t: "太行西来万马屯，势与岱岳争雄尊。", src: "《雪浪石》（《次韵滕大夫三首》之一）·定州郡斋作" }
      ]
    }
  ],

  letterDims: { key: "气", title: "补一句 · 回哪一句都算回过 —— 只是空印已经印下去了" },

  // 两味「传说」故意留在册上永远空着：食单记不下宋人书里没有的东西。
  book: {
    dishes: ["中山土酒", "烝栗", "黄柑", "河朔白啖", "蜜渍荔枝", "辛盘青韭", "苏州米", "东坡吊炉烧饼", "口蘑东坡"],
    verses: ["stone", "calm", "arrive", "pork", "money", "bone", "yuan"],
    // pork「带弓而锄，佩剑而樵」出《乞增修弓箭社状》—— 是兵事，本局的堂上/上街/席间/灶前都没那一手
    later: ["pork"]
  },


  asides: [
    { t: "定武斋酒用苏州米。", src: "《次韵曾仲锡元日见寄》自注·定州作【有据】",
      hint: "河北官斋酿酒用哪里的米，他记得清清楚楚" },
    { t: "异哉驳石雪浪翻，石中乃有此理存。", src: "《雪浪斋铭》·定州任上自署绍圣元年【有据】",
      hint: "说着政事，他忽然说起那块石头" },
    { t: "带弓而锄，佩剑而樵。", src: "《乞增修弓箭社条约状二首》之一·元祐八年十一月十一日状奏【有据】",
      hint: "奏状里夹了一句农家话" },
    { t: "人说相公在定州，三日断一百二十事，吏胥不能欺。", src: "【传说】明清公案话本托名，苏轼两任皆无判牍传世",
      lie: true, hint: "这话本里的句子，说出来就像在夸自己" }
  ],
  achv: [
    { k: "noYin", t: "约束家僮好收拾，故山梨枣待翁来。", src: "《寄馏合刷瓶与子由》·定州任上【有据】—— 一张空印都不盖的人，才说得出「等翁来」" },
    { k: "cook", t: "寄君东阁闲烝栗。", src: "《寄馏合刷瓶与子由》·定州任上【有据】" },
    { k: "letter", t: "今年中山去，白首归无期。", src: "《东府雨中别子由》·元祐八年九月十四日出都作【有据】" },
    { k: "clean", t: "异哉驳石雪浪翻，石中乃有此理存。", src: "《雪浪斋铭》·定州任上【有据】" },
    { k: "frail", t: "萧索东风两鬓华。", src: "《次韵曾仲锡元日见寄》·绍圣元年元日定州作【有据】" },
    { k: "saidLie", t: "人间如梦，一尊还酹江月。", src: "《念奴娇·赤壁怀古》·黄州作【有据】—— 话本里那桩案子终究不是他的" }
  ],
};

/* ── 惠州章 · 绍圣元年—四年（1094—1097），虚岁五十八—六十一 ──────────
   三章的堂上**打的不是同一场架**，这是这一层的全部意义：
     黄州 —— 你不能签书，只能替人辩护。对手是「风险」（递上去先弹劾你）。
     定州 —— 你真的能签书。对手是「惯例」，先印后书当时不是罪。代价**延到下一章**。
     惠州 —— 你连辩护的资格都没有（宁远军节度副使、惠州安置，不得签书公事，
             比黄州更严）。要办成一件公事，只有一句话：**借别人的印**。
             对手不是风险也不是惯例，是**人情**——当场扣、看得见、扣光就办不成。
   空印就在这里兑现：绍圣初安惇、虞策、来之邵追论元祐制诰与定州公使库空印事，
   闰四月落职知英州（未赴），六月再降宁远军节度副使、惠州安置。
   所以进这一章时 S.kongYin 每状扣 6 点人情 —— 你在定州偷盖的每一个印，
   都是在惠州少一个肯替你署名的人。
   系年与人名一律按 `调研/定州与惠州年表与食单.md`：
     程之才（字正辅，母党表亲，绍圣中差遣广东、按临惠州，轼因得庇护）【有据（事）／篇名存疑】；
     「表兄文勋」「杨世杰」「张敦矩」核无其人或不相关，一律不入戏；
     卓锡泉酿酒、卖犀带佐费筑室、六如亭、「东坡肉在惠州」全【传说】，只进话本层；
     《独觉》触怒章惇因而再贬【传说】（诗本身【有据】）。 */
CHAPTERS.huizhou = {
  chapter: {
    name: "惠州", shichen: 6, year: "绍圣元年", age: "五十八岁",
    office: "宁远军节度副使 · 惠州安置 · 不得签书公事",
    full: "绍圣元年—四年（1094—1097）。落职知英州（未赴）→ 降宁远军节度副使、惠州安置 —— 比黄州更严：这一次连「委使佐郡」都没有。",
    bookHint: "岭南三年可考的吃食全在这里 —— 荔枝是他的招牌，也是他的忌口",
    hub: "fx2-hiz-hub-c-1.webp", hall: "fx3-hiz-court-c-2.webp", stove: "sc-hiz-stove2-1.webp",
    street: "fx3-hiz-street-c-1.webp", banquet: "fx3-hiz-banquet-c-2.webp", end2: "cover-hiz-2.webp",
    map: MAPTRIP, chapmap: "map2-hiz-2.webp", plaque: [0.252, 0.275, 0.040, 0.175], tiepaper: TIEPAPER,
    note: "绍圣元年闰四月落职知英州，六月降宁远军节度副使、惠州安置；十月到惠州，初寓合江楼（《寓居合江楼》）。携朝云、苏过南下，余子寄宜兴。",
    // 绍圣之后官印掉回了私印 —— 和黄州同一枚，只是这一回连「委使佐郡」都没有了。
    seal: { kind: "si", on: "东坡居士 · 私印", off: "空印 · 借来的人名", note: "官印已在追论里掉了" }
  },

  // 章首定调。八个槽位全部换成**核到篇名的惠州原文**；
  // money 一条系年各本小异，按调研档要求挂【有据（诗）／下字存疑】。
  lines: {
    arrive: { t: "日啖荔枝三百颗，不辞长作岭南人。", src: "《食荔枝二首》其二·惠州作【有据】" },
    // 「寂寂东坡一病翁」是《纵笔三首》其一，通行系年在**儋州**（其三「北船不到米如珠」正是海南景象），不是惠州。
    // 旧版本地把它标成「惠州作【有据】」＝把系年写成定论。句子真有，留用，但降为「通行系年＋存疑＋跨章借句」，
    // 并等一条中华本回校（审计 P1-7⑤／问26）。
    cold:   { t: "寂寂东坡一病翁，白须萧散满霜风。", src: "《纵笔三首》其一·通行系年在儋州（未回校中华本【存疑】）；跨章借句" },
    lone:   { t: "高情已逐晓云空，不与梨花同梦。", src: "《西江月·梅花》·绍圣三年悼朝云作【有据】" },
    rain:   { t: "报道先生春睡美，道人轻打五更钟。", src: "《独觉》·惠州作【诗有据】；「章惇读之怒而再贬」出宋人诗话【传说】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】" },
    calm:   { t: "玉骨那愁瘴雾，冰姿自有仙风。", src: "《西江月·梅花》·惠州作【有据】" },
    pork:   { t: "东坡羹，盖今之菜羹也。", src: "《东坡羹颂并引》【篇名有据】；是否惠州所作【存疑】" },
    money:  { t: "东陂雨一尺，水满稻苗新。", src: "《东陂》·惠州作【有据】；下字以中华书局《苏轼诗集》为准【存疑】" },
    bone:   { t: "然此说行，则众狗不悦矣。", src: "《与子由书》·绍圣三年惠州作，论烤羊脊骨【有据】" },
    crossing: { t: "浩然天地间，惟我独也正。", src: "《过大庾岭》·绍圣元年过岭作【有据】" },
    chaoyun: { t: "苗而不秀岂其天。", src: "《悼朝云》·绍圣三年【有据】；朝云卒于七月，年三十四，葬栖禅寺东南沙洲" },
    guijiu: { t: "南方之饮，桂以为醴。", src: "《桂酒颂并叙》·惠州作【有据（篇名）】；句读以中华本为准【存疑】" }
  },

  // 人情 70 是**还没扣空印之前**的数；身体 48 —— 消渴疾从这一章开始真的管事。
  // 物议开局就是负的：台谏的弹章已经在那里了。
  // 神情词表：差分图命名 = 立绘名 + "-" + 神情，如 dpw-1-lei-cut.png
  fx: ["xiao", "leng", "nu", "lei", "si", "ku", "jing", "xi", "bing"],
  heroArt: ["hiz-dongpo-1","hiz-dongpo-2","hizact1-1","hizact1-2","hizact2-1","hizact2-2","hizact3-1","hizact3-2","hizact4-1","hizact4-2","hizact5-1","hizact5-2"],
  bars: { 火候: 20, 银钱: 180, 人情: 70, 物议: -15, 身体: 48 },
  // ── 对话：惠州章插入点 ──────────────────────────────
  // 这一章的戏眼是两件事：借别人的名字办事，和朝云死在这里。
  dlg: {
    arrive: [
      { w: "我", p: "hizact4-1", t: "浩然天地间，惟我独也正。",
        src: "《过大庾岭》·绍圣元年过岭作" },
      { w: "我", p: "hiz-dongpo-1", e: "xi", t: "日啖荔枝三百颗，不辞长作岭南人。",
        src: "《食荔枝二首》其二·惠州作" },
      { w: "吏", p: "none", t: "公责授惠州安置。不得签书公事 —— 这回连委使也没有了。",
        src: "拟语·职事由《宋史·苏轼传》【有据】" }
    ],
    courtOpen: [
      { w: "我", p: "hiz-dongpo-2", e: "nu", t: "民病如是，而某以罪人不得署一纸。",
        src: "拟苏轼语·非原文（惠州促修两桥、免折支盐钱事【有据，《两桥诗》并叙】）" },
      { w: "郡吏", p: "none", t: "两桥要修，钱要出自酒税。公一句话，我们不敢担。",
        src: "拟语·东西两桥【有据，《两桥诗》并叙】" },
      { w: "我", p: "hizact2-1", e: "nu", t: "我不署名。我只问一句：桥成了，谁走路？",
        src: "拟苏轼语·非原文" }
    ],
    courtBorrow: [
      { w: "程正辅", p: "hiz-guests-2-p2", t: "这状我署。十二年不通问了，今日署一个状。",
        src: "拟语·程之才按临惠州、轼因得庇护【有据（事）】" },
      { w: "我", p: "hiz-dongpo-2", t: "这件事办成了。上面写的不是我的名字。",
        src: "拟苏轼语·非原文" }
    ],
    courtWin: [
      { w: "我", p: "hizact3-1", t: "报道先生春睡美，道人轻打五更钟。",
        src: "《独觉》·惠州作【诗有据】；「章惇读之怒而再贬」出宋人诗话【传说】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】" }
    ],
    courtLose: [
      { w: "我", p: "hiz-dongpo-2", e: "bing", t: "寂寂东坡一病翁，白须萧散满霜风。",
        src: "《纵笔三首》其一·通行系年儋州【存疑】；跨章借句" }
    ],
    stoveFirst: [
      { w: "我", p: "hizact2-2", t: "东坡羹，盖今之菜羹也。",
        src: "《东坡羹颂并引》【篇名有据】；是否惠州所作【存疑】" },
      { w: "我", p: "hizact1-1", t: "虽甘腴满前，而口不能茹。",
        src: "《东坡羹颂并引》【存疑：措辞未回校中华本】" }
    ],
    tieOpen: [
      { w: "我", p: "hizact4-2", t: "他把方子写在题目里了。菘、蔓菁、芦菔，不用肉。",
        src: "《东坡羹颂并引》【篇名有据】" }
    ],
    dishOk: [
      { w: "我", p: "hizact5-1", t: "罗浮山下四时春，卢橘杨梅次第新。",
        src: "《食荔枝二首》其二·惠州作；「卢橘」即枇杷【有据，传统注】" }
    ],
    dishFail: [
      { w: "我", p: "hizact3-2", t: "空庖煮寒菜，破灶烧湿苇。",
        src: "《寒食雨二首》其二·黄州作（跨章借句）" }
    ],
    seatTake: [
      { w: "程正辅", p: "hiz-guests-2-p2", t: "十二年。你瘦了。",
        src: "拟语·表兄弟复相见【有据（事）】" },
      { w: "苏过", p: "hiz-guests-1-p3", t: "爹，荔枝下来了。",
        src: "拟语·苏过独随惠儋二贬【有据】" },
      { w: "王朝云", p: "guest-wang", e: "xiao", t: "这里的水土，我受得住。公别替我担心。",
        src: "拟语·朝云唯一随行惠州【有据】；她绍圣三年七月卒于惠，年三十四" }
    ],
    banquetOk: [
      { w: "我", p: "hiz-dongpo-1", e: "xiao", t: "不辞长作岭南人。",
        src: "《食荔枝二首》其二·惠州作" }
    ],
    banquetFail: [
      { w: "我", p: "hiz-dongpo-2", e: "lei", t: "高情已逐晓云空，不与梨花同梦。",
        src: "《西江月·梅花》·绍圣三年悼朝云作" }
    ],
    streetOk: [
      { w: "我", p: "hizact1-1", t: "不敢与仕者争买，时嘱屠者买其脊骨。",
        src: "《与子由书》·绍圣三年惠州作" }
    ],
    streetMiss: [
      /* 自家规矩被自己突破：src 明写「未回校前不入正文台词」，可这一句正是 streetMiss 的正文台词。
         换成本章 lines.cold 之外那条已核的《独觉》（同一位、同一事，诗有据），
         "章惇读之怒而再贬"照旧分层标【传说】。 */
      { w: "我", p: "hizact5-2", t: "报道先生春睡美，道人轻打五更钟。",
        src: "《独觉》·惠州作【诗有据】；「章惇读之怒而再贬」出宋人诗话【传说】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】" }
    ],
    mailOpen: [
      { w: "我", p: "hizact2-1", t: "先寄一声，平安而已。",
        src: "拟苏轼语·非原文" }
    ],
    seal: [
      { w: "我", p: "hiz-dongpo-2", e: "lei", t: "玉骨那愁瘴雾，冰姿自有仙风。",
        src: "《西江月·梅花》·惠州作" }
    ]
  },

  // ── 堂上：借印 ──────────────────────────────────────
  // ren: N 的牌＝**借别人的印**。它和空印牌一样无视意图按全额结绝
  // （人家署的真名，什么案子都盖得住），但当场扣 N 点人情。
  // 人情不够就**点不动**（卡角写「借不动」），不是硬吃惩罚。
  // 拒绝借印的贪心线必须照样结绝 —— 验收里有这一条断言。
  court: {
    mode: "借印", repay: 8,
    verseWin: "rain", verseLose: "cold",
    rounds: 7, need: 18,
    caseName: "惠州东西两桥 · 罪官不得署名【案名拟】",
    artFb: "pot-4",
    caseRows: [
      ["事由", "东新桥跨东江，西新桥跨丰湖。桥要修，酒税要免，仓米要粜 —— 都归守臣签书"],
      ["我的身份", "宁远军节度副使、惠州安置，不得签书公事。连黄州那种「知州委使佐郡」都没有"],
      ["能做的事", "私书请托、劝化乡里、认一个名目 —— 每一件都要借别人的手、别人的印"],
      ["忌讳", "安置官干预郡事，是台谏现成的弹章素材。借谁的手，就把谁放到火上"],
      ["出处", "苏轼两任皆无可靠判牍传世；《两桥诗》并叙、《与王敏仲书》诸帖为【有据】，两造口供一律是拟的"]
    ],
    // 四类争讼的题目都有据（东西新桥《两桥诗》叙；常平粜米、折支盐钱见与广南帅诸书；
    // 秧马《秧马歌》并引）。具体口供是拟的。
    intentSeq: ["盐钱", "粜米", "修桥", "盐钱", "越权", "修桥", "粜米"],
    intentText: {
      "盐钱": "他要的是：惠州折支盐钱免了，钱从哪来",
      "粜米": "他要的是：常平仓的米，凭什么放",
      "修桥": "他要的是：东西两桥，谁来督这个工",
      "越权": "他要的是：你一个安置副使，手伸得太长"
    },
    cards: [
      { id: "shu", nm: "私书敏仲", tp: "私札", note: "广南漕司是旧交", def: 3, ren: 0, po: "盐钱",
        src: "《与王敏仲八首》·惠州作【有据】" },
      { id: "ky1", nm: "借正辅署状", tp: "借印", note: "表兄按临，这状写得动", def: 5, ren: 16, po: "借印",
        src: "程之才字正辅，绍圣中差遣广东、按临惠州，轼因得庇护【有据（事）】" },
      { id: "mi", nm: "请发仓粟", tp: "请仓", note: "米贵则粜，米贱则收", def: 3, ren: 0, po: "粜米" },
      { id: "zhu", nm: "募义督工", tp: "督工", note: "不出官钱，劝人出钱", def: 4, ren: 0, po: "修桥",
        src: "《两桥诗》并叙·惠州作【有据】" },
      { id: "ky2", nm: "借郡名出帖", tp: "借印", note: "我不出面，让守臣出", def: 4, ren: 12, po: "借印" },
      { id: "fu", nm: "复书辞之", tp: "守分", note: "安置官不预郡事", def: 2, ren: 0, po: "越权" },
      { id: "shu2", nm: "私书敏仲", tp: "私札", note: "再寄一封，说清利害", def: 3, ren: 0, po: "盐钱", same: "shu" },
      { id: "ky3", nm: "借漕司寄信", tp: "借印", note: "敏仲替我递上去", def: 5, ren: 14, po: "借印", same: "ky1" },
      /* 「林夫人」这个名字是本工程自己安上去的：调研档只记两桥叙中有"出带佐费"其事，
         主事者的官职人名**未及核**，而"卖犀带"属白鹤峰筑室那一事的【传说】。
         牌名与 note 因此去掉人名，src 分三级标清楚（审计 P2-14）。 */
      { id: "zhu2", nm: "劝人出带", tp: "督工", note: "有妇人输犀带佐费 · 人名未核", def: 4, ren: 0, po: "修桥", same: "zhu",
        src: "《两桥诗》并叙有「出带佐费」其事【有据】；主事者官职人名未及核【存疑】；「卖犀带」系白鹤峰筑室一事，那条是【传说】" },
      { id: "mi2", nm: "乞减价粜", tp: "请仓", note: "先声后实，粜尽还廪", def: 3, ren: 0, po: "粜米", same: "mi" },
      { id: "jiu", nm: "只榜谕乡里", tp: "守分", note: "不用印，用一张告示", def: 3, ren: 0, po: "越权" },
      { id: "yang", nm: "献秧马", tp: "农具", note: "一日抵十夫之力", def: 2, ren: 0, po: "粜米",
        src: "《秧马歌》并引·惠州作【有据】" },
      { id: "tan", nm: "待罪不言", tp: "守分", note: "这一案我闭嘴", def: 1, ren: 0, po: "越权" }
    ],
    rules: {
      head: "这一章你连辩护的资格都没有 —— 想办成事，只有一件事可买：别人的名字",
      title: "堂上三句 · 惠州",
      rows: [
        ["一、不得签书", "宁远军节度副使、惠州安置。黄州尚有知州委使，惠州连这一层都没有 —— 你签的字一张也出不去"],
        ["二、借印", "带「借印」的那几张无视意图全额结绝：人家署的是真名，什么案子都盖得住。代价当场记在「人情」那一栏"],
        ["三、空印要还", "定州每攒一状空印，进这一章就少 8 点人情（最低 20）。绍圣初安惇、虞策、来之邵追论的那桩罪，就是你在定州盖下去的"],
        // 不借也结得了绝（22/18）：这条数在 validate_cards 的"捷径牌一张不用"那一断言里，不印在纸上
        ["借不动", "人情不够，带「借印」的牌直接点不动（角上写「借不动」）。不借也结得了绝 —— 只是要一状一状地劝"],
        ["债要压得住", "空印是借的，借一次少一次：定州每多欠一状，进这一章就先少一截人情 —— 那枚印不是白盖的"]
      ]
    },
    // 惠州立绘是**五十八岁清瘦版**那张脸（消渴疾后他瘦了），不与定州共用。
    // 资产未到位前 artFb 兜底：卡面显示那只砂锅，不显示别人的脸。
    pose: { shu: "hizact1-1", zhu: "hizact2-1", mi: "hizact1-1", yang: "hizact4-1",
      fu: "hizact3-1", jiu: "hizact3-1", tan: "hizact4-1",
      ky1: "hizact2-1", ky2: "hizact2-1" },
    win: { t: "这件事办成了。上面写的不是我的名字。", src: "玩家提示语·非引文" }
  },

  // ── 灶前：东坡羹 ────────────────────────────────────
  // 这一锅的靶子和前两章一样是区间，但**多了一根会断的弦**：身体。
  // 1) 「添肉」是最快的一张牌，而《东坡羹颂》自己写了不用肉 —— 一放就糊过线，
  //    必须拿两张芦菔才压得回来。这一张就是黄州章那个「催」按钮的后继。
  // 2) 「亲火」是最好用的缓牌，身体掉到 40 以下就**点不动**（卡角「吃不动」）。
  //    做菜系统从这一章起，不再只是「做不出」，而是「吃不动」。
  stove: {
    // 火候/咸甜酸油/几拍/该不该切 —— 全在 灶前.js 的 BOOK 里，这里只留故事那一头
    dish: "东坡羹 · 不用肉", got: "东坡羹",
    quote: { t: "用菘苦蔓菁及芦菔法，不用肉。", src: "《东坡羹颂并引》·【篇名有据】" },
  },

  // ── 上街：岭南物产 ──────────────────────────────────
  // 这一章的假历史摊子换成「惠州才是东坡肉老家」一类的今人追认，
  // 外加一味**真的但宋人无据**的东龙华虱 —— 它比假招牌更像真的，所以更值钱。
  // 荔枝是这一章的靶心：满城都好吃，牌面上写着 -12 身体。
  street: {
    budget: 180, need: ["荔枝", "真一酒米", "秧马"],
    verseFull: "bone", verseMiss: "crossing",
    artFb: "pot-4",
    quote: { t: "罗浮山下四时春，卢橘杨梅次第新。", src: "《食荔枝二首》其二·惠州作【有据】；「卢橘」即枇杷【有据，传统注】" },
    stalls: [
      { nm: "荔枝", price: 20, art: "hiz-lizi-1", rq: 6, wy: 3, sh: -12, tag: "有据",
        note: "满城皆贱 · 唯消渴疾忌之",
        src: "《食荔枝二首》其二·惠州作【有据】；「三百颗」是诗家夸张语，不是他真的一天吃三百颗" },
      { nm: "真一酒米", price: 30, art: "hiz-wine-1", rq: 3, wy: 2, sh: 0, tag: "有据",
        note: "岭南酥酒，他自己有名目",
        src: "《真一酒歌》·惠州作【有据】" },
      { nm: "羊脊骨", price: 10, art: "dish-gu", book: "烤羊脊骨", rq: 1, wy: 0, sh: 2, tag: "有据",
        note: "不敢与仕者争买 · 嘱屠者别留",
        src: "《与子由书》·绍圣三年惠州作【有据】" },
      { nm: "杨梅", price: 8, art: "hiz-mei-1", rq: 2, wy: 1, sh: 1, tag: "有据",
        note: "次第新 · 罗浮山下",
        src: "《食荔枝二首》其二·惠州作【有据】" },
      { nm: "卢橘", price: 8, art: "hiz-mei-2", rq: 2, wy: 1, sh: 1, tag: "有据",
        note: "即枇杷，诗中「卢橘」指它",
        src: "《食荔枝二首》其二·惠州作【有据】；「卢橘」即枇杷出传统注" },
      { nm: "秧马", price: 15, art: "hiz-dao-1", rq: 3, wy: 2, sh: 0, tag: "有据",
        note: "不是吃的 · 是农具 · 入册",
        src: "《秧马歌》并引·惠州作【有据】" },
      { nm: "东龙华虱", price: 35, art: "dish-hao", rq: -6, wy: -4, sh: -1, tag: "传说",
        note: "今人食谱盛称 · 宋人集中无考 · 不入册" },
      { nm: "东坡御风饼", price: 45, art: "dish-rou-1", rq: -7, wy: -5, sh: -2, tag: "传说",
        note: "菜名今有 · 宋人无考 · 不入册" }
    ]
  },

  // ── 席间：白鹤峰新居落成 ────────────────────────────
  // 三位都是惠州核得到的人：程之才（正辅，表兄，按临惠州）、苏过（独随惠儋二贬）、
  // 王朝云（唯一随行的家眷，这一章里她会死）。
  banquet: {
    rounds: 6, need: 4,
    place: "白鹤峰 · 新居落成",
    artFb: "pot-4",
    quote: { t: "岂知大罗天，元在扶桑东。", src: "《白鹤峰新居欲成，夜过西邻翟秀才二首》·惠州作【有据（篇名）】；句读以中华本为准【存疑】" },
    guests: [
      { id: "cheng", nm: "程正辅", art: "hiz-guests-2-p2", want: "典", joy: 0,
        say: "十二余年不相闻问。他按临惠州这一天，我才敢开口说话。",
        src: "程之才字正辅，母党表亲，娶轼从妹；绍圣中差遣广东、按临惠州，表兄弟复相见【有据（事）】，篇名出苏辙《亡兄子瞻端明墓表》一路宋人记载【存疑：措辞待核《栾城集》】" ,
        hit: { t: "十二年。今日这一盏我认。", src: "拟语·表兄弟复相见【有据（事）】" },
        miss: { t: "岭南的水土，你受得住？", src: "拟语" }},
      { id: "guo", nm: "苏过", art: "hiz-guests-1-p3", want: "趣", joy: 0,
        say: "儿子累累，只有这一个跟着我过梅岭。",
        src: "《与子由书》及寓惠诸作「儿子累累」语【有据】；惠儋全程侍侧见年谱" ,
        hit: { t: "爹，这一味我记下做法了。", src: "拟语·苏过随侍惠儋【有据】" },
        miss: { t: "……儿子不敢说不好。", src: "拟语" }},
      { id: "wang", nm: "王朝云", art: "guest-wang", want: "情", joy: 0,
        say: "她随我到岭南。这一章里她会死在惠州，年三十四。",
        src: "绍圣三年七月卒于惠州，葬西湖栖禅寺东南沙洲，轼自撰墓志铭【有据】；六如亭为后世附会【传说】",
        hit: { t: "这里的水土，我受得住。", src: "拟语·朝云唯一随行惠州【有据】" },
        miss: { t: "公别只顾着我。", src: "拟语·她绍圣三年卒于惠【有据】" }}
    ],
    dishes: [
      { nm: "荔枝", art: "hiz-lizi-1", wei: 4, dian: 1, qu: 2, qing: 1, uses: 2 },
      { nm: "烤羊脊骨", art: "dish-gu", wei: 3, dian: 2, qu: 1, qing: 2, uses: 2 },
      { nm: "东坡羹", art: "pot-4", wei: 2, dian: 3, qu: 0, qing: 3, uses: 2 },
      { nm: "真一酒", art: "hiz-wine-1", wei: 3, dian: 3, qu: 2, qing: 1, uses: 2 },
      { nm: "桂酒", art: "hiz-wine-2", wei: 2, dian: 4, qu: 1, qing: 2, uses: 1 },
      { nm: "东陂新米饭", art: "hiz-dao-2", wei: 1, dian: 2, qu: 1, qing: 4, uses: 2 },
      { nm: "杨梅", art: "hiz-mei-1", wei: 2, dian: 1, qu: 4, qing: 1, uses: 2 },
      { nm: "卢橘", art: "hiz-mei-2", wei: 3, dian: 1, qu: 3, qing: 0, uses: 2 }
    ],
    dimKey: { 味: "wei", 典: "dian", 趣: "qu", 情: "qing" },
    verseK: "arrive"
  },

  // ── 信 ──────────────────────────────────────────────
  // 惠州四封：表兄（唯一有官身的庇护）· 二子（宜兴不归）· 漕司（借印的对象）· 话本层。
  // 回信三选项全部是真苏轼句子，可跨年，src 写清系年。
  letters: [
    {
      id: "zhengfu", when: 1, from: "程之才（正辅）", who: "表兄 · 广东宪漕", layer: "正史",
      paper: "ui-paper-2",
      body: "十二余年，我们两家不通一问。你按临惠州这天，携家眷过我一顿饭，绝口不谈旧事。",
      src: "【有据（事）】程之才字正辅，母党表亲，绍圣中差遣广东、按临惠州，轼因得庇护；《次韵正辅表兄江行见桃花》【有据】。早年嫌隙之细节出苏辙《亡兄子瞻端明墓表》一路宋人记载，措辞【存疑】",
      ask: "他其实是在问：这十二年，你怪过我么",
      tone: { 旷: 3, 灰: 2, 壮: 2 },
      replies: [
        { k: "旷", t: "报道先生春睡美，道人轻打五更钟。", src: "《独觉》·惠州作【诗有据】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】" },
        { k: "壮", t: "浩然天地间，惟我独也正。", src: "《过大庾岭》·绍圣元年过岭作【有据】" },
        { k: "灰", t: "高情已逐晓云空，不与梨花同梦。", src: "《西江月·梅花》·惠州作【有据】" }
      ]
    },
    {
      id: "mai", when: 3, from: "苏迈 · 苏迨", who: "二子 · 寄居宜兴", layer: "正史",
      paper: "ui-paper-2",
      body: "你们在宜兴来信，说想南来省视。我回不了这个「来」字：过岭的路费我没有，瘴乡我不能让你们来。",
      src: "【事有据】携朝云、苏过南下，余子寄宜兴，「三子各失所」语出惠居书札【篇名存疑】",
      ask: "他其实是在问：父亲，你是不是打算死在岭南",
      tone: { 灰: 3, 旷: 2, 壮: 1 },
      replies: [
        { k: "灰", t: "也拟哭途穷，死灰吹不起。", src: "《寒食雨二首》其二·黄州作" },
        { k: "旷", t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语·黄州作" },
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期" }
      ]
    },
    {
      id: "minzhong", when: 5, from: "王敏仲（王古）", who: "广南漕司 · 旧交", layer: "正史",
      paper: "ui-paper-1",
      body: "你在广州以瓦筒引山流入城，水政一事我记着。惠州这边，盐钱、仓米、两桥，还得借你的手。",
      src: "【有据】《与王敏仲八首》惠州作；「以瓦管引山流入城」之广州水政建议见宋人杂记，【篇名存疑】",
      ask: "这一封不是私事：我不能署名，这一章我说话全要经过别人的手",
      tone: { 壮: 3, 旷: 2, 灰: 1 },
      replies: [
        { k: "壮", t: "岂是闻韶解忘味，迩来三月食无盐。", src: "《腊日游孤山访惠勤惠思二僧》句·杭州期" },
        { k: "旷", t: "日啖荔枝三百颗，不辞长作岭南人。", src: "《食荔枝二首》其二·惠州作【有据】" },
        { k: "灰", t: "人间如梦，一尊还酹江月。", src: "《念奴娇·赤壁怀古》·黄州作" }
      ]
    },
    {
      id: "huaben", when: 4, from: "东坡在惠州", who: "明清话本 · 话本层", layer: "传说",
      paper: "huaben-1",
      body: "话本说：惠州的东坡肉是从你这里传下来的；又说白鹤峰下有一所六如亭，亭上一联是你对朝云写的；再说你用卓锡泉酿酒。——三样都有人信，三样宋人书里都没有。",
      src: "【传说】《猪肉颂》明作于黄州（「黄州好猪肉，价贱如泥土」），惠州有据的肉食是烤羊脊骨；六如亭因墓志「六如偈」语意追筑、亭联出明清；卓锡泉地名真，轼集中核无咏此泉篇",
      ask: "这一关是后人编的：进去就知道不是正史",
      tone: { 旷: 3, 壮: 2, 灰: 2 },
      replies: [
        { k: "旷", t: "也无风雨也无晴。", src: "《定风波》·黄州作" },
        { k: "灰", t: "与谁同坐，明月清风我。", src: "《点绛唇》·一说非黄州" },
        { k: "壮", t: "老夫聊发少年狂。", src: "《江城子·密州出猎》·密州期" }
      ]
    },
    /* ── 分支两封：借别人的手寄出去之后 ──────────────────
       王敏仲那一封回得动（壮／旷）→ 程之才再来一封，这次不是叙旧，是请你写碑；
       回得不动（灰）→ 参寥子从江南寄来，他不论诗，他只问你还活着吗。 */
    {
      id: "zhengfu2", when: 6, from: "程之才", who: "正辅 · 兄行也", layer: "正史",
      after: { id: "minzhong", k: ["壮", "旷"] },
      body: "「浩然天地间，惟我独也正」—— 兄过岭时语，传诵至今。东新桥成，愿得兄一字为碑。",
      src: "《过大庾岭》·绍圣元年过岭作【有据】；程之才字正辅，绍圣间为广东转运提刑、与苏轼和解于惠州【有据】；东新桥成于绍圣三年，轼作《东新桥》诗【有据】。书辞拟",
      ask: "他这次来不是叙旧：他想请你替新桥写一个碑",
      tone: { 壮: 3, 旷: 2, 灰: 1 },
      replies: [
        { k: "壮", t: "浩然天地间，惟我独也正。", src: "《过大庾岭》·绍圣元年过岭作" },
        { k: "旷", t: "日啖荔枝三百颗，不辞长作岭南人。", src: "《食荔枝二首》其二·惠州作" },
        { k: "灰", t: "寂寂东坡一病翁，白须萧散满霜风。", src: "《纵笔三首》其一·儋州作；跨章借句" }
      ]
    },
    {
      id: "can2", when: 6, from: "参寥子", who: "道潜 · 方外友", layer: "正史",
      after: { id: "minzhong", k: "灰" },
      body: "「高情已逐晓云空」—— 公此句，江南已传。师闻之，为公一恸。岭外瘴地，慎饮食，爱身体。",
      src: "《西江月·梅花》·绍圣三年悼朝云作【有据】；道潜（参寥子）与苏轼终身往还【有据】，轼南迁后书问往来逐件未回校【存疑】。书辞拟",
      ask: "这一封不是来论诗的：他是来问你还活着吗",
      tone: { 灰: 3, 旷: 2, 壮: 1 },
      replies: [
        { k: "灰", t: "高情已逐晓云空，不与梨花同梦。", src: "《西江月·梅花》·绍圣三年悼朝云作" },
        { k: "旷", t: "玉骨那愁瘴雾，冰姿自有仙风。", src: "《西江月·梅花》·惠州作" },
        { k: "壮", t: "报道先生春睡美，道人轻打五更钟。", src: "《独觉》·惠州作【诗有据】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】" }
      ]
    }
  ],

  letterDims: { key: "气", title: "补一句 · 回哪一句都算回过 —— 只是每一封都要借别人的手寄出去" },

  // 「东龙华虱」「东坡御风饼」两味故意永远空着：宋人书里没有，食单记不下。
  book: {
    dishes: ["东坡羹", "荔枝", "烤羊脊骨", "真一酒", "真一酒米", "桂酒", "东陂新米饭", "杨梅", "卢橘", "秧马", "东龙华虱", "东坡御风饼"],
    verses: ["arrive", "rain", "calm", "cold", "bone", "crossing"],
    // calm（《西江月·梅花》）确是惠州作的句子，可本章四条得句的路都落不到它 ——
    // 明写"这一章没走到"，不挂「待触发」那张空头支票。
    later: ["calm"]
  },


  asides: [
    { t: "不敢与仕者争买，时嘱屠者买其脊骨。", src: "《与子由书》·绍圣三年惠州作【有据】",
      hint: "给弟弟的信，开头是买骨头" },
    { t: "罗浮山下四时春，卢橘杨梅次第新。", src: "《食荔枝二首》其二·惠州作【有据】",
      hint: "「卢橘」就是枇杷 —— 他自己注的" },
    { t: "苗而不秀岂其天。", src: "《悼朝云》·绍圣三年【有据】",
      hint: "写着写着，他想起她" },
    { t: "惠州的东坡肉，是从你这里传下来的。", src: "【传说】《猪肉颂》明作于黄州；惠州有据的肉食是烤羊脊骨",
      lie: true, hint: "这道菜不是他的 —— 说了要被人抓住" }
  ],
  achv: [
    { k: "noBorrow", t: "报道先生春睡美，道人轻打五更钟。", src: "《独觉》·惠州作【诗有据】；篇名两说（宋人《艇斋诗话》引作《纵笔》）【存疑】—— 不借人名，也睡得着" },
    { k: "cook", t: "东坡羹，盖今之菜羹也。", src: "《东坡羹颂并引》【篇名有据】；是否惠州所作【存疑】" },
    { k: "dish", t: "日啖荔枝三百颗，不辞长作岭南人。", src: "《食荔枝二首》其二·惠州作【有据】" },
    { k: "frail", t: "寂寂东坡一病翁，白须萧散满霜风。", src: "《纵笔三首》其一·儋州作；跨章借句【有据】" },
    { k: "clean", t: "玉骨那愁瘴雾，冰姿自有仙风。", src: "《西江月·梅花》·惠州作【有据】" },
    { k: "letter", t: "浩然天地间，惟我独也正。", src: "《过大庾岭》·绍圣元年过岭作【有据】" },
    { k: "saidLie", t: "高情已逐晓云空，不与梨花同梦。", src: "《西江月·梅花》·惠州作【有据】—— 把「东坡肉在惠州」说圆了，代价是这一句" }
  ],
};

/* ── 儋州章 · 绍圣四年—元符三年（1097—1100），虚岁六十一—六十四 ────────
   四章里最后一级台阶，也是**唯一一级没有「印」的**：
     黄州 质证 —— 有风险，没权限。
     定州 空印 —— 有权限，欠了债。
     惠州 借印 —— 没权限，还有人可借。
     儋州 问字 —— 谁也不能借了。琼州别驾、昌化军安置，监管最严，
                 调研档写明「无任何职权，止于讲学与士人往还」【有据】。
   所以堂上这一屏不再是公堂，是**载酒堂**：学生问字，他答。
   代价也终于落回他身上 —— 牌面上扣的不再是人情，是**身体**（sh 为负、body 为门槛）。
   六十四岁、海岛上、"食无肉病无药"，讲得越多，人越虚；
   讲不动的时候只能先去灶前煨一锅芋 —— 这是全游戏唯一一处**关卡之间真的互相喂**。
   另外两条纪律：
   1) 这一章**一张捷径牌都没有**。他已经没有东西可以透支给下一章了。
   2) 姜唐佐「开海南科举之先」系后世方志追述，部分【传说】，台词里不许当正史说。 */
CHAPTERS.danzhou = {
  chapter: {
    name: "儋州", shichen: 6, year: "绍圣四年", age: "六十一岁",
    office: "琼州别驾 · 昌化军安置 · 并讲学都无",
    full: "绍圣四年—元符三年（1097—1100）。琼州别驾、昌化军安置 —— 监管最严，不得干预公务；能做的只剩讲学与士人往还。",
    bookHint: "海岛上可考的就这几样 —— 「日食芋饮水」是他自己写的，烹调细节是后人加的",
    hub: "fx2-dan-hub-b2-3.webp", hall: "fx-dan-hall-b-3.webp", stove: "sc-dan-stove2-1.webp",
    street: "fx-dan-b-3.webp", banquet: "fx3-dan-banquet-b-1.webp", end2: "cover-dan-1.webp",
    map: MAPTRIP, chapmap: "map2-dan2-3.webp", plaque: [0.213, 0.285, 0.055, 0.195], tiepaper: TIEPAPER,
    note: "绍圣四年二月改琼州别驾、昌化军安置，四月渡海，独苏过随行；元符三年五月大赦北归，六月二十日夜渡海（《六月二十日夜渡海》）。",
    seal: { kind: "si", on: "东坡居士 · 私印", off: "无印 · 只有一张纸", note: "这一章连借都借不到了" }
  },

  lines: {
    arrive: { t: "我本海南民，寄生西蜀州。", src: "《别海南》·元符三年北归作【句有据】；篇名各本不同【存疑】" },
    cold:   { t: "食无肉，病无药，居无所，出无友，冬无炭，夏无寒泉。", src: "《与程秀才书》·儋州作【有据（文）】；篇名一作《与程天侔书》【存疑】" },
    lone:   { t: "心似已灰之木，身如不系之舟。", src: "《自题金山画像》·建中靖国元年（1101）常州作【有据】；跨章借句" },
    rain:   { t: "小舟从此逝，江海寄馀生。", src: "《临江仙·夜饮东坡醒复醉》·黄州作；跨章借句" },
    calm:   { t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年北归渡海作【有据】" },
    pork:   { t: "日食芋饮水。", src: "《居儋录》系后人辑本（辑者与卷次待回校）：所收之文可算【有据（文）】；辑本写成「他就这样过日子」的那一层是今人渲染【传说】" },
    money:  { t: "然亦未易悉数，大率皆无耳。", src: "《与程秀才书》·儋州作【有据（文）】；篇名【存疑】" },
    bone:   { t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。", src: "《食蚝》（又题《海南帖》）·儋州作，写给苏过【有据，《苏轼文集》佚帖】" },
    crossing: { t: "忽然跨海去，譬如事远游。", src: "《别海南》·元符三年北归作【句有据】；篇名【存疑】" },
    teach:  { t: "陋邦空复尔，南海亦何有。", src: "儋州诸诗【句存疑：篇名未回校中华本，暂不入台词，只作占位】" },
    finale: { t: "问汝平生功业，黄州惠州儋州。", src: "《自题金山画像》·建中靖国元年常州作【有据】" }
  },

  // 身体 46 —— 比惠州还低，而且这一章它**只掉不回**，除非去灶前喝那碗芋羹。
  // 神情词表：差分图命名 = 立绘名 + "-" + 神情，如 dpw-1-lei-cut.png
  fx: ["xiao", "leng", "nu", "lei", "si", "ku", "jing", "xi", "bing"],
  heroArt: ["dan-dongpo-1","dan-dongpo-2","danact1-1","danact1-2","danact2-1","danact2-2","danact3-1","danact3-2","danact4-1","danact4-2","danact5-1"],
  bars: { 火候: 20, 银钱: 90, 人情: 40, 物议: -20, 身体: 46 },
  // ── 对话：儋州章插入点 ──────────────────────────────
  // 这一章没有公堂。所有「堂上」的台词都发生在载酒堂，说话的是学生。
  dlg: {
    arrive: [
      { w: "我", p: "dan-dongpo-1", e: "jing", t: "忽然跨海去，譬如事远游。",
        src: "《别海南》·元符三年【句有据】；篇名各本不同【存疑】——渡海那晚他自己都吃惊居然没吐" },
      { w: "我", p: "danact4-1", t: "我本海南民，寄生西蜀州。",
        src: "《别海南》·元符三年北归作【句有据】；篇名各本不同【存疑】" },
      { w: "苏过", p: "hiz-guests-1-p3", t: "爹，船要开了。家里人不让上。",
        src: "拟语·举家离散，独苏过随行渡海【有据，年谱】" }
    ],
    courtOpen: [
      { w: "姜唐佐", p: "dan-tuozuo-1", t: "先生，海南人到底能不能应举？",
        src: "拟语·姜唐佐从轼学【有据（事）】；「开海南科举之先」出后世方志追述【传说】" },
      { w: "我", p: "danact1-1", t: "我不能替你签这个名。我可以教你认字。",
        src: "拟苏轼语·非原文" }
    ],
    courtTeach: [
      { w: "我", p: "danact2-1", t: "君子固穷。这一句你先自己读十遍。",
        src: "《论语·卫灵公》·先生课上说的原话无据，此处只算课程名目【存疑】" }
    ],
    courtWin: [
      { w: "我", p: "danact3-1", t: "九死南荒吾不恨，兹游奇绝冠平生。",
        src: "《六月二十日夜渡海》·元符三年北归渡海作" }
    ],
    courtLose: [
      { w: "我", p: "dan-dongpo-2", e: "ku", t: "大率皆无耳。",
        src: "《与程秀才书》·儋州作【有据（文）】；篇名【存疑】" }
    ],
    stoveFirst: [
      { w: "我", p: "danact1-2", e: "xi", t: "海物惟错，而蟹与蚝为尤。",
        src: "《食蚝》（又题《海南帖》）·儋州作，写给苏过" }
    ],
    tieOpen: [
      { w: "我", p: "danact4-2", t: "这一锅不用帖。岛上的东西，煮熟就行。",
        src: "拟苏轼语·非原文" }
    ],
    dishOk: [
      { w: "我", p: "danact5-1", t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。",
        src: "《食蚝》·儋州作" }
    ],
    dishFail: [
      { w: "我", p: "dan-dongpo-2", e: "bing", t: "日食芋饮水。",
        src: "《居儋录》后人辑本所收：文【有据（文）／辑本待回校】；「日食芋饮水」之外的烹调细节是今人渲染【传说】" }
    ],
    seatTake: [
      { w: "姜唐佐", p: "dan-tuozuo-1", t: "先生要走了。我抄的那一页，可以带走么？",
        src: "拟语·唐佐从学【有据（事）】" },
      { w: "苏过", p: "hiz-guests-1-p3", t: "爹，船钱我凑了一半。",
        src: "拟语·苏过侍侧全程【有据，年谱】" },
      { w: "黎家少年", p: "dan-kids-1-p2", t: "堂是我家借先生的。字是先生教我的。谁欠谁，说不清。",
        src: "拟语·载酒堂在黎氏园出后世图经【传说色彩】；此人为无名学童" }
    ],
    banquetOk: [
      { w: "我", p: "danact2-2", t: "我本海南民，寄生西蜀州。",
        src: "《别海南》【句有据】；篇名【存疑】" }
    ],
    banquetFail: [
      { w: "我", p: "dan-dongpo-1", e: "si", t: "心似已灰之木，身如不系之舟。",
        src: "《自题金山画像》·建中靖国元年常州作（跨章借句）" }
    ],
    streetOk: [
      { w: "我", p: "danact3-2", t: "食无肉，病无药，居无所，出无友。",
        src: "《与程秀才书》·儋州作【有据（文）】" }
    ],
    streetMiss: [
      { w: "我", p: "dan-dongpo-2", e: "ku", t: "然亦未易悉数，大率皆无耳。",
        src: "《与程秀才书》·儋州作【有据（文）】" }
    ],
    mailOpen: [
      { w: "我", p: "danact1-1", t: "先寄一声，平安而已。",
        src: "拟苏轼语·非原文" }
    ],
    seal: [
      { w: "我", p: "dan-dongpo-1", e: "xiao", t: "兹游奇绝冠平生。",
        src: "《六月二十日夜渡海》·元符三年" }
    ]
  },

  // ── 堂上：载酒堂问字 ────────────────────────────────
  // mode「问字」＝ 没有 riskMax、没有 yin、没有 ren，只有 sh（耗身体）与 body（须体门槛）。
  // 讲得深的课**必须身体撑得住**：wen1/wen2 要 ≥34，讲到第五六回合就点不动了，
  // 只能退而教「令自读」这种省力的 —— 辩护掉一半，但人还在。
  court: {
    mode: "问字",
    verseWin: "calm", verseLose: "lone",
    rounds: 7, need: 16,
    caseName: "载酒堂 · 问字【堂上非公堂】",
    caseSub: "这一屏不是断案。琼州别驾、昌化军安置，他一个字的公事也签不动 —— 只剩讲学",
    artFb: "pot-4",
    caseRows: [
      ["我的身份", "琼州别驾、昌化军安置。调研档写明：无任何职权，止于讲学与士人往还【有据】"],
      ["这里是谁", "姜唐佐，琼州人，从轼学；后世方志称其开海南科举之先 —— 那句是追述【传说】，课上不许当正史讲"],
      ["能做的事", "识字、讲《论语》、课赋、答他「海南人能不能应举」"],
      ["代价", "牌面上写的不是人情，是身体。六十四岁，海岛，食无肉病无药"],
      ["忌讳", "讲不动就是讲不动。硬讲的下一句是《自题金山画像》"]
    ],
    intentSeq: ["问字", "问经", "问文", "问字", "问仕", "问经", "问文"],
    intentText: {
      "问字": "他问的是：这个字为什么这样写",
      "问经": "他问的是：这一句怎么读",
      "问文": "他问的是：赋怎么破题",
      "问仕": "他问的是：海南人到底能不能应举"
    },
    cards: [
      { id: "zi1", nm: "说文字源", tp: "蒙学", note: "先从「唐佐」两个字讲起", def: 3, sh: -2, body: 0, po: "问字" },
      { id: "wen1", nm: "课赋破题", tp: "课试", note: "一日一课，课到日落", def: 5, sh: -6, body: 34, po: "问文" },
      { id: "jing1", nm: "讲《论语》", tp: "讲经", note: "「君子固穷」那一句", def: 4, sh: -4, body: 26, po: "问经" },
      { id: "shi1", nm: "举先达故事", tp: "答问", note: "说几个南人做到官的", def: 3, sh: -2, body: 0, po: "问仕" },
      { id: "zi2", nm: "令自读", tp: "省力", note: "你自己读十遍，我在旁边坐着", def: 1, sh: 0, body: 0, po: "问字", same: "zi1" },
      { id: "wen2", nm: "课赋润色", tp: "课试", note: "把他的破题改三个字", def: 5, sh: -6, body: 34, po: "问文", same: "wen1" },
      { id: "jing2", nm: "讲《礼记》", tp: "讲经", note: "「大道之行也」", def: 4, sh: -4, body: 26, po: "问经", same: "jing1" },
      { id: "xi", nm: "闲话海外风物", tp: "闲谈", note: "蚝、椰、槟榔，讲他没见过的事", def: 2, sh: 0, body: 0, po: "问仕" },
      { id: "shi2", nm: "戒他勿应试", tp: "答问", note: "「书到今生读已迟」—— 这句是我说的", def: 3, sh: -2, body: 0, po: "问仕", same: "shi1",
        src: "赠姜唐佐语·宋人笔记所载【存疑：确指未核，游戏里当苏轼语说有风险，故只入牌面 note 不入台词】" },
      { id: "ming", nm: "自书一纸送他", tp: "送字", note: "写坏几张纸，算我请", def: 4, sh: -5, body: 30, po: "问字" },
      { id: "yi", nm: "且教认名字", tp: "省力", note: "先教会写自己的名字", def: 2, sh: 0, body: 0, po: "问经" },
      { id: "tan", nm: "坐一日不说", tp: "省力", note: "海风太大，改日再讲", def: 1, sh: 0, body: 0, po: "问文" }
    ],
    rules: {
      head: "这一章没有印、没有人情可借 —— 只剩他自己",
      title: "堂上三句 · 儋州",
      rows: [
        ["一、无职权", "琼州别驾、昌化军安置，监管最严。这一屏的「堂上」是载酒堂的讲堂，不是公堂"],
        ["二、身体是货币", "牌上「身体」那一格是这一课耗掉的体力，「须体」是门槛：身体不够，那张牌直接点不动（角上写「讲不动」）"],
        ["三、讲不动就去煨芋", "灶前那锅芋羹是回身体的。全游戏只有这一章，关卡之间真的互相喂"],
        // "一张 yin / ren 都没有"由 validate_cards 逐章数牌坐实（数错就红），纸上是给玩家看的话
        ["没有捷径", "这一章一张空印、一张借印都没有 —— 他已经没有东西可以透支给下一章了"]
      ]
    },
    pose: { zi1: "danact1-1", zi2: "danact1-1", yi: "danact1-1", tan: "danact1-1",
      jing1: "danact2-1", jing2: "danact2-1", wen1: "danact3-1", wen2: "danact3-1",
      shi1: "danact4-1", shi2: "danact4-1", xi: "danact4-1", ming: "danact2-1" },
    /* 「海南第一个应举的人」是他嘴里说不出的话 —— 唐佐应举与「海南有举人」都是后世方志往前追认的。
       分诊（tools/triage_zhenwei.tsv）判「降」：断言还给史料，人物只说他看得见的那半句。 */
    win: { t: "唐佐回去应举了。海南从前有没有人应过，我不晓得 —— 我教过他认字。", src: "玩家提示语·拟苏轼语；「开海南科举之先」系后世方志追述【传说】，故「第一个」不进人物口吻" }
  },

  // ── 灶前：炙蚝 ──────────────────────────────────────
  // 《食蚝》帖是给苏过的家书口吻，所以这一锅的引文就是那句「恐北方君子闻之」。
  // 关键：**芋羹与尝蚝都回身体** —— 这一章的灶前是讲堂的血包。
  stove: {
    // 火候/咸甜酸油/几拍/该不该切 —— 全在 灶前.js 的 BOOK 里，这里只留故事那一头
    dish: "炙蚝 · 分我此美", got: "炙蚝",
    quote: { t: "海物惟错，而蟹与蚝为尤。", src: "《食蚝》（又题《海南帖》）·儋州作【有据，《苏轼文集》佚帖】" },
  },

  // ── 上街：海南北归之前 ──────────────────────────────
  // 「东坡椰子船」「儋州东坡饼」是今人甜品与特产名，宋人无考 —— 和定州那两摊同一手法。
  street: {
    budget: 90, need: ["生蚝", "芋", "桄榔木"],
    verseFull: "bone", verseMiss: "pork",
    artFb: "pot-4",
    quote: { t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。", src: "《食蚝》·儋州作【有据，《苏轼文集》佚帖】" },
    stalls: [
      { nm: "生蚝", price: 8, art: "dan-hao-1", rq: 3, wy: 2, sh: 2, tag: "有据",
        note: "海物惟错 · 蟹蚝为尤",
        src: "《食蚝》（又题《海南帖》）·儋州作【有据】" },
      { nm: "芋", price: 6, art: "pot-4", rq: 2, wy: 1, sh: 5, tag: "有据",
        note: "日食芋饮水",
        src: "《居儋录》后人辑本所收：文【有据（文）／辑本待回校】；摊上这句「日食芋饮水」是简截说法，细节今人渲染【传说】" },
      { nm: "桄榔木", price: 12, art: "dan-ye-2", rq: 1, wy: 2, sh: 0, tag: "有据",
        note: "不是吃的 · 庵以木名",
        src: "《桄榔庵铭（并叙）》·儋州作【有据（篇名）】" },
      { nm: "沉香", price: 30, art: "dzstone", rq: 3, wy: 3, sh: -1, tag: "有据",
        note: "海南多香 · 一枚当一石米",
        src: "《沉香山子赋》·寄苏辙【有据（篇名）】；是否儋州所作【存疑】" },
      { nm: "槟榔", price: 10, art: "dan-binglang-1", rq: 2, wy: 1, sh: -2, tag: "存疑",
        note: "黎地常啖 · 我集中未核到此句" },
      { nm: "东坡椰子船", price: 40, art: "dan-ye-1", rq: -6, wy: -4, sh: -2, tag: "传说",
        note: "今人甜品 · 宋人无考 · 不入册" },
      { nm: "儋州东坡饼", price: 35, art: "dish-rou-1", rq: -6, wy: -5, sh: -1, tag: "传说",
        note: "特产名今有 · 宋人无考 · 不入册" }
    ]
  },

  // ── 席间：载酒堂夜话 ────────────────────────────────
  // 姜唐佐从游【有据（事）】；「开海南科举之先」是后世方志追述【传说】，
  // 所以他的 say 里只说「他从广州来学」，不说「他是海南第一个举人」。
  banquet: {
    rounds: 6, need: 4,
    place: "载酒堂 · 夜话",
    artFb: "pot-4",
    quote: { t: "我本海南民，寄生西蜀州。", src: "《别海南》·元符三年北归作【句有据】；篇名各本不同【存疑】" },
    guests: [
      { id: "jiang", nm: "姜唐佐", art: "dan-tuozuo-1", want: "典", joy: 0,
        say: "他从琼州来学。他走的时候我把一纸字塞给他。",
        src: "姜唐佐从轼学【有据（事）】；「开海南科举之先」出后世方志追述【传说】" ,
        hit: { t: "先生这一句，我抄带走。", src: "拟语·姜唐佐从轼学【有据（事）】" },
        miss: { t: "某愚。请先生再说一遍。", src: "拟语" }},
      { id: "guo", nm: "苏过", art: "hiz-guests-1-p3", want: "情", joy: 0,
        say: "父子相对如两翁。举家离散，只有这一个跟我渡的海。",
        src: "苏过独随惠、儋二贬【有据，年谱】；「父子相对如两翁」语出苏轼诗【句存疑：篇名未回校】" ,
        hit: { t: "爹，海南的蚝，儿子替您壳都撬好了。", src: "拟语·独随渡海【有据】" },
        miss: { t: "爹，您手抖了。", src: "拟语·消渴疾晚年【有据（病）】" }},
      { id: "li", nm: "黎家少年", art: "dan-kids-1-p2", want: "趣", joy: 0,
        say: "堂是人家借我的，字是他教我认的 —— 谁教谁，说不清。",
        src: "载酒堂在黎氏园，后世图经所记【传说色彩】；此人为无名学童，白话是拟的，不冒充苏轼语",
        hit: { t: "字我认得了。先生的字我也认得了。", src: "拟语·无名学童" },
        miss: { t: "风大。听不清。", src: "拟语·无名学童" }}
    ],
    dishes: [
      { nm: "炙蚝", art: "dan-hao-1", wei: 4, dian: 1, qu: 2, qing: 1, uses: 2 },
      { nm: "生蚝", art: "dan-hao-1", wei: 3, dian: 1, qu: 3, qing: 0, uses: 2 },
      { nm: "芋羹", art: "pot-4", wei: 2, dian: 2, qu: 1, qing: 3, uses: 2 },
      { nm: "椰酒", art: "dan-ye-1", wei: 3, dian: 1, qu: 2, qing: 2, uses: 2 },
      { nm: "槟榔", art: "dan-binglang-1", wei: 1, dian: 2, qu: 4, qing: 1, uses: 2 },
      { nm: "论语一册", art: "ui-paper-1", wei: 0, dian: 4, qu: 2, qing: 2, uses: 2 },
      { nm: "诗一首", art: "ui-paper-2", wei: 0, dian: 3, qu: 3, qing: 3, uses: 2 },
      // 同雪浪石：那是香不是菜，席上摆它，食单上不列它
      { nm: "沉香山子", art: "dzstone", wei: 0, dian: 4, qu: 3, qing: 1, uses: 1, noBook: 1 }
    ],
    dimKey: { 味: "wei", 典: "dian", 趣: "qu", 情: "qing" },
    verseK: "crossing"
  },

  // ── 信：最后一批 ────────────────────────────────────
  // 四封收齐三条线：弟（生死别前最后会见）· 子（迈/迨终于来迎）· 政敌（章惇复书道歉）· 话本层。
  // 章惇正史层**始终不露面**，只有一封信 —— 这是当初定的那把刀。
  letters: [
    {
      id: "you", when: 1, from: "苏辙", who: "子由 · 弟", layer: "正史",
      paper: "ui-paper-2",
      body: "你在雷州，我在藤州，中间隔着一条水。我们在合浦碰见了 —— 这一面之后，再没有见过。",
      src: "【有据】元符三年南迁北归途中兄弟相会，是生死别前最后会见（调研档）",
      ask: "他其实是在问：哥哥，你还认得回家的路么",
      tone: { 灰: 3, 旷: 2, 壮: 1 },
      replies: [
        { k: "灰", t: "心似已灰之木，身如不系之舟。", src: "《自题金山画像》·建中靖国元年常州作【有据】" },
        { k: "壮", t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年【有据】" },
        { k: "旷", t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语·黄州作" }
      ]
    },
    {
      id: "guo", when: 3, from: "苏过", who: "叔党 · 幼子", layer: "正史",
      paper: "ui-paper-2",
      body: "你说蚝好吃，叫我别告诉北方人。我偏要告诉所有人 —— 这一帖是你写给我的。",
      src: "《食蚝》（又题《海南帖》）·儋州作，家书口吻，写给苏过【有据，《苏轼文集》佚帖】",
      ask: "他其实是在问：爹，我把你留下的字收好了，你看见没有",
      tone: { 旷: 3, 壮: 2, 灰: 1 },
      replies: [
        { k: "旷", t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。", src: "《食蚝》·儋州作【有据】" },
        { k: "壮", t: "会挽雕弓如满月，西北望，射天狼。", src: "《江城子·密州出猎》·密州期" },
        { k: "灰", t: "也拟哭途穷，死灰吹不起。", src: "《寒食雨二首》其二·黄州作" }
      ]
    },
    {
      id: "zhang", when: 5, from: "章惇", who: "子厚 · 当年同榜", layer: "正史",
      paper: "ui-paper-1",
      body: "你在海南北归，居然先写了一封信给他。他复书道歉。—— 把你贬到海南的那个人。",
      src: "【有据】轼海南北归后与章惇通问，惇复书道歉（《与章子厚书》往返）。至于「子瞻尚敢如此」那句 —— 出宋人笔记，确指【存疑】，所以这一屏不引",
      ask: "这一封最难回：他先低了头，而你已经没有力气生气了",
      tone: { 旷: 3, 灰: 2, 壮: 2 },
      replies: [
        { k: "旷", t: "回首向来萧瑟处，归去，也无风雨也无晴。", src: "《定风波》·黄州作" },
        { k: "壮", t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年【有据】" },
        { k: "灰", t: "人间如梦，一尊还酹江月。", src: "《念奴娇·赤壁怀古》·黄州作" }
      ]
    },
    {
      id: "hua", when: 4, from: "东坡在海南", who: "明清说书 · 话本层", layer: "传说",
      paper: "huaben-1",
      body: "说书人说：你在儋州造墨、教黎人酿酒、日啖荔枝三百颗、又与佛印隔海斗机锋，最后乘大鹤而去。—— 六如亭是后人因墓志「六如偈」追筑的，亭联出明清。",
      src: "三条分别标，不互相借光：①《居儋录》烹调细节＝后人辑本＋今人渲染【传说】；②佛印机锋＝明清话本（《醒世恒言》一路），正史无其判牍与斗法【传说】；③朝云「六如」出轼自撰墓志铭【有据】，六如亭与亭联【传说】",
      ask: "这一关是后人编的：进去就知道不是正史",
      tone: { 旷: 3, 壮: 2, 灰: 2 },
      replies: [
        { k: "旷", t: "也无风雨也无晴。", src: "《定风波》·黄州作" },
        { k: "灰", t: "与谁同坐，明月清风我。", src: "《点绛唇》·一说非黄州" },
        { k: "壮", t: "老夫聊发少年狂。", src: "《江城子·密州出猎》·密州期" }
      ]
    },
    /* ── 分支两封：最后一章的两种收法 ────────────────────
       章惇那一封回得动（壮／旷）→ 姜唐佐来受业，海南第一次有人问书该怎么读；
       回得灰（灰）→ 北边来的不是信，是讣：秦观卒于元符元年八月藤州。
       讣这一封**故意不给脸**（`LETTER_FACE` 里没有它）：墙上只挂一块名牌，
       因为这个人不会再寄信来了 —— 挂上他的脸，就等于骗玩家说他还在写。
       它同时收掉黄州第一封的那个 ask：「你还笑得出来吗」从此再没有人问。 */
    {
      id: "tang", when: 6, from: "姜唐佐", who: "从学者 · 儋州人", layer: "正史",
      after: { id: "zhang", k: ["壮", "旷"] },
      body: "先生居儋，学者争至。唐佐不才，愿受业于门。先生所著书，得尽见之乎？",
      src: "姜唐佐，儋州人，从苏轼学，轼赠诗及扇【有据】；「海南举人自唐佐始」之说出方志【存疑，未取】。书辞拟",
      ask: "他要的不是学问：这里第一次有人来问书该怎么读",
      tone: { 旷: 3, 壮: 2, 灰: 1 },
      replies: [
        { k: "旷", t: "我本海南民，寄生西蜀州。", src: "《别海南》·元符三年北归作" },
        { k: "壮", t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年北归渡海作" },
        { k: "灰", t: "心似已灰之木，身如不系之舟。", src: "《自题金山画像》·建中靖国元年常州作；跨章借句" }
      ]
    },
    {
      id: "qinfuneral", when: 6, from: "讣自北方", who: "秦观 · 元符三年八月卒于藤州", layer: "正史",
      after: { id: "zhang", k: "灰" },
      body: "少游以元符三年八月卒于藤州，年五十二。讣自北来。",
      src: "秦观卒于元符三年（1100）八月藤州，年五十二（虚岁）【有据，调研档《后半生年表与食单》：\"秦观1100卒于藤州\"】；同档又记\"轼北归后祭之\"→ 讣至之时苏轼正在儋州北归前后，闻讣是否有书、其文今存否未回校中华本【存疑】，故只讣其年月，不代拟祭文。⚠ 元符元年（1098）／年四十九是这一处的旧错，两处都已改（审计 P1-7①）",
      ask: "黄州那一封问你「你还笑得出来吗」—— 从此再没有人问了",
      tone: { 灰: 3, 逃: 2, 旷: 1 },
      replies: [
        { k: "灰", t: "也拟哭途穷，死灰吹不起。", src: "《寒食雨二首》其二·黄州作；跨章借句" },
        { k: "逃", t: "小舟从此逝，江海寄馀生。", src: "《临江仙·夜饮东坡醒复醉》·黄州作；跨章借句" },
        { k: "旷", t: "此心安处是吾乡。", src: "《定风波》小序，托歌者柔奴语；跨章借句" }
      ]
    }
  ],

  letterDims: { key: "气", title: "补一句 · 回哪一句都算回过 —— 这是最后一章，没有人再替你转交了" },

  book: {
    dishes: ["炙蚝", "生蚝", "芋", "芋羹", "椰酒", "槟榔", "诗一首", "桄榔木", "沉香", "论语一册", "东坡椰子船", "儋州东坡饼"],
    verses: ["arrive", "calm", "lone", "bone", "crossing", "pork"]
  },


  asides: [
    { t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。", src: "《食蚝》（又题《海南帖》）·儋州作【有据】",
      hint: "他写给儿子的家书，结尾是「别告诉北方人」" },
    { t: "食无肉，病无药，居无所，出无友，冬无炭，夏无寒泉。", src: "《与程秀才书》·儋州作【有据（文）】；篇名【存疑】",
      hint: "六个「无」说完，他自己接一句「大率皆无耳」" },
    { t: "忽然跨海去，譬如事远游。", src: "《别海南》·元符三年北归作【句有据】；篇名各本不同【存疑】",
      hint: "把渡海说成出门远游 —— 他说得出这种话" },
    { t: "说公在儋州造墨，教黎人酿酒，又与佛印隔海斗机锋。", src: "两条分别标：《居儋录》＝后人辑本、细节今人渲染【传说】；佛印机锋＝明清话本【传说】",
      lie: true, hint: "说书人的句子。海岛之上，没人替你查证" }
  ],
  achv: [
    { k: "taught", t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年北归作【有据】" },
    { k: "dish", t: "恐北方君子闻之，争欲为东坡所为，求谪海南，分我此美也。", src: "《食蚝》（又题《海南帖》）·儋州作【有据】" },
    { k: "frail", t: "食无肉，病无药，居无所，出无友。", src: "《与程秀才书》·儋州作【有据（文）】；篇名【存疑】" },
    { k: "letter", t: "忽然跨海去，譬如事远游。", src: "《别海南》·元符三年作【句有据】；篇名【存疑】" },
    { k: "hushAll", t: "心似已灰之木，身如不系之舟。", src: "《自题金山画像》·建中靖国元年常州作【有据】" },
    { k: "saidLie", t: "大率皆无耳。", src: "《与程秀才书》·儋州作【有据（文）】—— 说书人编的那些，他一律认了「皆无」" },
    { k: "poor", t: "俸入不继，人口不少。", src: "【存疑】语意出黄州《答秦太虚书》「廪入既绝，人口不少」，儋州借作占位，未回校前不入台词" }
  ],
};

// 行旅路线：章与章的次序。空印在这里跨章兑现。
var JOURNEY = [
  { key: "huangzhou", nm: "黄州", age: "四十五—四十九", yr: "元丰三年—元丰七年", on: true },
  // hop ＝「走到这一站的那一程」：章末按「下一程」先进这一屏，小人挪一步、烧的是真天数。
  // 每一句都是**这一程真作过的诗**（已核到篇名），不是给风景配的旁白。
  { key: "dingzhou", nm: "定州", age: "五十七—五十八", yr: "元祐八年—绍圣元年", on: true,
    hop: { bg: "road-dz-snow-1.webp", qb: "图标/qb-dp57.png",
      out: "元祐八年九月十四日出都", to: "十二月二十三日方到任",
      t: "今年中山去，白首归无期。", src: "《东府雨中别子由》·元祐八年出都作【有据】" } },
  { key: "huizhou", nm: "惠州", age: "五十八—六十一", yr: "绍圣元年—绍圣四年", on: true,
    hop: { bg: "road-hiz-water-1.webp", qb: "图标/qb-dp58.png",
      out: "绍圣元年南行，过梅关", to: "十月抵惠州",   // 「闰二月」是旧错：闰四月才落职，月份不可能在前；过岭月份调研档无据，故不写
      t: "浩然天地间，惟我独也正。", src: "《过大庾岭》·绍圣元年过岭作【有据】" } },
  { key: "danzhou", nm: "儋州", age: "六十一—六十四", yr: "绍圣四年—元符三年", on: true,
    hop: { bg: "road-dan-sea-1.webp", qb: "图标/qb-dp62.png",
      out: "绍圣四年六月渡海", to: "七月至昌化军",
      t: "九死南荒吾不恨，兹游奇绝冠平生。", src: "《六月二十日夜渡海》·元符三年北归渡海作【有据】" } }
];

var CHAPTER_KEY = "huangzhou";
var DATA = CHAPTERS[CHAPTER_KEY];
function useChapter(k) {
  if (!CHAPTERS[k]) return false;
  CHAPTER_KEY = k; DATA = CHAPTERS[k];
  return true;
}

