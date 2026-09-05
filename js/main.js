/* =============================================================
   AJ Compendio portfolio
   Plain script on purpose (no ES modules) so index.html also
   works when opened straight off the filesystem.
   ============================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     All four project repos are public, so the links are live.
     Set this to false to put them back to "publishing soon" with
     clicks disabled, e.g. if a repo goes private again.
     ----------------------------------------------------------- */
  var REPOS_LIVE = true;

  var ROLES = [
    'AI AUTOMATION ENGINEER',
    'N8N SYSTEMS BUILDER',
    'RAG + AI AGENTS',
    'API & DATA INTEGRATION'
  ];

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ===========================================================
     PRELOADER
     Progress is derived from ELAPSED TIME, not from a tick count.
     Background tabs clamp setInterval to roughly 1s, so a counter
     that added a step per tick would crawl and the loader would
     still be sitting there when you switched back. Reading the
     clock instead means it lands where it should either way.
     =========================================================== */
  function preloader() {
    var el   = $('#preloader');
    var fill = $('#preloaderFill');
    var pct  = $('#preloaderPct');
    if (!el) return;

    var DURATION = 700;      // time to reach the pre-load ceiling
    var CEILING  = 1400;     // never wait longer than this for load
    var started  = Date.now();
    var loaded   = false;
    var done     = false;
    var timer;

    // The preloader is what gates Largest Contentful Paint: measured at
    // 3.16s with it, 72ms without. Playing it once per session keeps the
    // intro on a first visit and makes every navigation after it instant.
    var SEEN = 'aj_intro_seen';
    var seen = false;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch (err) { seen = false; }

    if (seen) {
      el.remove();
      startHero();
      return;
    }
    try { sessionStorage.setItem(SEEN, '1'); } catch (err) { /* private mode */ }

    window.addEventListener('load', function () { loaded = true; paint(); });
    setTimeout(function () { loaded = true; paint(); }, CEILING);

    function finish() {
      if (done) return;
      done = true;
      clearInterval(timer);
      el.classList.add('is-done');
      document.body.classList.remove('is-locked');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 700);
      startHero();
    }

    if (reduced) {
      fill.style.width = '100%';
      pct.textContent = '100%';
      setTimeout(finish, 120);
      return;
    }

    document.body.classList.add('is-locked');

    function paint() {
      if (done) return;
      var elapsed = Date.now() - started;
      var p = Math.min(elapsed / DURATION, 1);
      var eased = 1 - Math.pow(1 - p, 2);
      var value = Math.min(loaded ? 100 : 88, eased * 100);

      fill.style.width = value + '%';
      pct.textContent = Math.round(value) + '%';

      if (value >= 100) setTimeout(finish, 260);
    }

    timer = setInterval(paint, 50);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) paint();
    });
    paint();
  }

  /* ===========================================================
     HERO ENTRANCE  (runs after the preloader clears)
     =========================================================== */
  var heroStarted = false;
  function startHero() {
    if (heroStarted) return;
    heroStarted = true;

    revealNow($$('#hero [data-reveal]'));
    typewriter();
  }

  /* ===========================================================
     TYPEWRITER
     =========================================================== */
  function typewriter() {
    var out = $('#typewriter');
    if (!out) return;

    if (reduced) { out.textContent = ROLES[0]; return; }

    var i = 0, j = 0, deleting = false;

    (function tick() {
      var word = ROLES[i];
      j += deleting ? -1 : 1;
      out.textContent = word.slice(0, j);

      var wait = deleting ? 34 : 68;
      if (!deleting && j === word.length) { deleting = true; wait = 1700; }
      else if (deleting && j === 0)       { deleting = false; i = (i + 1) % ROLES.length; wait = 320; }

      setTimeout(tick, wait);
    })();
  }

  /* ===========================================================
     HERO CANVAS  (drifting node field)
     =========================================================== */
  function heroCanvas() {
    var cv = $('#heroCanvas');
    if (!cv || reduced) return;

    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [];
    var w = 0, h = 0;
    var running = true;
    var frame = null;

    function size() {
      var r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      var count = Math.min(74, Math.max(26, Math.round((w * h) / 19000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - .5) * .28,
          vy: (Math.random() - .5) * .28,
          r: Math.random() * 1.5 + .7
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

        for (var k = i + 1; k < nodes.length; k++) {
          var m = nodes[k];
          var dx = n.x - m.x, dy = n.y - m.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 21000) {
            // both canvas colours mirror --accent (#1D2545). Kept as literals:
            // reading the custom property here would cost a getComputedStyle per frame.
            ctx.strokeStyle = 'rgba(29,37,69,' + (.16 * (1 - d2 / 21000)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = 'rgba(29,37,69,.55)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running) frame = requestAnimationFrame(draw);
    }

    size();
    draw();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 180);
    });

    // stop painting once the hero has scrolled away
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; draw(); }
        else if (!visible && running) { running = false; cancelAnimationFrame(frame); }
      }, { threshold: 0 }).observe(cv);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; cancelAnimationFrame(frame); }
      else if (!running) { running = true; draw(); }
    });
  }

  /* ===========================================================
     REVEAL ON SCROLL  (one observer, staggered per section)
     =========================================================== */
  function revealNow(els) {
    els.forEach(function (el, i) {
      el.style.setProperty('--d', (i * 55) + 'ms');
      el.classList.add('is-in');
    });
  }

  function reveals() {
    var els = $$('[data-reveal]').filter(function (el) { return !el.closest('#hero'); });

    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    // stagger index is per-section, so each block cascades on its own
    var seen = {};
    els.forEach(function (el) {
      var sec = el.closest('section');
      var id = sec ? sec.id : 'root';
      seen[id] = (seen[id] || 0) + 1;
      el.style.setProperty('--d', Math.min(seen[id] - 1, 6) * 85 + 'ms');
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ===========================================================
     HEADER: stuck state, scroll progress, mobile nav, active link
     =========================================================== */
  function header() {
    var head = $('#header');
    var bar  = $('#scrollbarFill');
    var nav  = $('#nav');
    var burger = $('#burger');
    var links = $$('.nav__link');

    function paintScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      head.classList.toggle('is-stuck', y > 24);

      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        paintScroll();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // Background tabs suspend requestAnimationFrame, so a scroll that happens
    // while hidden would leave `ticking` stuck true and freeze the header and
    // the progress bar for good. Clear it and repaint on the way back in.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      ticking = false;
      paintScroll();
    });

    paintScroll();

    // mobile drawer
    function closeNav() {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
    }
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.forEach(function (a) { a.addEventListener('click', closeNav); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    // active section highlight
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      var current = null;
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (current === e.target.id) return;
          current = e.target.id;
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      sections.forEach(function (s) { spy.observe(s); });
    }
  }

  /* ===========================================================
     LIVE MANILA CLOCK
     =========================================================== */
  function clock() {
    var el = $('#clock');
    if (!el) return;

    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    } catch (err) {
      fmt = null;   // very old browser, fall back to local time
    }

    function tick() {
      var d = new Date();
      var t = fmt
        ? fmt.format(d)
        : [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map(function (n) { return String(n).padStart(2, '0'); }).join(':');
      el.textContent = 'MNL ' + t;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ===========================================================
     PROJECT ACCORDION
     =========================================================== */
  function projects() {
    $$('.project__head').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.project');
        var open = card.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ===========================================================
     METRIC COUNTERS
     =========================================================== */
  function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec    = parseInt(el.getAttribute('data-dec') || '0', 10);
      var pre    = el.getAttribute('data-prefix') || '';
      var suf    = el.getAttribute('data-suffix') || '';

      function paint(v) {
        el.textContent = pre + v.toLocaleString('en-US', {
          minimumFractionDigits: dec, maximumFractionDigits: dec
        }) + suf;
      }

      if (reduced || target === 0) { paint(target); return; }

      var dur = 1100, t0 = null;
      requestAnimationFrame(function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        paint(target * eased);
        if (p < 1) requestAnimationFrame(step);
        else paint(target);
      });
    }

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ===========================================================
     OPTIONAL ASSETS
     The portrait and the CV are dropped in later. Until they
     exist the page must not show a broken image or a dead link.
     =========================================================== */
  function optionalAssets() {
    // portrait
    var frame = $('.portrait__frame');
    if (frame) {
      var img = new Image();
      img.onload = function () {
        img.alt = 'Al John Compendio';
        img.setAttribute('width', img.naturalWidth);
        img.setAttribute('height', img.naturalHeight);
        frame.insertBefore(img, frame.firstChild);
        frame.parentNode.classList.add('has-photo');
      };
      img.src = 'assets/portrait.jpg';
    }

    // The resume PDF used to be HEAD-probed here to detect a missing file.
    // It is committed now, so that cost every visitor a round trip for
    // nothing. If you ever remove assets/AJ-Compendio-CV.pdf, this button
    // will 404 rather than degrading, so keep the file in the repo.

    // repo links
    $$('[data-repo]').forEach(function (a) {
      if (REPOS_LIVE) {
        a.classList.remove('is-pending');
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        return;
      }
      // append only, so the bullet already in the markup is not duplicated
      var label = a.textContent.replace(/●/g, '').trim();
      a.setAttribute('title', label + ' (repository not published yet)');
      a.insertAdjacentHTML('beforeend', ' &middot; publishing soon');
      a.addEventListener('click', function (e) { e.preventDefault(); });
    });
  }

  /* ===========================================================
     CONTACT FORM
     Netlify Forms handles this once deployed. Locally there is
     no endpoint, so say so instead of failing silently.
     =========================================================== */
  function contactForm() {
    var form = $('#contactForm');
    var note = $('#formNote');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!/^https?:$/.test(location.protocol)) {
        note.className = 'form-note is-err';
        note.textContent = 'Form only sends on the deployed site. Email works anywhere.';
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.setAttribute('aria-disabled', 'true');
      note.className = 'form-note';
      note.textContent = 'Sending...';

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          note.className = 'form-note is-ok';
          note.textContent = 'Message sent. I will get back to you shortly.';
        })
        .catch(function () {
          note.className = 'form-note is-err';
          note.innerHTML = 'Could not send. Email me at ' +
            '<a href="mailto:aljohncompendio@gmail.com">aljohncompendio@gmail.com</a>';
        })
        .then(function () { btn.removeAttribute('aria-disabled'); });
    });
  }

  /* ===========================================================
     BOOT
     =========================================================== */
  function init() {
    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();

    header();
    clock();
    reveals();
    heroCanvas();
    projects();
    counters();
    optionalAssets();
    contactForm();
    preloader();

    // safety net: if the preloader never ran, the hero still shows
    setTimeout(startHero, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
