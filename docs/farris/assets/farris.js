/* ═══════════════════════════════════════════════════════════════════════
   FARRIS — interaction & generated garment artwork
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ─────────────────────────────────────────────────────────────────
     GARMENT ARTWORK — every piece is drawn, not photographed.
     A kaftan/thobe silhouette filled with a dyed gradient, overlaid
     with a woven pattern and hand-drawn gold embroidery bands.
     ───────────────────────────────────────────────────────────────── */

  // Silhouettes on a 300 x 470 stage. Each traces: left shoulder → sleeve →
  // armpit → side seam → hem → back up the right → neckline home.
  var SHAPES = {
    kaftan: { hem: 464, d:
      "M122 72 L34 114 Q18 122 20 150 L26 226 Q28 242 44 238 L88 160 " +
      "L52 452 Q50 464 64 464 L236 464 Q250 464 248 452 L212 160 " +
      "L256 238 Q272 242 274 226 L280 150 Q282 122 266 114 L178 72 " +
      "Q164 98 150 98 Q136 98 122 72 Z" },
    robe: { hem: 464, d:
      "M124 70 L58 106 Q44 116 46 142 L56 232 Q58 248 74 244 L98 168 " +
      "L72 452 Q70 464 84 464 L216 464 Q230 464 228 452 L202 168 " +
      "L226 244 Q242 248 244 232 L254 142 Q256 116 242 106 L176 70 " +
      "Q163 96 150 96 Q137 96 124 70 Z" },
    coat: { hem: 462, d:
      "M118 68 L44 106 Q30 116 32 144 L42 236 Q44 252 62 246 L92 172 " +
      "L84 450 Q83 462 95 462 L205 462 Q217 462 216 450 L208 172 " +
      "L238 246 Q256 252 258 236 L268 144 Q270 116 256 106 L182 68 " +
      "L150 92 Z" },
    tunic: { hem: 416, d:
      "M126 74 L68 106 Q56 116 58 138 L66 202 Q68 216 82 212 L104 156 " +
      "L92 404 Q91 416 102 416 L198 416 Q209 416 208 404 L196 156 " +
      "L218 212 Q232 216 234 202 L242 138 Q244 116 232 106 L174 74 " +
      "Q162 98 150 98 Q138 98 126 74 Z" },
    dress: { hem: 460, d:
      "M130 74 L86 100 Q74 110 78 132 L88 190 Q90 202 102 198 L116 154 " +
      "L78 446 Q76 460 90 460 L210 460 Q224 460 222 446 L184 154 " +
      "L198 198 Q210 202 212 190 L222 132 Q226 110 214 100 L170 74 " +
      "Q160 98 150 98 Q140 98 130 74 Z" }
  };

  // Gold embroidery, positioned against the piece's own hem.
  function embroidery(kind, hem) {
    var g = '<g fill="none" stroke="url(#gGold)" stroke-width="1.5" stroke-linecap="round" opacity=".95">',
        i, x, y, k, d, top = hem - 74, bot = hem - 30;

    if (kind === "placket") {
      g += '<path d="M150 106 V' + (hem - 22) + '"/>';
      for (y = 128; y < hem - 40; y += 36) {
        g += '<path d="M137 ' + y + ' Q150 ' + (y + 13) + ' 163 ' + y + '"/>' +
             '<circle cx="150" cy="' + (y + 19) + '" r="2.5" fill="url(#gGold)" stroke="none"/>';
      }
    } else if (kind === "lotus") {
      g += '<path d="M100 ' + top + ' H200"/><path d="M100 ' + bot + ' H200"/>';
      for (x = 110; x <= 190; x += 20) {
        g += '<path d="M' + x + ' ' + (bot - 4) + ' C' + (x - 8) + ' ' + (bot - 12) +
             ' ' + (x - 8) + ' ' + (top + 8) + ' ' + x + ' ' + (top + 4) +
             ' C' + (x + 8) + ' ' + (top + 8) + ' ' + (x + 8) + ' ' + (bot - 12) +
             ' ' + x + ' ' + (bot - 4) + ' Z"/>';
      }
      g += '<path d="M128 96 Q150 122 172 96"/>';
    } else if (kind === "chevron") {
      g += '<path d="M100 ' + top + ' H200"/><path d="M100 ' + bot + ' H200"/>';
      d = "M104 " + (bot - 5);
      for (i = 0; i < 9; i++) d += " L" + (110 + i * 11) + " " + (i % 2 ? bot - 5 : top + 6);
      g += '<path d="' + d + '"/>';
      g += '<path d="M126 94 Q150 118 174 94"/>';
    } else if (kind === "collar") {
      g += '<path d="M116 78 Q150 122 184 78"/><path d="M123 88 Q150 128 177 88"/>' +
           '<path d="M150 128 V' + (hem - 120) + '"/>';
      for (k = 158; k < hem - 130; k += 32) {
        g += '<path d="M140 ' + k + ' L150 ' + (k + 10) + ' L160 ' + k + '"/>';
      }
    } else { // cuffs
      g += '<path d="M28 210 Q44 228 64 224"/><path d="M272 210 Q256 228 236 224"/>' +
           '<path d="M100 ' + (hem - 34) + ' H200"/><path d="M112 ' + (hem - 20) + ' H188"/>' +
           '<path d="M130 96 Q150 118 170 96"/>';
    }
    return g + "</g>";
  }

  function garmentSVG(p) {
    var s = SHAPES[p.shape] || SHAPES.kaftan;
    var d = s.d, hem = s.hem;
    var uid = "c" + Math.random().toString(36).slice(2, 8);
    return '' +
      '<svg class="' + (p.cls || "card__garment") + '" viewBox="0 0 300 480" role="img" aria-label="' +
        p.name + ' — ' + p.fabric + '">' +
        '<defs><clipPath id="' + uid + '"><path d="' + d + '"/></clipPath></defs>' +
        // shadow on the floor
        '<ellipse cx="150" cy="' + (hem + 8) + '" rx="98" ry="11" fill="#000" opacity=".55" filter="url(#fSoft)"/>' +
        // dyed body
        '<path d="' + d + '" fill="url(#' + p.dye + ')"/>' +
        '<g clip-path="url(#' + uid + ')">' +
          '<rect width="300" height="480" fill="url(#' + p.weave + ')" opacity=".8"/>' +
          // drape — blurred so it reads as shading, never as printed stripes
          '<g filter="url(#fDrape)" fill="none" stroke-linecap="round">' +
            '<path d="M112 100 Q104 280 88 460" stroke="#000" stroke-opacity=".3" stroke-width="16"/>' +
            '<path d="M188 100 Q196 280 212 460" stroke="#000" stroke-opacity=".3" stroke-width="16"/>' +
            '<path d="M150 104 Q147 280 142 462" stroke="#fff" stroke-opacity=".16" stroke-width="22"/>' +
            '<path d="M128 112 Q123 292 110 460" stroke="#fff" stroke-opacity=".09" stroke-width="12"/>' +
            '<path d="M172 112 Q177 292 190 460" stroke="#fff" stroke-opacity=".07" stroke-width="10"/>' +
            '<path d="M56 130 Q44 190 40 232" stroke="#000" stroke-opacity=".28" stroke-width="14"/>' +
            '<path d="M244 130 Q256 190 260 232" stroke="#000" stroke-opacity=".28" stroke-width="14"/>' +
          '</g>' +
          '<rect width="300" height="480" fill="url(#gSheen)" opacity=".09"/>' +
        '</g>' +
        '<path d="' + d + '" fill="none" stroke="url(#gGold)" stroke-opacity=".5" stroke-width="1.3"/>' +
        embroidery(p.motif, hem) +
      '</svg>';
  }

  /* ─────────────────────────────────────────────────────────────────
     COLLECTION
     ───────────────────────────────────────────────────────────────── */
  var PIECES = [
    { name:"The Khamseen Kaftan", ar:"قفطان الخماسين", shape:"kaftan", dye:"gLinen", weave:"pRib",
      motif:"placket", tag:"Lot 01", price:"EGP 18,400", halo:"rgba(224,182,97,.22)",
      fabric:"Hand-loomed Giza linen",
      desc:"Wide-sleeved, undyed linen with a gold-couched placket. Cut long enough to catch the wind." },
    { name:"Nile Robe", ar:"عباءة النيل", shape:"robe", dye:"gLapis", weave:"pWater",
      motif:"chevron", tag:"Signature", price:"EGP 24,900", halo:"rgba(47,111,201,.28)",
      fabric:"Indigo-dyed silk twill",
      desc:"Lapis silk with a woven chevron that reads as river light. Twelve in the world this year." },
    { name:"Carnelian Overcoat", ar:"معطف العقيق", shape:"coat", dye:"gCarnelian", weave:"pWeave",
      motif:"collar", tag:"Outerwear", price:"EGP 31,200", halo:"rgba(180,68,47,.26)",
      fabric:"Madder-dyed wool blend",
      desc:"Dyed in the sunken vats. Every coat lands a slightly different red — that is the point." },
    { name:"Faience Tunic", ar:"تونيك الخزف", shape:"tunic", dye:"gFaience", weave:"pLattice",
      motif:"cuffs", tag:"New", price:"EGP 12,600", halo:"rgba(47,191,163,.26)",
      fabric:"Cotton-silk poplin",
      desc:"The blue of the Qena kilns, laid over a scarab lattice. Weightless in August heat." },
    { name:"Lotus Column Dress", ar:"فستان اللوتس", shape:"dress", dye:"gObsidian", weave:"pLotus",
      motif:"lotus", tag:"Evening", price:"EGP 27,800", halo:"rgba(120,130,170,.22)",
      fabric:"Obsidian crêpe de chine",
      desc:"A single unbroken column, hemmed with forty hours of gold lotus by one pair of hands." },
    { name:"Papyrus Shirt", ar:"قميص البردي", shape:"tunic", dye:"gLinen", weave:"pWeave",
      motif:"chevron", tag:"Everyday", price:"EGP 8,900", halo:"rgba(224,182,97,.18)",
      fabric:"Washed Giza 96 cotton",
      desc:"The one you will actually wear to death. Washed four times before it ever reaches you." }
  ];

  var grid = $("#grid");
  if (grid) {
    grid.innerHTML = PIECES.map(function (p, i) {
      return '' +
        '<article class="card reveal" style="--halo:' + p.halo + ';transition-delay:' + (i % 3) * 90 + 'ms">' +
          '<div class="card__stage">' +
            '<span class="card__tag">' + p.tag + '</span>' +
            garmentSVG(p) +
            '<span class="card__ray"></span>' +
          '</div>' +
          '<div class="card__body">' +
            '<span class="card__eyebrow">' + p.fabric + '</span>' +
            '<h3 class="card__name">' + p.name + '</h3>' +
            '<span class="card__ar" lang="ar" dir="rtl">' + p.ar + '</span>' +
            '<p class="card__desc">' + p.desc + '</p>' +
            '<div class="card__foot">' +
              '<span class="card__price">' + p.price + '</span>' +
              '<span class="card__cta">Reserve <b>&rarr;</b></span>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  /* ─────────────────────────────────────────────────────────────────
     LOOKBOOK
     ───────────────────────────────────────────────────────────────── */
  var LOOKS = [
    { name:"Dawn, Saqqara",   place:"Look 01", shape:"kaftan", dye:"gLinen",     weave:"pRib",     motif:"placket", halo:"rgba(224,182,97,.24)" },
    { name:"Felucca, Aswan",  place:"Look 02", shape:"robe",   dye:"gLapis",     weave:"pWater",   motif:"chevron", halo:"rgba(47,111,201,.3)"  },
    { name:"Khan el-Khalili", place:"Look 03", shape:"coat",   dye:"gCarnelian", weave:"pWeave",   motif:"collar",  halo:"rgba(180,68,47,.28)"  },
    { name:"Kilns at Qena",   place:"Look 04", shape:"tunic",  dye:"gFaience",   weave:"pLattice", motif:"cuffs",   halo:"rgba(47,191,163,.28)" },
    { name:"Night, El-Muizz", place:"Look 05", shape:"dress",  dye:"gObsidian",  weave:"pLotus",   motif:"lotus",   halo:"rgba(130,140,180,.24)"},
    { name:"Delta Fields",    place:"Look 06", shape:"tunic",  dye:"gLinen",     weave:"pWeave",   motif:"chevron", halo:"rgba(224,182,97,.2)"  }
  ];

  var lbTrack = $("#lbTrack");
  if (lbTrack) {
    lbTrack.innerHTML = LOOKS.map(function (l, i) {
      l.cls = "figure"; l.name = l.name; l.fabric = l.place;
      return '' +
        '<figure class="look" style="--halo:' + l.halo + '">' +
          '<span class="look__no">' + String(i + 1).padStart(2, "0") + ' / ' + LOOKS.length + '</span>' +
          garmentSVG(l) +
          '<figcaption class="look__label"><h3>' + l.name + '</h3><span>' + l.place + '</span></figcaption>' +
        '</figure>';
    }).join("");
  }

  /* ─────────────────────────────────────────────────────────────────
     LOOM ART — warp/weft threads + stroke lengths for the draw-on
     ───────────────────────────────────────────────────────────────── */
  var warp = $(".loom__warp"), weft = $(".loom__weft");
  if (warp && weft) {
    var w = "", f = "";
    for (var x = 40; x <= 440; x += 10) w += '<line x1="' + x + '" y1="24" x2="' + x + '" y2="536"/>';
    for (var y = 40; y <= 520; y += 22) f += '<line x1="24" y1="' + y + '" x2="456" y2="' + y + '"/>';
    warp.innerHTML = w; weft.innerHTML = f;
  }
  // only feed the measured length to CSS — setting dashoffset inline would
  // out-rank the .in rule that draws the glyph on.
  $$(".loom__glyphs .gd").forEach(function (el) {
    el.style.setProperty("--len", (el.getTotalLength ? el.getTotalLength() : 300) + "");
  });

  /* ─────────────────────────────────────────────────────────────────
     SPLIT HEADLINES — word-by-word mask reveal
     ───────────────────────────────────────────────────────────────── */
  $$(".split").forEach(function (el) {
    var html = el.innerHTML.split(/(<br\s*\/?>)/i).map(function (chunk) {
      if (/^<br/i.test(chunk)) return chunk;
      return chunk.split(/\s+/).filter(Boolean).map(function (word, i) {
        return '<span class="w" style="transition-delay:' + (i * 55) + 'ms"><i>' + word + "</i></span>";
      }).join(" ");
    }).join("");
    el.innerHTML = html;
  });

  /* ─────────────────────────────────────────────────────────────────
     REVEAL ON SCROLL
     ───────────────────────────────────────────────────────────────── */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.hasAttribute("data-count")) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

  $$(".reveal, .split, .step, .story__art, [data-count]").forEach(function (el) { io.observe(el); });

  function countUp(el) {
    if (reduced) { el.textContent = el.getAttribute("data-count"); return; }
    var target = parseInt(el.getAttribute("data-count"), 10), t0 = null;
    (function tick(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ─────────────────────────────────────────────────────────────────
     HERO DUST — drifting gold motes over the desert sky
     ───────────────────────────────────────────────────────────────── */
  var canvas = $("#dust");
  if (canvas && !reduced) {
    var ctx = canvas.getContext("2d"), motes = [], W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2);

    function sizeCanvas() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(W * H / 7000, 190));
      motes = [];
      for (var i = 0; i < count; i++) motes.push(mote(true));
    }
    function mote(seed) {
      return {
        x: Math.random() * W,
        y: seed ? Math.random() * H : H + 12,
        r: Math.random() * 1.9 + 0.35,
        vx: (Math.random() * 0.42 + 0.06),
        vy: -(Math.random() * 0.32 + 0.05),
        a: Math.random() * 0.55 + 0.12,
        ph: Math.random() * Math.PI * 2
      };
    }
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.x += m.vx + Math.sin(t / 2600 + m.ph) * 0.22;
        m.y += m.vy;
        if (m.y < -12 || m.x > W + 12) motes[i] = mote(false);
        var tw = m.a * (0.62 + 0.38 * Math.sin(t / 620 + m.ph));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240,205,140," + tw.toFixed(3) + ")";
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    sizeCanvas();
    addEventListener("resize", sizeCanvas, { passive: true });
    requestAnimationFrame(frame);
  }

  /* ─────────────────────────────────────────────────────────────────
     SCROLL: progress bar, nav state, parallax, rail, lookbook track
     ───────────────────────────────────────────────────────────────── */
  var nav = $("#nav"), fill = $("#scrollFill"), rail = $("#railFill"),
      steps = $(".steps"), lookbook = $(".lookbook"), lastY = 0, ticking = false;

  function onScroll() {
    var y = scrollY, vh = innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    if (fill) fill.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";

    if (nav) {
      nav.classList.toggle("stuck", y > 40);
      nav.classList.toggle("hide", y > lastY && y > 400 && !$("#drawer").classList.contains("open"));
    }
    lastY = y;

    // hero parallax
    if (y < vh * 1.2) {
      $$(".hero__scene .par").forEach(function (g) {
        var d = parseFloat(g.getAttribute("data-depth")) || 6;
        g.style.transform = "translate3d(0," + (-y * d / 100) + "px,0)";
      });
      var hc = $(".hero__content");
      if (hc) {
        hc.style.transform = "translate3d(0," + (y * 0.22) + "px,0)";
        hc.style.opacity = String(Math.max(0, 1 - y / (vh * 0.72)));
      }
    }

    // atelier rail fill
    if (rail && steps) {
      var r = steps.getBoundingClientRect();
      var p = (vh * 0.62 - r.top) / r.height;
      rail.style.height = Math.max(0, Math.min(1, p)) * 100 + "%";
    }

    // lookbook horizontal drive
    if (lbTrack && lookbook) {
      var lr = lookbook.getBoundingClientRect();
      var span = lookbook.offsetHeight - vh;
      var prog = span > 0 ? Math.max(0, Math.min(1, -lr.top / span)) : 0;
      var travel = Math.max(0, lbTrack.scrollWidth - innerWidth + 40);
      lbTrack.style.transform = "translate3d(" + (-prog * travel) + "px,0,0)";
    }

    var hero = $(".hero");
    if (hero) hero.classList.add("in");
  }

  addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  addEventListener("resize", onScroll, { passive: true });

  // give the lookbook enough scroll runway for its horizontal travel
  function sizeLookbook() {
    if (!lookbook || !lbTrack) return;
    var travel = Math.max(0, lbTrack.scrollWidth - innerWidth + 40);
    lookbook.style.height = (innerHeight + travel) + "px";
  }
  addEventListener("resize", sizeLookbook, { passive: true });

  /* ─────────────────────────────────────────────────────────────────
     CURSOR + MAGNETIC BUTTONS
     ───────────────────────────────────────────────────────────────── */
  var cursor = $("#cursor");
  if (cursor && matchMedia("(pointer:fine)").matches) {
    var cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY; cursor.classList.add("on");
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(loop);
    })();
    $$("a, button, .card, .look, .sw, input").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("grow"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("grow"); });
    });
  }

  if (!reduced) {
    $$(".mag").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.22 + "px," +
                                            (e.clientY - r.top - r.height / 2) * 0.32 + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     CARD 3D TILT
     ───────────────────────────────────────────────────────────────── */
  if (!reduced) {
    $$(".card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(1100px) rotateY(" + (px * 7).toFixed(2) +
                               "deg) rotateX(" + (-py * 7).toFixed(2) + "deg) translateY(-6px)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     LOOKBOOK DRAG (touch / pointer)
     ───────────────────────────────────────────────────────────────── */
  if (lookbook) {
    var down = false, startX = 0, startScroll = 0;
    lookbook.addEventListener("pointerdown", function (e) {
      down = true; startX = e.clientX; startScroll = scrollY;
    });
    addEventListener("pointerup", function () { down = false; });
    addEventListener("pointermove", function (e) {
      if (!down) return;
      scrollTo({ top: startScroll + (startX - e.clientX) * 1.6, behavior: "instant" in document.body.style ? "auto" : "auto" });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────────────
     NAV DRAWER
     ───────────────────────────────────────────────────────────────── */
  var burger = $("#burger"), drawer = $("#drawer");
  if (burger && drawer) {
    burger.addEventListener("click", function () {
      var open = drawer.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    $$("a", drawer).forEach(function (a) {
      a.addEventListener("click", function () {
        drawer.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
        drawer.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     FORM
     ───────────────────────────────────────────────────────────────── */
  var form = $("#form"), note = $("#formNote"), email = $("#email");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (email.value || "").trim();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      note.className = "form__note " + (ok ? "ok" : "err");
      note.textContent = ok
        ? "Thank you. We will write when Lot 02 comes off the loom."
        : "That address does not look right — try again.";
      if (ok) { email.value = ""; }
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     PRELOADER
     ───────────────────────────────────────────────────────────────── */
  var loader = $("#loader"), bar = $("#loaderBar"), pct = 0;
  var barTimer = setInterval(function () {
    pct = Math.min(pct + Math.random() * 18, 100);
    if (bar) bar.style.width = pct + "%";
    if (pct >= 100) clearInterval(barTimer);
  }, 130);

  function finish() {
    setTimeout(function () {
      if (bar) bar.style.width = "100%";
      if (loader) loader.classList.add("done");
      document.documentElement.classList.add("ready");
      $(".hero").classList.add("in");
      sizeLookbook();
      onScroll();
    }, reduced ? 60 : 1500);
  }
  if (document.readyState === "complete") finish();
  else addEventListener("load", finish);

  // safety net: never trap the page behind the loader
  setTimeout(function () { if (loader) loader.classList.add("done"); }, 5000);

  var yr = $("#yr"); if (yr) yr.textContent = String(new Date().getFullYear());
})();
