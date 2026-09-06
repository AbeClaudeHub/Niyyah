/* ==========================================================================
   KYAN CAFE — interactions
   Everything degrades: with JS off the page is still a complete, readable site.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------- preloader */
  var preload = $("#preload");
  var hero = $(".hero");

  function opening() {
    if (preload) preload.classList.add("done");
    if (hero) hero.classList.add("ready");
  }

  if (document.readyState === "complete") {
    setTimeout(opening, reduced ? 0 : 220);
  } else {
    window.addEventListener("load", function () {
      setTimeout(opening, reduced ? 0 : 220);
    });
    /* never let a slow font or image hold the page hostage */
    setTimeout(opening, 2200);
  }

  /* ---------------------------------------------------- nav + progress */
  var nav = $("#nav");
  var progress = $("#progress");
  var totop = $("#totop");
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || root.scrollTop;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);

    if (nav) nav.classList.toggle("is-stuck", y > 40);
    if (progress) progress.style.transform = "scaleX(" + Math.min(1, y / max) + ")";
    if (totop) totop.classList.toggle("show", y > window.innerHeight * 0.9);
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (totop) {
    totop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  }

  /* --------------------------------------------------------- mobile nav */
  var burger = $("#burger");
  var sheet = $("#sheet");

  function setSheet(open) {
    if (!sheet || !burger) return;
    sheet.classList.toggle("is-open", open);
    sheet.setAttribute("aria-hidden", open ? "false" : "true");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (burger) {
    burger.addEventListener("click", function () {
      setSheet(!sheet.classList.contains("is-open"));
    });
  }
  $$("#sheet a").forEach(function (a) {
    a.addEventListener("click", function () { setSheet(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setSheet(false);
  });

  /* ------------------------------------------------------------ reveals */
  var revealables = $$("[data-reveal]");

  if (!("IntersectionObserver" in window) || reduced) {
    revealables.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------- counters */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target) || el.hasAttribute("data-plain")) return;

    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = 1400;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var counters = $$("[data-count]");
  if ("IntersectionObserver" in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ------------------------------------------------------ the glass fill */
  var glass = $("#glass");
  if (glass) {
    if (reduced || !("IntersectionObserver" in window)) {
      glass.classList.add("filled");
    } else {
      var gio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            glass.classList.add("filled");
            gio.disconnect();
          }
        });
      }, { threshold: 0.35 });
      gio.observe(glass);
    }
  }

  /* -------------------------------------------------------- menu filter */
  var tabs = $$(".tab");
  var items = $$("#menuGrid .mrow");

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var filter = tab.getAttribute("data-filter");

      tabs.forEach(function (t) {
        t.setAttribute("aria-pressed", String(t === tab));
      });

      var shown = 0;
      items.forEach(function (item) {
        var match = filter === "all" || item.getAttribute("data-cat") === filter;
        item.hidden = !match;
        if (match) {
          shown++;
          if (!reduced) {
            item.style.animation = "none";
            /* force reflow so the entry animation replays */
            void item.offsetWidth;
            item.style.animation = "";
            item.style.animationDelay = Math.min(shown * 0.03, 0.3) + "s";
          }
        }
      });
    });

    tab.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(tab);
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); next.click(); }
    });
  });

  /* --------------------------------------------- open / closed, NY time */
  var OPEN_HOUR = 7;   /* 7:00 AM */
  var CLOSE_HOUR = 24; /* midnight */

  function nyNow() {
    /* weekday + wall-clock time in America/New_York, wherever the visitor is */
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(new Date());

    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });

    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var hour = parseInt(out.hour, 10);
    if (hour === 24) hour = 0; /* some engines render midnight as 24 */

    return {
      day: days[out.weekday],
      hour: hour,
      minute: parseInt(out.minute, 10)
    };
  }

  function paintStatus() {
    var pill = $("#status");
    var label = $("#statusText");
    if (!pill || !label) return;

    var now;
    try { now = nyNow(); } catch (err) { return; }

    var mins = now.hour * 60 + now.minute;
    var isOpen = mins >= OPEN_HOUR * 60 && mins < CLOSE_HOUR * 60;

    pill.classList.toggle("is-open", isOpen);
    pill.classList.toggle("is-closed", !isOpen);

    if (isOpen) {
      var left = CLOSE_HOUR * 60 - mins;
      label.textContent = left <= 60 ? "Closing in " + left + " min" : "Open until midnight";
    } else {
      label.textContent = "Opens at 7 AM";
    }

    /* highlight today's row in the hours table */
    var row = $('#hours li[data-day="' + now.day + '"]');
    if (row) row.classList.add("today");
  }

  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------------------------------------------------------- odds & ends */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* anchor links close the sheet and land below the fixed header */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 62;
      window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });
})();
