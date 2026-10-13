/* 东坡行旅 · 声服务（services/audio）
   一个 <audio> 元素池、两轨音量与静音记忆、与环境声分层的 BGM。
   与界面解耦：别的文件只调 sfx()/sfxMusic()/sndKey()，不知道池子怎么排。 */
"use strict";
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

