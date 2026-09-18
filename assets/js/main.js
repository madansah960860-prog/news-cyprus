/* ==========================================================================
   Cyprus Pulse — shared scripts (vanilla JS, no dependencies)
   Everything degrades gracefully with JS disabled: the .js class gates
   any styling that hides content, and forms simply submit nowhere.
   ========================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------- Cookie helpers (try/catch: some contexts block cookies) ---------- */
  function setCookie(name, value, days) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = name + '=' + encodeURIComponent(value) +
        ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
    } catch (e) { /* cookies unavailable: consent UI stays per-page */ }
  }
  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  /* ---------- Consent state ---------- */
  var CONSENT_COOKIE = 'cp_consent';
  function readConsent() {
    var raw = getCookie(CONSENT_COOKIE);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function saveConsent(analytics, advertising) {
    var value = JSON.stringify({ necessary: true, analytics: !!analytics, advertising: !!advertising });
    setCookie(CONSENT_COOKIE, value, 365);
    applyConsent(readConsent() || { necessary: true, analytics: analytics, advertising: advertising });
  }

  /* Activate gated scripts: <script type="text/plain" data-consent="analytics|advertising"> */
  var activated = { analytics: false, advertising: false };
  function applyConsent(consent) {
    if (!consent) return;
    ['analytics', 'advertising'].forEach(function (cat) {
      if (!consent[cat] || activated[cat]) return;
      activated[cat] = true;
      var gated = document.querySelectorAll('script[type="text/plain"][data-consent="' + cat + '"]');
      Array.prototype.forEach.call(gated, function (tpl) {
        var s = document.createElement('script');
        if (tpl.dataset.src) { s.src = tpl.dataset.src; s.async = true; }
        else { s.textContent = tpl.textContent; }
        if (tpl.dataset.crossorigin) { s.crossOrigin = tpl.dataset.crossorigin; }
        document.head.appendChild(s);
      });
    });
  }

  /* ---------- Cookie banner + preferences modal ---------- */
  var banner = document.getElementById('cookie-banner');
  var modal = document.getElementById('cookie-modal');
  var existing = readConsent();
  if (existing) { applyConsent(existing); }
  else if (banner) { banner.classList.add('is-visible'); }

  function hideBanner() { if (banner) banner.classList.remove('is-visible'); }

  function bindClick(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  bindClick('cookie-accept', function () { saveConsent(true, true); hideBanner(); closeModal(); });
  bindClick('cookie-reject', function () { saveConsent(false, false); hideBanner(); closeModal(); });
  bindClick('cookie-manage', function () { openModal(); });
  bindClick('cookie-settings-link', function () { openModal(); });
  bindClick('cookie-open-inline', function () { openModal(); });
  bindClick('cookie-modal-close', function () { closeModal(); });
  bindClick('cookie-save', function () {
    var an = document.getElementById('consent-analytics');
    var ad = document.getElementById('consent-advertising');
    saveConsent(an && an.checked, ad && ad.checked);
    hideBanner();
    closeModal();
  });

  function openModal() {
    if (!modal) return;
    var current = readConsent();
    var an = document.getElementById('consent-analytics');
    var ad = document.getElementById('consent-advertising');
    if (current && an) an.checked = !!current.analytics;
    if (current && ad) ad.checked = !!current.advertising;
    modal.classList.add('is-open');
    var focusable = modal.querySelector('input, button');
    if (focusable) focusable.focus();
  }
  function closeModal() { if (modal) modal.classList.remove('is-open'); }
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  /* ---------- Dark mode toggle (cookie persisted; head snippet applies early) ---------- */
  var themeBtn = document.getElementById('theme-toggle');
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function paintThemeBtn() {
    if (!themeBtn) return;
    var dark = currentTheme() === 'dark';
    themeBtn.innerHTML = dark ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
                              : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (themeBtn) {
    paintThemeBtn();
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      setCookie('cp_theme', next, 365);
      paintThemeBtn();
    });
  }

  /* ---------- Topbar date (DD/MM/YYYY) ---------- */
  var dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    dateEl.textContent = dd + '/' + mm + '/' + now.getFullYear();
  }

  /* ---------- Sticky compact header ---------- */
  var header = document.getElementById('site-header');
  if (header && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:120px;height:1px;width:1px;';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-compact', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* ---------- Mobile drawer with focus trap ---------- */
  var drawer = document.getElementById('drawer');
  var drawerToggle = document.getElementById('nav-toggle');
  var drawerClose = document.getElementById('drawer-close');
  var scrim = document.getElementById('scrim');
  var lastFocused = null;

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    if (scrim) scrim.classList.add('is-visible');
    if (drawerToggle) drawerToggle.setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('a, button');
    if (first) first.focus();
    document.addEventListener('keydown', trapKeys);
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-visible');
    if (drawerToggle) drawerToggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', trapKeys);
    if (lastFocused) lastFocused.focus();
  }
  function trapKeys(e) {
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    var items = drawer.querySelectorAll('a, button, input');
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (drawerToggle) drawerToggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (scrim) scrim.addEventListener('click', closeDrawer);

  /* ---------- Search overlay: filters on-page cards by headline ---------- */
  var searchOverlay = document.getElementById('search-overlay');
  var searchOpenBtns = document.querySelectorAll('[data-search-open]');
  var searchCloseBtn = document.getElementById('search-close');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchEmpty = document.getElementById('search-empty');

  function collectSearchables() {
    var items = [];
    var nodes = document.querySelectorAll('[data-search-title]');
    Array.prototype.forEach.call(nodes, function (n) {
      items.push({
        title: n.getAttribute('data-search-title'),
        section: n.getAttribute('data-search-section') || '',
        href: n.getAttribute('data-search-href') || '#'
      });
    });
    return items;
  }
  var searchIndex = null;

  function runSearch(q) {
    if (!searchResults) return;
    if (searchIndex === null) searchIndex = collectSearchables();
    searchResults.innerHTML = '';
    var query = q.trim().toLowerCase();
    if (!query) { if (searchEmpty) { searchEmpty.hidden = true; } return; }
    var hits = searchIndex.filter(function (item) {
      return item.title.toLowerCase().indexOf(query) !== -1;
    });
    if (searchEmpty) searchEmpty.hidden = hits.length > 0;
    hits.slice(0, 20).forEach(function (hit) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = hit.href;
      var span = document.createElement('span');
      span.className = 'result-section';
      span.textContent = hit.section;
      a.appendChild(span);
      a.appendChild(document.createTextNode(hit.title));
      li.appendChild(a);
      searchResults.appendChild(li);
    });
  }
  Array.prototype.forEach.call(searchOpenBtns, function (btn) {
    btn.addEventListener('click', function () {
      if (!searchOverlay) return;
      searchOverlay.classList.add('is-open');
      if (searchInput) searchInput.focus();
    });
  });
  if (searchCloseBtn) searchCloseBtn.addEventListener('click', function () {
    searchOverlay.classList.remove('is-open');
  });
  if (searchOverlay) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && searchOverlay.classList.contains('is-open')) {
        searchOverlay.classList.remove('is-open');
      }
    });
  }
  if (searchInput) searchInput.addEventListener('input', function () { runSearch(this.value); });

  /* ---------- Newsletter forms (no backend: validate + success state) ---------- */
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  Array.prototype.forEach.call(document.querySelectorAll('form[data-newsletter]'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var msg = form.querySelector('.form-msg');
      if (!input || !msg) return;
      if (!emailRe.test(input.value)) {
        msg.textContent = 'Please enter a valid email address.';
        msg.className = 'form-msg err';
        input.focus();
        return;
      }
      msg.textContent = 'Thank you. Check your inbox to confirm your subscription.';
      msg.className = 'form-msg ok';
      form.reset();
    });
  });

  /* ---------- Contact form validation ---------- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.setAttribute('novalidate', 'novalidate');
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var firstBad = null;
      Array.prototype.forEach.call(contactForm.querySelectorAll('[data-validate]'), function (field) {
        var wrap = field.closest('.form-field');
        var rule = field.getAttribute('data-validate');
        var value = field.value.trim();
        var bad = false;
        if (rule === 'required' && !value) bad = true;
        if (rule === 'email' && !emailRe.test(value)) bad = true;
        if (rule === 'message' && value.length < 20) bad = true;
        if (wrap) wrap.classList.toggle('has-error', bad);
        if (bad) { ok = false; if (!firstBad) firstBad = field; }
      });
      if (!ok) { if (firstBad) firstBad.focus(); return; }
      var success = document.getElementById('contact-success');
      if (success) {
        success.hidden = false;
        contactForm.hidden = true;
        success.focus();
      }
    });
  }

  /* ---------- FAQ accordions ----------
     Markup ships fully expanded so content is visible without JS;
     on init we collapse everything except items flagged data-open. */
  Array.prototype.forEach.call(document.querySelectorAll('.faq-q'), function (btn) {
    var initPanel = document.getElementById(btn.getAttribute('aria-controls'));
    if (initPanel && !btn.hasAttribute('data-open')) {
      btn.setAttribute('aria-expanded', 'false');
      initPanel.hidden = true;
    }
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = expanded;
    });
  });

  /* ---------- 404 page: filter the section links by text ---------- */
  var linkFilter = document.querySelector('input[data-filter-links]');
  if (linkFilter) {
    var filterTarget = document.getElementById(linkFilter.getAttribute('data-filter-links'));
    var filterEmpty = document.getElementById('notfound-empty');
    linkFilter.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      var any = false;
      Array.prototype.forEach.call(filterTarget.children, function (li) {
        var hit = li.textContent.toLowerCase().indexOf(q) !== -1;
        li.hidden = !hit;
        if (hit) any = true;
      });
      if (filterEmpty) filterEmpty.hidden = any;
    });
  }

  /* ---------- Back to top ---------- */
  var backTop = document.getElementById('back-top');
  if (backTop && 'IntersectionObserver' in window) {
    var topSentinel = document.createElement('div');
    topSentinel.setAttribute('aria-hidden', 'true');
    topSentinel.style.cssText = 'position:absolute;top:600px;height:1px;width:1px;';
    document.body.prepend(topSentinel);
    new IntersectionObserver(function (entries) {
      backTop.classList.toggle('is-visible', !entries[0].isIntersecting);
    }).observe(topSentinel);
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- IntersectionObserver fade-in on cards ---------- */
  if ('IntersectionObserver' in window) {
    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(document.querySelectorAll('.fade-in'), function (el) {
      fadeObserver.observe(el);
    });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.fade-in'), function (el) {
      el.classList.add('is-inview');
    });
  }

  /* ---------- Reading progress bar (article page) ---------- */
  var progress = document.getElementById('progress-bar');
  var articleBody = document.getElementById('article-body');
  if (progress && articleBody) {
    var ticking = false;
    function paintProgress() {
      var rect = articleBody.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      progress.style.width = (total > 0 ? (done / total) * 100 : 0) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(paintProgress); }
    }, { passive: true });
    paintProgress();
  }

  /* ---------- TOC scroll-spy (article page) ---------- */
  var tocLinks = document.querySelectorAll('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    Array.prototype.forEach.call(tocLinks, function (link) {
      map[link.getAttribute('href').slice(1)] = link;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && map[entry.target.id]) {
          Array.prototype.forEach.call(tocLinks, function (l) { l.classList.remove('is-active'); });
          map[entry.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) {
      var target = document.getElementById(id);
      if (target) spy.observe(target);
    });
  }
})();
