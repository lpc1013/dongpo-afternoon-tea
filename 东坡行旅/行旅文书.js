/* 东坡行旅 · 书信、册子、成就、章末与舆图（narrative + ui）
   收信回信、信墙、食单与清欢册、成就墙、章末盖印、行旅路线、路上那一屏、规则与案情、
   声设置弹层、制作与授权。 */
"use strict";
  // ── 信：收信与回信 ──────────────────────────────────
  /* 分支：一封信可以写 `after:{id,k}` —— **上一封回了哪一句，这一封才寄得到你手上**。
     `k` 可以给一个数组（「旷」与「逃」都算"还笑得出来"）。
     条件没满足的信在信墙上**根本不出现**：没走的那条路，玩家不该知道有这条路。
     所以门槛落在"收得到吗"这一层（pending／信墙／计数三处同一个函数），
     不是落在画墙上 —— 画墙那一层各挑各的，三处迟早会漂。 */
  function mailOpen(L) {
    var a = L.after; if (!a) return true;
    var got = S.replied[a.id]; if (!got) return false;
    var ks = a.k instanceof Array ? a.k : [a.k];
    return ks.indexOf(got) >= 0;
  }
  /* 「已回 n / m」的分母只数**这一局走得到的信**：
     用 DATA.letters.length 的话，两条分支永远有一条收不到，玩家会以为漏了一封。 */
  function mailTot() {
    var ls = DATA.letters || [], i, n = 0;
    for (i = 0; i < ls.length; i++) if (mailOpen(ls[i]) || S.replied[ls[i].id]) n++;
    return n;
  }
  function pending() {
    var out = [], i;
    for (i = 0; i < DATA.letters.length; i++)
      if (mailOpen(DATA.letters[i]) && DATA.letters[i].when <= S.shichen && !S.replied[DATA.letters[i].id])
        out.push(DATA.letters[i]);
    return out;
  }
  function letterById(id) {
    var i;
    for (i = 0; i < DATA.letters.length; i++) if (DATA.letters[i].id === id) return DATA.letters[i];
    return null;
  }

  /* 这一处原来是全游戏最脏的一个洞：开场白写成 `say("mailOpen","go/mail")`，
     而 `go` 的分支表里根本没有 mail —— 落进 else 弹回 hub。
     于是真人玩家点来信＝播一遍白 → 回 hub → 再点 → 再播一遍，死循环；
     信屏、回信、`letter` 成就在真人路径下永远到不了，章末还照「四封没回」扣人情。
     demo／验收全走 nodlg，所以一百多屏截图全绿也没人看见（P0-1）。
     现在：开场白每章只播一次，续段走**真存在的** go/mail，并且一进来就把这封记成看到过。 */
  function renderMail(id) {
    var ps = pending(), i, L = id ? letterById(id) : null;
    if (!ps.length && !L) { toast("今日没有待回的信"); return; }
    if (!L) {
      for (i = 0; i < ps.length; i++) if (!S.mailSeen[ps[i].id]) { L = ps[i]; break; }
      L = L || ps[0];
    }
    S.mailSeen[L.id] = 1;
    S.mailTo = L.id;                        // 播完开场白要看的是**这一封**，不是「下一封」
    S.lpage = 0; S.lpicking = false;         // 翻页与"挑一句"是这一屏的临时态，换一封要清
    if (!S.mailAsked) {
      S.mailAsked = true;
      if (say("mailOpen", "go/mail")) return;
    }
    S.screen = "letter";
    renderLetter(L.id);
  }

  /* ── 信墙：一章的信一次摊开 ────────────────────────────
     原来 hub 上那枚「来信」点下去直接进**第一封**，玩家看不见这一章一共几封、谁寄的、
     哪封还没回 —— 「待回 4 封」这个数一直挂在提示牌上，却没有构成。
     左边一列是人（有立绘的挂脸，没有的只挂竖幅名牌，**不拿别人的脸凑**），
     右边是纸：未回的亮着、已回的压暗盖戳、时辰没到的整张压成灰且不出字 ——
     还没寄到的信，不该看得见上面写了什么。 */
  function renderWall() {
    var ls = DATA.letters || [], i, l, st;
    S.screen = "wall";
    set(bg("letter", DATA.chapter.hub || "hubbg2-1.webp"));
    document.getElementById("bg").className = "dimmed";
    var people = [], seen = {};
    for (i = 0; i < ls.length; i++)
      if ((mailOpen(ls[i]) || S.replied[ls[i].id]) && !seen[ls[i].from]) { seen[ls[i].from] = 1; people.push(ls[i]); }
    var paper = LETTER_PAPER[CHAPTER_KEY] || "paper-hz-4.webp";
    var h = '<div class="wallrail">';
    h += '<div class="wper all' + (S.wallBy ? "" : " on") + '" data-act="wallby" data-arg="">' +
      '<div class="pn">全部</div></div>';
    for (i = 0; i < people.length; i++) {
      var face = letterFace(people[i]);
      h += '<div class="wper' + (S.wallBy === people[i].from ? " on" : "") +
        '" data-act="wallby" data-arg="' + people[i].from + '">' +
        (face ? '<img class="pf" src="' + artSrc("立绘/" + face + "-平.png") + '" alt="">' :
                '<div class="pf none"></div>') +
        '<div class="pn">' + people[i].from + "</div></div>";
    }
    h += "</div><div class=\"wallgrid\">";
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      if (!mailOpen(l) && !S.replied[l.id]) continue;     // 这一局收不到的那一条分支，不挂出来
      if (S.wallBy && l.from !== S.wallBy) continue;
      st = S.replied[l.id] ? "done" : (l.when > S.shichen ? "lock" : "new");
      h += '<div class="wcard ' + st + (l.layer === "传说" ? " hb" : "") + '"' + (st === "lock" ? "" :
        ' data-act="openmail" data-arg="' + l.id + '"') +
        ' style="background-image:url(&quot;' + artSrc(l.layer === "传说" ? "huaben-1.webp" : paper) +
        '&quot;)"><div class="wtext">' + (st === "lock" ? "" : l.body) + "</div>" +
        '<div class="wfoot"><span class="wwho">' + l.from + "</span>" +
        (st === "done" ? '<span class="wstamp">已回</span>'
          : st === "new" ? '<span class="wtag">待回</span>' : '<span class="wlock">未到</span>') +
        "</div></div>";
    }
    h += "</div>";
    h += panel({ k: "已回", v: Object.keys(S.replied).length + " / " + mailTot() });
    h += tabs([{ t: "归案", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
  }

  /* 各章一张自己的信纸（`素材/paper-<章>-N.webp`，540×720＝3:4，与纸框同比例所以不拉伸）。
     选哪一张是有理由的：黄州 4 最素、定州 1 冷白合那年冬天的雪、
     惠州 1 角上那块渍最小、儋州 2 竹帘纹与折痕最少 —— 四张都看过联络表才定的。 */
  var LETTER_PAPER = { huangzhou: "paper-hz-4.webp", dingzhou: "paper-dz-1.webp",
    huizhou: "paper-hiz-1.webp", danzhou: "paper-dan-2.webp" };
  function replyOf(L, k) {
    var a = L.replies || [], i;
    for (i = 0; i < a.length; i++) if (a[i].k === k) return a[i];
    return null;
  }
  /* 回一封信要付的账，**只算这一份**：候选卡片上印的那三个数，就是 `reply()` 真会改的那三个数。
     旧的那张竖行候选印的是「气+3」，而 3 是人情的权重、不是气质的增量（气质每次只 +1）——
     两处各写一遍，写的还写错了，这正是"代价写在脸上"最容易被糊弄过去的地方。 */
  function replyCost(L, r) {
    var v = (L.tone || {})[r.k] || 1;
    return { v: v, ren: v * 2, yi: r.k === "灰" ? -1 : r.k === "壮" ? 1 : 0, tone: r.k };
  }
  /* 候选这一层：纸是**他的信**，候选是我替他拿的主意，两件事不该挤在同一张纸上。
     以前三个候选就是三竖行，长在正文左边（用户点的名："回的信不应该直接写在左边"），
     现在另起一层摆在纸右边，每一枚把自己要付的账与出处都印在自己脸上。 */
  function replyStack(L) {
    var d = DATA.letterDims, out = [], i, x, c;
    for (i = 0; i < (L.replies || []).length; i++) {
      x = L.replies[i]; c = replyCost(L, x);
      out.push('<div class="ropt" data-act="reply" data-arg="' + L.id + ":" + i + '">' +
        "<b>" + x.t + "</b>" +
        '<i class="rc">' + d.key + " +1 ｜ 人情 +" + c.ren +
        (c.yi ? " ｜ 物议 " + (c.yi > 0 ? "+" + c.yi : "−" + (-c.yi)) : "") + "</i>" +
        "<em>" + x.src + "</em></div>");
    }
    /* 层头那一行直接用数据里的 `letterDims.title` —— 它本来就是"回哪一句都算回过，
       只是这一章的气质跟着变"这句说明，再补一句同话就成了复读（第一版正犯了这一条）。 */
    return '<div class="rstack"><h3>' + d.title + "</h3>" + out.join("") + "</div>";
  }

  /* ── 一封信：竖排、自右而左、分页是量出来的 ──────────────
     三种状态：读信 → 挑一句（三个候选各占一竖行，写在同一张纸上）→ 已回（落款那一行
     接在正文后面，纸上盖一枚「已回信」）。
     这一屏**不挂匾**：它借的是本章堂前那张图，而那张在 BOARDS 里有匾面，
     挂上去就是两行浅灰的字骑在信纸正文上（9-28 那轮就是这么露馅的）。 */
  function renderLetter(id) {
    var L = letterById(id); if (!L) { S.screen = "hub"; renderHub(); return; }
    // 话本层整屏换成绣像（只有墨色与纸色），一眼就知道是后人编的
    var tale = L.layer === "传说";
    set(tale ? "huaben-1.webp" : bg("letter", DATA.chapter.hub || "hubbg2-1.webp"));
    var picked = S.replied[L.id];
    var paper = tale ? "huaben-1.webp" : (LETTER_PAPER[CHAPTER_KEY] || "paper-hz-4.webp");
    var r = picked ? replyOf(L, picked) : null;
    var h = '<div class="desk"></div>';
    h += '<div class="sheet' + (tale ? " huaben" : "") + '" style="background-image:url(&quot;' +
      artSrc(paper) + '&quot;)"><div class="sframe"></div>';
    h += '<div class="scut"><div class="stext">' +
      '<div class="shd">' + L.from + '<span class="ssub">　' + L.who + " · " + L.layer + "</span></div>" +
      '<div class="sbd">' + L.body + "</div>" +
      '<div class="ssrc">' + L.src + "</div>" +
      '<div class="sask">' + L.ask + "</div>" +
      (r ? '<div class="srep"><i>回</i> ' + r.t + "　" + r.src + "</div>" : "") +
      "</div></div>";
    if (picked) h += '<div class="stamped">已回信</div>';
    h += '<div class="spg pv" data-act="lpage" data-arg="-1">← 上一页</div>' +
      '<div class="spg nx" data-act="lpage" data-arg="1">下一页 →</div>';
    h += "</div>";
    /* 候选另起一层，在纸的右边（见 `replyStack` 上面那段）：它不进 `.stext`，
       所以竖排的信纸从头到尾只有**他写来的那些字**，没有我的选项混在里面。 */
    if (!picked && S.lpicking) h += replyStack(L);
    h += panel({ k: "已回", v: Object.keys(S.replied).length + " / " + mailTot() });
    h += '<div class="intent letter"><div class="in"><b>来信 · ' + L.from + "</b><em>" +
      "回不回都要回：不回的话，人情是要掉的<br>待回 " + pending().length + " 封</em></div></div>";
    h += '<div class="lbtns">' +
      (!picked && !S.lpicking ? '<div class="btn" data-act="pickmail" data-arg="' + L.id +
        '"><div class="in">回信</div></div>' : "") +
      (S.lpicking && !picked ? '<div class="btn" data-act="unpickmail"><div class="in">再斟酌一下</div></div>' : "") +
      (picked && pending().length ? '<div class="btn" data-act="nextmail"><div class="in">下一封</div></div>' : "") +
      '<div class="btn" data-act="wall"><div class="in">信墙</div></div>' +
      "</div>";
    h += tabs([{ t: "搁下", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
    /* 「候选在纸的右边」是玩家点名的改版，这件事不能只靠眼睛看：引擎量一遍钉在 DOM 上 ——
       `data-pick = 枚数/候选左沿比纸右沿出去多少（设计 px）`。
       负数就是还压在信纸上，那种"看起来挪出去了其实叠在正文上"只有量得出来。 */
    var stg = document.getElementById("stage");
    try {
      var rk = document.querySelector("#layer .rstack"),
          sh = document.querySelector("#layer .sheet");
      if (rk && sh && rk.getBoundingClientRect && stg.setAttribute) {
        var sr = stg.getBoundingClientRect(), k = sr.width / 1280 || 1;
        var ra = rk.getBoundingClientRect(), rb = sh.getBoundingClientRect();
        stg.setAttribute("data-pick", (rk.querySelectorAll ? rk.querySelectorAll(".ropt").length : 0) +
          "/" + Math.round((ra.left - rb.right) / k));
      } else if (stg && stg.setAttribute) stg.setAttribute("data-pick", "");
    } catch (e) { }
  }
  /* 翻页：一页装几列要量 —— `.scut` 的宽 ÷ 列距（46px，与 .stext 的 line-height 同一条数）。
     位移 = 页序 × 一页的宽；到头就把「下一页」压成灰的。这一段只在真浏览器里有意义，
     Node 桩里量不到，所以整段包在 try 里静默跳过。 */
  function fitPages() {
    var cut = document.querySelector("#layer .scut");
    if (!cut || !cut.getBoundingClientRect || !cut.clientWidth) return;
    var txt = cut.querySelector ? cut.querySelector(".stext") : null;
    if (!txt) return;
    var box = cut.getBoundingClientRect(), tb = txt.getBoundingClientRect();
    var stg = document.getElementById("stage");
    var ks = stg && stg.getBoundingClientRect ? stg.getBoundingClientRect().width / 1280 : 0;
    /* 信纸是定尺寸的，短信画不满就露出一大片空格线 —— 那正是"读起来像一张表格"的来源
       （用户那句"收到的信太丑了"，量的就是这一块）。所以把**格线窗口收到正文真占掉的那几列**，
       再在纸里居中：纸还是那张纸（不拉伸、比例闸不动），只是不再替空白处画线。
       长信照旧满幅翻页（used ≥ full 时一个像素都不改）。 */
    if (ks > 0.02) {
      var full = Math.floor((box.width / ks) / 46) * 46;
      /* 收的是**正文画到的那一像素**，不是"凑满几列"：儋州那封信正文 276.4 px，
         按 46 一列进位就成了 322 —— 与整幅满窗一样宽，于是"缩"这件事静默不触发，
         纸左边照样露两列空格线（第一版就是这么漏的，只有量出来的数会说出来）。 */
      var used = Math.ceil(tb.width / ks);
      if (used > 46 && used < full) {
        cut.style.width = used + "px";
        cut.style.left = "50%"; cut.style.right = "auto";
        cut.style.transform = "translateX(-50%)";
        box = cut.getBoundingClientRect();
      }
      if (stg.setAttribute)
        stg.setAttribute("data-sheet", Math.round(box.width / ks) + "/" + Math.round(tb.width / ks));
    }
    var step = Math.max(46, Math.floor(box.width / 46) * 46);
    var over = tb.width - box.width;
    var pages = over > 1 ? Math.ceil(over / step) + 1 : 1;
    var p = Math.max(0, Math.min(S.lpage || 0, pages - 1));
    S.lpage = p;
    txt.style.transform = "translateX(" + (p * step) + "px)";
    var q = function (s) { return document.querySelector("#layer " + s); };
    var pv = q(".spg.pv"), nx = q(".spg.nx");
    if (pv) pv.className = "spg pv" + (p > 0 ? "" : " off");
    if (nx) nx.className = "spg nx" + (p < pages - 1 ? "" : " off");
  }
  /* 册子翻页：一页装几行也是量出来的 —— 逐行往下累加，越过窗口底就断在一行的**边界**上，
     绝不拦腰切一行。信纸按列宽量，这里按行高量，同一句话：装得下的才画，装不下的翻一叶看。
     翻出去的那几行是**直接 display:none**，不是把整条往上推 —— 推的话下一叶的头一行
     会有一截下巴露在这一叶的窗口里（第一版就是这么被 `data-fit` 量出来的）。
     翻完把「第几叶／共几叶」与「这一叶画到多高」都钉回 DOM，验收器才量得到翻得动没、切了没。 */
  function fitBookPages() {
    var book = document.querySelector("#layer .book");
    var box = book && book.querySelector ? book.querySelector(".brows") : null;
    if (!box || !box.children || !box.children.length || !box.clientHeight) return;
    var kids = box.children, i;
    // 先全部摆回来再量：藏起来的行 offsetHeight 是 0，拿它断页会把每一页都算成装得下
    for (i = 0; i < kids.length; i++) kids[i].style.display = "";
    var H = box.clientHeight, from = 0, starts = [0];
    for (i = 1; i < kids.length; i++)
      if (kids[i].offsetTop + kids[i].offsetHeight > kids[from].offsetTop + H) { starts.push(i); from = i; }
    var n = starts.length, p = Math.max(0, Math.min(S.bpage || 0, n - 1));
    S.bpage = p;
    var a = starts[p], b = p + 1 < n ? starts[p + 1] : kids.length;
    for (i = 0; i < kids.length; i++) kids[i].style.display = (i >= a && i < b) ? "" : "none";
    book.setAttribute("data-pages", (p + 1) + "/" + n);
    /* 藏过之后重新量：这一叶真正占掉多高（`H/用掉的高`）。用掉的比窗口还高，
       就是"一行比一叶还长"—— 翻页救不了，spill 闸按这个数报红。 */
    box.setAttribute("data-fit", H + "/" + (kids[b - 1].offsetTop + kids[b - 1].offsetHeight - kids[a].offsetTop));
    var pg = book.querySelector(".bpg");
    if (!pg) return;
    pg.style.display = n > 1 ? "" : "none";
    var pv = pg.querySelector(".pv"), nx = pg.querySelector(".nx"), bc = pg.querySelector(".bc");
    if (pv) pv.className = "pv" + (p > 0 ? "" : " off");
    if (nx) nx.className = "nx" + (p < n - 1 ? "" : " off");
    if (bc) bc.textContent = "第 " + (p + 1) + " 叶 · 共 " + n + " 叶";
  }

  function reply(id, idx) {
    var L = letterById(id), r = L.replies[idx];
    if (!r) return;
    sfx("brush");
    var c = replyCost(L, r);
    S.replied[L.id] = r.k;
    S.tone[r.k] = (S.tone[r.k] || 0) + 1;
    S.bars.人情 = clamp(S.bars.人情 + c.ren, 0, 100);
    S.bars.物议 += c.yi;
    S.log.push("回" + L.from + "：" + r.t + "　" + r.src);
    /* 回完**留在这一封上**：纸上落一行「回 …」并盖一枚「已回信」，
       原来这里是直接跳下一封 —— 玩家点完就翻页，自己回了什么根本没看见。
       投递那句话走中上方那条 toast（获得提示同一套反馈），不另起一屏。
       原来 toast 报的是「气 +3」，那个 3 是人情的权重；气质每次只 +1，
       现在 toast 与候选卡、与上面这几行改的数，全部出自 `replyCost()` 一份。 */
    S.lpicking = false; S.lpage = 0;
    toast("信已发出 · " + L.from + " 收 ——" + DATA.letterDims.key + " +1 · 人情 +" + c.ren);
    renderLetter(L.id);
  }

  // ── 册子 ────────────────────────────────────────────
  function renderBook(which) {
    set(bg("hub","sc-hub2-3.webp"));
    var h = "", i, list = [], hint = "";
    if (which === "verses") {
      /* 册子这一屏**也不挂匾**，理由与信屏同一条：它借的是本章堂前的图，匾面 x540..738 / y148..205
         正好在 `.book` 那张纸底下 —— `plate()` 先画、纸后画，于是标题与副题**被自己的纸盖住**，
         玩家一个字都看不见，可 `CUR_BOARD` 照样记成「落进匾里」。那是验收表上的假绿灯。
         所以这两行字改落在纸里（h2 下面一行小字），看得见才算数。 */
      hint = "句子不是奖励，是这一时辰过完剩下的东西";
      /* 「待触发」是一张空头支票：曾经有六行在册上却没有任何一条路能拿到（审计 P2-16）。
         能拿到的照旧写「待触发」；拿不到的明写「这一章没走到」—— 这两个词对玩家完全是两件事：
         一个说"你还没做"，一个说"这局不会有"。措辞不附年代判断（没能回校的都不许断言）。 */
      var later = DATA.book.later || [];
      for (i = 0; i < DATA.book.verses.length; i++) {
        var k = DATA.book.verses[i], L = DATA.lines[k];
        list.push('<div class="row ' + (S.verses[k] ? "got" : "miss") + '"><span>' +
          (S.verses[k] ? L.t : "—— 未得 ——") + "</span><i>" + (S.verses[k] ? L.src
            : (later.indexOf(k) >= 0 ? "这一章没走到" : "待触发")) + "</i></div>");
      }
      // 插一句另起一段：它是他自己岔出去的话，不是关卡奖励
      if (S.quips.length) {
        list.push('<div class="row sub"><span>插一句</span><i>' + S.quips.length + " 则</i></div>");
        for (i = 0; i < S.quips.length; i++)
          list.push('<div class="row got' + (S.quips[i].lie ? " lie" : "") + '"><span>' +
            // 伪作盖一枚裂口朱印：红字容易和「人情」那一色混，印章形状才一眼是分得开的
            (S.quips[i].lie ? '<img class="lieic" src="' + artSrc("图标/ico-wei.png") + '" alt="">' : "") +
            S.quips[i].t +
            "</span><i>" + S.quips[i].src + "</i></div>");
      }
    } else {
      hint = DATA.chapter.name + " · " + DATA.chapter.year + " —— " +
        (DATA.chapter.bookHint || "未得的菜：不必急着写完，贬谪还长");
      var dsrc = DATA.book.dishSrc || {};
      for (i = 0; i < DATA.book.dishes.length; i++) {
        var nm = DATA.book.dishes[i];
        /* 跨章借来的那两味（黄州席上的荔枝与烤蚝）在册子上标出来 ——
           "已尝"是玩家在这一局尝过了，"存疑"是这个名字本章并无出处（审计 P2-13）。 */
        list.push('<div class="row ' + (S.got[nm] ? "got" : "miss") + '"><span>' + nm + "</span><i>" +
          (S.got[nm] ? "已尝" : "未见") + (dsrc[nm] ? " · 存疑" : "") + "</i></div>");
      }
    }
    var n = which === "verses" ? Object.keys(S.verses).length : Object.keys(S.got).length;
    var cap = which === "verses" ? DATA.book.verses.length : DATA.book.dishes.length;
    h += panel({ k: which === "verses" ? "得句" : "食单", v: n + " / " + cap });
    h += '<div class="desk"></div>' + bookPaper(which === "verses" ? "清欢册" : "食单", hint, list,
      S.log.length ? S.log[S.log.length - 1] : "还没有记下的事");
    h += tabs([
      /* 入口放在食单这里，不放今日屏：今日屏那一排木牌已经八格（`hubTabs.length > 7` 那段
         在收间距才塞得下），再加一格就要动整条竖栏的版面。
         而"翻开菜名册 → 去把没写下来的那几味尝定"本来就是同一个动作的两半。 */
      /* 不带 `ic:`：`tabs()` 里有 `ic` 就走"图标 + `.tip`"那一支，而 `.tip` 是
         `opacity:0` 的悬停提示 —— 截图里没有、触屏里没有，第一次玩的人只会看见一只没名字的茶碗。
         本项目明写过"可点东西的效果要写在它脸上，悬停不算"，这一格就跟着「归案」走文字页签。 */
      { t: "尝菜", cls: "t3", act: "go", arg: "taste" },
      { t: "归案", cls: "t4", act: "go", arg: "hub" }]);
    layer(h);
  }

  /* 三屏共用这张定高纸（清欢册／食单、堂上规矩、案情）。行一律先全画进 `.brows`，
     再由 fitBookPages 量出一叶装得下几行 —— 装不下的不是删掉，是翻一叶去看。
     新开一张纸从头一叶起（在纸里翻页是这一屏的临时态，跟信纸的 lpage 同一条规矩）。 */
  function bookPaper(title, sub, rows, foot) {
    S.bpage = 0;
    return '<div class="book"><h2>' + title + "</h2>" + (sub ? '<p class="bsub">' + sub + "</p>" : "") +
      '<div class="brows">' + rows.join("") + "</div>" +
      (foot ? '<div class="foot">' + foot + "</div>" : "") +
      '<div class="bpg"><span class="pv" data-act="bpage" data-arg="-1">← 上一叶</span>' +
      '<span class="bc"></span><span class="nx" data-act="bpage" data-arg="1">下一叶 →</span></div></div>';
  }

  // ── 成就：一律用他自己的原句命名 ────────────────────
  /* 不另造一套「成就名」的词。玩家做到的事，只用他说过的话来回。
     伪作那条（saidLie）故意给一句很美的 —— 因为踩坑的体验就该是「好句子不是他的」。 */
  var ACHV = {
    cook:   function () { return !!S.flags.cook; },
    banquet:function () { return !!S.flags.banquet; },
    dish:   function () { return Object.keys(S.got).length >= DATA.book.dishes.length - lieStalls(); },
    letter: function () { return Object.keys(S.replied).length >= mailTot(); },
    clean:  function () { return S.bars.物议 >= 0; },
    frail:  function () { return S.bars.身体 < 30; },
    poor:   function () { return S.bars.银钱 <= 0; },
    noYin:  function () { return yinMode() && S.kongYin === 0; },
    noBorrow:function(){ return borrowMode() && !S.flags.borrowed; },
    taught: function () { return teachMode() && S.bars.身体 > 0; },
    saidLie:function () { return S.quips.some(function (q) { return q.lie; }); },
    hushAll:function () { return (DATA.asides || []).length > 0 && S.quips.length === 0; }
  };
  function lieStalls() {
    var n = 0, i;
    for (i = 0; i < DATA.street.stalls.length; i++) if (DATA.street.stalls[i].tag === "传说") n++;
    return n;
  }
  function achvRows() {
    var out = [], i, a;
    for (i = 0; i < (DATA.achv || []).length; i++) {
      a = DATA.achv[i];
      var f = ACHV[a.k];
      out.push({ hit: !!(f && f()), t: a.t, src: a.src, k: a.k });
    }
    return out;
  }
  /* 每一枚成就**怎么才能挣到**，只写在这里一份，成就墙读它。
     这一张表是照着上面 `ACHV` 的谓词逐条回读出来的，不是照着诗句猜的 ——
     猜的那一份一定会和判定漂开（`dish` 那条最容易漂：分母要减掉话本那几味）。 */
  var ACHV_HINT = {
    cook:     "灶前把一锅烧成（烧糊了不算）",
    banquet:  "席间把三位客人都陪到尽欢",
    dish:     "本章食单上在册的味全尝到（话本里那几味不算数）",
    letter:   "这一局收得到的信，一封不落都回了",
    clean:    "走到章末，物议没有被扣成负数",
    frail:    "身体掉到 30 以下：这一章熬垮过一次",
    poor:     "银钱见底过一次",
    noYin:    "任上把案子结绝了，一张空印都没留下",
    noBorrow: "一次都没有借别人的名字署名",
    taught:   "课教到散学，人还撑得住",
    saidLie:  "在席间替一句伪作说过话",
    hushAll:  "「插一句」的场合，一次都没有开口"
  };
  /* 某一章的成就清单：本章现算，别章读章末那份快照（`S.seals[k].achvKeys`）。
     快照只在盖章那一次写，所以没走完的章在墙上整组都是灰的 —— 这是实话，不是偷懒。 */
  function achvListOf(ch) {
    var src = (CHAPTERS[ch] && CHAPTERS[ch].achv) || [], i, have = {}, live;
    if (ch === CHAPTER_KEY) {
      live = achvRows();
      for (i = 0; i < live.length; i++) if (live[i].hit) have[live[i].k] = 1;
    } else {
      var ks = (S.seals[ch] || {}).achvKeys;
      for (i = 0; ks && i < ks.length; i++) have[ks[i]] = 1;
    }
    var out = [];
    for (i = 0; i < src.length; i++)
      out.push({ k: src[i].k, t: src[i].t, src: src[i].src, hit: !!have[src[i].k] });
    return out;
  }
  /* ── 成就墙 ──────────────────────────────────────────
     章末那一列只画拿到的（否则结算屏变成一张待办清单），而玩家问的是
     "我到底拿到过什么、还差什么" —— 那需要一面完整的墙。
     所以这一屏反过来排：未得的也占一格，但**只排条件不排句子**。
     那句诗是他挣来的东西，没挣到就不该先看见。 */
  function renderAchv() {
    set(bg("hub", "sc-hub2-3.webp"));
    var rows = [], i, j, ch, list, got = 0, cap = 0, n;
    for (i = 0; i < JOURNEY.length; i++) {
      ch = JOURNEY[i].key;
      list = achvListOf(ch);
      n = 0;
      for (j = 0; j < list.length; j++) if (list[j].hit) n++;
      got += n; cap += list.length;
      rows.push('<div class="agroup"><b>' + JOURNEY[i].nm + "</b><i>" + JOURNEY[i].yr +
        " · 已得 " + n + " / " + list.length + "</i></div>");
      for (j = 0; j < list.length; j++)
        rows.push('<div class="arow ' + (list[j].hit ? "got" : "miss") + '" data-achv="' +
          ch + "/" + list[j].k + "/" + (list[j].hit ? 1 : 0) + '"><b>' +
          (list[j].hit ? list[j].t : "未得 · " + (ACHV_HINT[list[j].k] || "还没有对得上的一句话")) +
          "</b>" + (list[j].hit ? "<em>" + list[j].src + "</em>" : "") + "</div>");
    }
    var h = panel({ k: "成就", v: got + " / " + cap });
    h += bookPaper("成就 · 得句",
      "墙上只印他自己说过的话。没挣到的那一条，句子先不给你看。", rows,
      DATA.lines.arrive.t + "　" + DATA.lines.arrive.src);
    h += backTab();
    layer(h);
  }

  // ── 章末 ────────────────────────────────────────────
  function renderEnd() {
    var endArt = bg("end2", DATA.chapter.hub || "hubbg2-2.webp");
    set(endArt);
    /* 没回的信在这一栏掉人情：他历史上真为「答书不勤」道过歉。
       分母只算**这一局收得到的**（`mailTot()`）—— 接了分支之后用 DATA.letters.length，
       等于因为"没走另一条路"扣玩家的人情，而那一条路他根本不知道存在。
       顺带把扣成一次性的：这一段原来写在 `renderEnd()` 里，而这屏会被重进
       （「再来」／验收路由），扣完没记号，重进一次再扣一遍。 */
    var miss = mailTot() - Object.keys(S.replied).length, i;
    if (miss > 0 && !S.flags.endPen) {
      S.flags.endPen = 1;
      S.bars.人情 = clamp(S.bars.人情 - miss * 6, 0, 100); S.bars.物议 -= miss;
    }
    var tone = "旷", kk, best = -1;
    for (kk in S.tone) if (S.tone[kk] > best) { best = S.tone[kk]; tone = kk; }
    var score = Object.keys(S.got).length * 3 + Object.keys(S.verses).length * 2 +
      Math.round(S.bars.人情 / 10) + best;
    var nx = nextChapter();
    // 印章＝身份：黄州无官印（只有「东坡居士」私印），元祐换官印，绍圣后又掉回私印。
    var sl = DATA.chapter.seal || { on: DATA.chapter.name + " · 印", off: DATA.chapter.name + " · 空印" };
    var got = score >= 12;
    // 记进行旅册子：这是**跨章不清零**的三枚章，终局那一屏要把它们并排盖在一张纸上。
    S.seals[CHAPTER_KEY] = { nm: DATA.chapter.name, t: got ? sl.on : sl.off, got: got,
      score: score, tone: tone, yin: S.kongYin, last: got };
    var h = plate("章末 · " + DATA.chapter.name, DATA.chapter.year + " · " + DATA.chapter.age);
    // 这一章真正留下的东西（定州空印／惠州还的债／其余回信数）写在印下面那段小结里，
    // 木札这一枚给乡望 —— 它是章末唯一要算的数。
    h += panel({ k: "乡望", v: score, cls: got ? "good" : "" });
    h += '<div class="seal' + (SEAL_LT[endArt] ? " lt" : "") + '"><h2>' + (got ? sl.on : sl.off) + "</h2>" +
      '<img src="' + artSrc(sealArt(sl.kind, got)) + '" alt="">' +
      "<p>" + DATA.lines.calm.t + "</p>" +
      '<p class="src">' + DATA.lines.calm.src + "</p>" +
      "<p>交出去：食单 " + Object.keys(S.got).length + " 味 · 清欢册 " +
      Object.keys(S.verses).length + " 句 · 回信 " + Object.keys(S.replied).length + "/" + mailTot() +
      "</p><p>换回来：乡望 " + score + " · " + (got ? sl.on : "一枚空的") + "</p>" +
      '<p class="src">这一章的气质：' + tone + (miss ? "（有 " + miss + " 封没回）" : "") +
      (S.kongYin ? " · 任上空印 " + S.kongYin + " 状" : "") +
      (sl.note ? " · " + sl.note : "") + "</p></div>";
    h += tabs([{ t: "再来", cls: "t1", act: "again" }]);
    // 成就只列拿到的那几条 —— 没拿到的不显示，否则章末变成一张待办清单
    var ar = achvRows(), hit = ar.filter(function (r) { return r.hit; }), i2;
    /* 章末底下这一列**只有四格的位置**（y494 起、每格 54、第四格底 708，再往下就出画）。
       原来那版是「四格画满，第五格放那句"另有 n 句"」—— 第五格在 y702，
       整张卡只有上沿 18 px 落在舞台里，那句话玩家从来没看见过。
       所以超过三条时让出一格给那句汇总，而不是把它顶出画外。
       每格从 52 放到 54：卡换成朱漆框之后高 52（含 10 px 边），52 的间距会贴边。 */
    var show = hit.length > 4 ? 3 : hit.length;
    for (i2 = 0; i2 < show; i2++)
      h += '<div class="achv" style="top:' + (494 + i2 * 54) + 'px"><img class="acic" src="' +
        artSrc("图标/ico-chengjiu.png") + '" alt=""><span class="k">得句</span><b>' +
        hit[i2].t + "</b><em>" + hit[i2].src + "</em></div>";
    if (hit.length > show)
      h += '<div class="achv" style="top:' + (494 + show * 54) + 'px"><img class="acic" src="' +
        artSrc("图标/ico-chengjiu.png") + '" alt=""><span class="k">得句</span><b>' +
        "另有 " + (hit.length - show) + " 句，都在这一章里</b><em>章末只摆得下四格</em></div>";
    S.seals[CHAPTER_KEY].achv = hit.length;
    /* 章名之外还要留下**是哪几条**：成就墙拍别章时只能读这一份快照（那一章的 `S` 早没了）。
       只存条数的话，墙上每一章都只能显示"已得 4 / 6"却不知道得了哪四句。 */
    S.seals[CHAPTER_KEY].achvKeys = hit.map(function (r) { return r.k; });
    h += btn("next", nx ? "下一程 · " + nx.nm : "盖下第三枚章");
    layer(h);
  }

  // ── 行旅：贬谪路线 ──────────────────────────────────
  /* 终局：三枚章并排盖在一张纸上。
     《自题金山画像》只点名三个贬谪地，所以纸上只有黄州·惠州·儋州三枚 ——
     元祐八年那枚真的官印**不在纸上**：他自己没把它算进功业。这一条是全游戏的落点。 */
  function renderFinale() {
    set(bg("end2", "hubbg2-2.webp"));
    var keys = ["huangzhou", "huizhou", "danzhou"], i, k, s;
    var fin = DATA.lines.finale || CHAPTERS.danzhou.lines.finale;
    var n = 0;
    for (i = 0; i < keys.length; i++) if (S.seals[keys[i]] && S.seals[keys[i]].got) n++;
    var h = plate("行旅 · 三印", DATA.lines.finale ? DATA.lines.finale.t : "问汝平生功业，黄州惠州儋州。");
    h += panel({ k: "三印", v: n + " / 3" });
    h += '<div class="finale"><div class="sheet">';
    for (i = 0; i < keys.length; i++) {
      k = keys[i]; s = S.seals[k];
      h += '<div class="stamp' + (s && s.got ? "" : " off") + '">' +
        '<div class="im"><img src="' + artSrc(sealArt(CHAPTERS[k].chapter.seal.kind,
          s && s.got)) + '" alt=""></div>' +
        '<b>' + (s ? s.t : CHAPTERS[k].chapter.name + " · 未走") + "</b>" +
        "<i>" + CHAPTERS[k].chapter.year + " · " + CHAPTERS[k].chapter.age + "</i>" +
        "<em>" + CHAPTERS[k].lines.calm.t + "</em>" +
        '<span class="src">' + CHAPTERS[k].lines.calm.src + "</span></div>";
    }
    h += '<div class="stamp guanyin"><div class="im"><img src="' +
      artSrc(SEAL_ART.guan) + '" alt=""></div>' +
      "<b>定州 · 官印</b><i>元祐八年 · 五十七岁</i>" +
      "<em>这一枚是真的。它没有上这张纸 —— 他把河北那两年自己划掉了。</em>" +
      '<span class="src">《自题金山画像》只数黄州、惠州、儋州</span></div>';
    h += '</div><div class="verse"><b>' + fin.t + "</b><em>" + fin.src +
      "</em><em>建中靖国元年（1101）七月二十八日，卒于常州。" +
      "「问汝平生功业」是他自己问的，三个地名也是他自己答的。</em></div></div>";
    /* 通关不是没收玩家：三枚章盖完，儋州那六格时辰重新给他 ——
       食单没集齐的、信没回的、成就差的那几句，都还在城里。想收尾随时再盖一次章。
       act("free") 就是"回到今日屏 + 时辰清零"，不加任何新状态：存档里它本来就是
       「儋州章、时辰用尽」之外多出来的一局，loadGame 天然认得。 */
    h += tabs([{ t: "行旅图", cls: "t4", act: "go", arg: "map" },
               { t: "回儋州", cls: "t3", act: "free" },
               { t: "制作", cls: "t4", act: "credit" }]);
    h += btn("again", "再走一遍");
    layer(h);
  }

  function nextChapter() {
    for (var i = 0; i < JOURNEY.length; i++)
      if (JOURNEY[i].key === CHAPTER_KEY) return JOURNEY[i + 1] || null;
    return null;
  }

  // ── 行旅：下一程（路上那一屏）────────────────────────
  /* 从前盖完章直接跳书，「贬谪」两个字就只剩一个地名列表。
     现在中间插一屏：小人自己挪一步、那一程真作过的诗摊在桌上、年月写在旁边 ——
     烧的是真天数，不是过场动画。验收那一条路（nodlg／demo）自动跳过，不挡截图。 */
  function renderTravel() {
    var nx = nextChapter(), hop = nx && nx.hop;
    if (!hop) { goChapter(); return; }
    set(hop.bg);
    sfx("step");
    var h = plate("行旅 · " + DATA.chapter.name + " → " + nx.nm, hop.out + "　·　" + hop.to);
    h += '<div class="trel"><img src="' + artSrc(hop.qb) + '" alt=""></div>';
    // 匾的副行已经写了出都与到任，匾下这块就不再复述一遍年月：
    // 复述会把句子挤到第三行，那块 intent 只有两行的位置。
    h += '<div class="intent street"><div class="in"><b>' + nbUnits(hop.t, "，", 11) + "</b><em>" + hop.src +
      "</em></div></div>";
    // 钮上不带地名：目的地在标题里，label 一长就顶出那颗钮的固定宽度（截图里被切过）
    h += btn("gochap", "继续上路");
    layer(h);
  }
  /* 换章**不写 URL**（审计 10-13 A02）：以前这一行把 #dingzhou 写进地址栏，
     而启动时「任何非空 hash 都算验收路由」，于是玩家按 F5 等于自己把自己
     送进验收跑法 —— 本章进度回到开局那一格，自动存档还被合上。
     验收路由照旧走 hash（那是截图的入口），玩家那一路什么都不写。 */
  function goChapter() {
    var nx = nextChapter();
    if (!nx || !nx.on) { S.screen = "map"; renderMap(); return; }
    if (switchChapter(nx.key)) renderHub();
  }
  function renderMap() {
    set(bg("hub", "sc-hub2-3.webp"));
    var face = S.mapFace === "chap" ? "chap" : "trip";
    var openN = 0, sealN = 0, i2;
    for (i2 = 0; i2 < JOURNEY.length; i2++) {
      if (JOURNEY[i2].on && CHAPTERS[JOURNEY[i2].key]) openN++;
      if (S.seals[JOURNEY[i2].key] && S.seals[JOURNEY[i2].key].got) sealN++;
    }
    /* 这一屏有两面。**全行旅**画的是整条贬谪路线（四枚图钉压在四个小景上），
       **本章图**画的是这一任所在的那一处地方 —— 画里留了一块完全空白的素木牌，
       州名由 HTML 叠上去（即梦写不出可靠汉字），牌位坐标是人工逐格读的。
       两面共用同一个 `.route` 框，所以叠字与几何只有一套说法。 */
    if (face === "chap") {
      var cq = DATA.chapter.plaque || [0.20, 0.30, 0.05, 0.20];
      var h0 = plate("舆图 · " + DATA.chapter.name,
        DATA.chapter.year + " · " + (DATA.chapter.office || ""), 1);
      h0 += panel({ k: "已盖", v: sealN + " / " + openN });
      h0 += '<div class="route" style="background-image:url(&quot;' +
        artSrc(bg("chapmap", MAPTRIP)) + '&quot;)">' +
        '<div class="plaque" style="left:' + (cq[0] * 100).toFixed(2) + "%;top:" + (cq[1] * 100).toFixed(2) +
        "%;width:" + (cq[2] * 100).toFixed(2) + "%;height:" + (cq[3] * 100).toFixed(2) +
        '"><h1>' + DATA.chapter.name + "</h1></div></div>";
      layer(h0 + mapTabs(face, sealN));
      return;
    }
    // 图钉按 `maptrip-1` 画里四座小景的实际位置标定（9-30 重画那张 16:9 之后，
    // 拿 10% 网格压在 1080×608 的原件上**一格一格读出来的**，不是估的）
    var pts = [[26, 62], [44, 26], [74, 58], [48, 85]];
    // 标题走横带（第三个参数），不写进被地图盖住的那块匾
    var h = plate("行旅 · 黄州 → 定州 → 惠州 → 儋州", "四十五岁到六十四岁。这一路是贬谪，不是游山", 1);
    /* 原来这里还挂了一张 `.intent.end`（本章的衔与约束 + 一条史注）—— 它和标题是同一个毛病：
       DOM 顺序在 `.route` 前面，被地图整个盖住，一个字都没露过。
       那些内容在**章末**那一屏照旧挂着（那一屏没有地图），所以这里摘掉不是删内容，是不再重复一份看不见的。
       地图框本身不能挪：图钉是按画里那四座小景一格一格读出来的，改了框就改了坐标。
       图也不写死在 CSS 里了 —— 走 `chapter.map`，一个出口（见 行旅.css `.route` 那条注释）。 */
    h += panel({ k: "已盖", v: sealN + " / " + openN });
    h += '<div class="route" style="background-image:url(&quot;' + artSrc(bg("map", MAPTRIP)) + '&quot;)">';
    for (var i = 0; i < JOURNEY.length; i++) {
      var j = JOURNEY[i];
      // 靠画面下沿的那两站，牌子翻到图钉上方，否则顶出地图框
      var dy = pts[i][1] > 68 ? -96 : 20;
      /* 点自己那一枚钉子＝把这一章从头再走一遍（switchChapter 里 reset() 全章归零）。
         原来一按就走，连一句话都不说 —— 时辰、牌、册子当场没了（审计 P2-11／问7①）。
         两步才算确认：第一下只弹话，第二下（同一站、同一屏之内）才真切。 */
      var cur = j.key === CHAPTER_KEY;
      h += '<div class="pin" style="left:' + pts[i][0] + '%;top:' + pts[i][1] + '%"></div>' +
        '<div class="stop' + (cur ? " cur" : "") + (j.on ? "" : " lock") +
        '" style="left:calc(' + pts[i][0] + '% - 95px);top:calc(' + pts[i][1] + '% + ' + dy + 'px)"' +
        ' data-act="' + (j.on ? (cur ? "rechap" : "chap") : "") + '" data-arg="' + j.key + '"><div class="in4"><b>' + j.nm +
        "</b><i>" + j.yr + (S.seals[j.key] ? " · " + S.seals[j.key].t : "") + "</i></div></div>";
    }
    h += "</div>";
    layer(h + mapTabs(face, sealN));
  }
  /* 两面的切换钮与「回衙／三印」并排：切面不改章、不掉时辰，它只是把同一张桌子转个方向。 */
  function mapTabs(face, sealN) {
    var t = [{ t: face === "chap" ? "全行旅" : "本章图", cls: "t4", act: "mapface",
               arg: face === "chap" ? "trip" : "chap" },
             { t: "回衙", cls: "t4", act: "go", arg: "hub" }];
    if (sealN >= 3) t.push({ t: "三印", cls: "t1", act: "go", arg: "finale" });
    return tabs(t);
  }

  // ── 规则 / 案情 ─────────────────────────────────────
  function renderRules() {
    set(bg("hub","sc-hub2-3.webp"));
    var ru = DATA.court.rules, i;
    /* 与册子同一条：`.book` 画在 `plate()` 后面，标题与导语会被自己的纸盖住。
       所以这两行收进纸里（h2 下面一行小字），并且这一屏不再挂匾。 */
    var h = panel({ k: "结绝", v: "需 " + DATA.court.need });
    var rows = [];
    /* 先把"这一局在换什么"排在三条规则前面 —— 口径只有一句，四处共用同一条
       （开场屏 / 这里 / 章末的"交出去·换回来" / EDDICT.core），不各写一份。 */
    rows.push('<div class="row"><span>这一局在换什么</span><i>' + CORE + "</i></div>");
    for (i = 0; i < ru.rows.length; i++)
      rows.push('<div class="row"><span>' + ru.rows[i][0] + "</span><i>" + ru.rows[i][1] + "</i></div>");
    /* 右栏那五枚木札的解释也在这里落一份：悬浮在触屏与录屏里都拿不到，
       而"不知道这些数干嘛用"正是玩家说"不知道在干嘛"的一半。
       文案**直接读 TAG_HINT**，不在这儿另抄一遍 —— 抄的那一份一定会漂。 */
    ["时辰", "银钱", "人情", "身体", "物议"].forEach(function (g) {
      if (TAG_HINT[g])
        rows.push('<div class="row"><span>' + g + "</span><i>" + TAG_HINT[g] + "</i></div>");
    });
    h += bookPaper(ru.title, ru.head, rows,
      DATA.lines.arrive.t + "　" + DATA.lines.arrive.src);
    h += backTab();
    layer(h);
  }

  /* ── 声设置弹层（#章/snd）─────────────────────────────
     沿用规则/成就那条覆盖屏老路：换掉整层、不动 S.screen，backTab 回来源屏。
     控件全部是 div + data-act（与整套 UI 同一宗）：
       · 音量是 10 格刻度条，点第几格就是几格 —— 不引 <input type=range>，
         那玩意儿的原生样式跟这套纸木 UI 打架，而且无头截图里量不着。
       · 每一格都把当前值写在脸上（亮了几格），「能点的东西，效果写在它脸上」。
     改动经 sndKey 落 SND → applyVolumes 当场听见 → sndSave 记档 → 重画本屏。 */
  function sndKey(arg) {
    var p = (arg || "").split(":"), k = p[0], v = parseInt(p[1], 10);
    if (k === "mus" || k === "sfx") {
      if (!(v >= 0 && v <= 10)) v = 0;
      SND[k] = v;
    }
    else if (k === "musOn") SND.musOn = v ? 1 : 0;
    else if (k === "sfxOn") SND.sfxOn = v ? 1 : 0;
    else if (k === "mute") SND.mute = v ? 1 : 0;
    else return;
    applyVolumes();
    sndSave();
    if (SND_OPEN) renderSnd();
  }
  function sndTicks(k, n) {
    var s = "", i;
    for (i = 1; i <= 10; i++)
      s += '<i class="tick' + (i <= n ? " on" : "") + '" data-act="sndk" data-arg="' + k + ":" + i + '"></i>';
    return s;
  }
  function sndRow(name, k, on) {
    return '<div class="row"><span>' + name + "</span><i>" +
      '<b class="sndtg' + (on ? "" : " off") + '" data-act="sndk" data-arg="' + k + "On:" + (on ? "0" : "1") + '">' +
      (on ? "开" : "关") + "</b>" +
      '<span class="ticks">' + sndTicks(k, SND[k]) + '<em class="tickv">' + SND[k] + "</em></span></i></div>";
  }
  function renderSnd() {
    set(bg("hub", "sc-hub2-3.webp"));
    var rows = [];
    rows.push('<div class="row"><span>全部静音</span><i>' +
      '<b class="sndtg big' + (SND.mute ? " off" : "") + '" data-act="sndk" data-arg="mute:' + (SND.mute ? "0" : "1") + '">' +
      (SND.mute ? "已静音 · 点此开声" : "点此全部静音") + "</b>" +
      "<em class='sndnote'>" + (SND.mute ? "存档与进度不受影响" : "静音会记进档里，重开不再忘") + "</em></i></div>");
    rows.push(sndRow("配乐（曲）", "mus", !!SND.musOn));
    rows.push(sndRow("音效与环境声", "sfx", !!SND.sfxOn));
    var h = bookPaper("声",
      "曲子是铺底，柴火是屋里的事 —— 两轨分开调，静音记进档里。",
      rows, "刻度点第几格就是几格；「关」比 0 格更断然，连点都不响。");
    h += backTab();
    layer(h);
  }

  /* ── 制作与授权（#章/credit）──────────────────────────
     CC-BY 的署名义务以前只活在数据表注释里，玩家一个字也看不见 —— 这是欠账。
     这一屏把账还上：音效与配乐两栏**自动从 SFX/MUS 表的 lic 字段生成**，
     表里加一支、这屏就多一行，不许两处各抄一份（抄的那份一定会漂，check_lic 盯着）。
     入口两处：封面按钮、终局页签；都是覆盖屏，backTab 回来源屏。 */
  function creditRows() {
    var rows = [], i, d;
    rows.push('<div class="arow"><b>文本</b><em>引文与史实以苏轼诗文、宋人记载为准，逐条标【有据】【传说】【存疑】三档；' +
      "标着「传说」的（如「一树梨花压海棠」）在游戏里就是传言，不当真话讲。</em></div>");
    rows.push('<div class="arow"><b>美术</b><em>场景、立绘与卡面由 AI 产图（即梦）生成、项目内加工；' +
      "界面汉字为字体排印，不设美术字。</em></div>");
    rows.push('<div class="arow"><b>引擎</b><em>原生 HTML／JS／CSS，无框架无构建；验收链跑在无头浏览器上。</em></div>');
    rows.push('<div class="row hd"><span>音效 · ' + SFX.length + " 支</span><i>每一行都是游戏里真的会响的东西；出处与授权如下。</i></div>");
    /* 名目与授权**堆着排**（.arow：b 一行、em 一行），不走 .row 的两列 ——
       .row 的名目列 nowrap，`出一张牌（堂上质证／灶前手法／席间上菜共用一声）` 这一档长度的
       名目会把授权列挤成一根一字一行的竖条（实测垂到纸外）。成就墙当年为同一个病发明了 .arow。 */
    for (i = 0; i < SFX.length; i++) {
      d = SFX[i];
      rows.push('<div class="arow"><b>' + d.on + '</b><em class="lic">' + (d.lic || "授权待补") + "</em></div>");
    }
    rows.push('<div class="row hd"><span>配乐 · ' + (typeof MUS !== "undefined" ? MUS.length : 0) + " 支</span><i>封面一曲、四章各一主题、终局一曲；试听台在 音效自检.html。</i></div>");
    if (typeof MUS !== "undefined")
      for (i = 0; i < MUS.length; i++) {
        d = MUS[i];
        rows.push('<div class="arow"><b>' + d.on + '</b><em class="lic">' + (d.lic || "授权待补") + "</em></div>");
      }
    return rows;
  }
  function renderCredit() {
    set(bg("hub", "sc-hub2-3.webp"));
    var h = bookPaper("制作与授权", "署名不是客气话：CC-BY 的每一条都要让玩家看得见。",
      creditRows(), "《东坡行旅》· 元丰三年 — 建中靖国元年 · 一顶东坡巾，一口白砂锅。");
    h += backTab();
    layer(h);
  }

