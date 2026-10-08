/* Run in the head before CSS so the first paint uses the saved theme.
   A plain script also works when the portfolio is opened with file://. */
(function () {
  'use strict';

  var KEY = 'aj_theme';
  var root = document.documentElement;
  var theme = 'dark';
  var toggle = null;

  function valid(value) { return value === 'light' || value === 'dark'; }

  try {
    var saved = localStorage.getItem(KEY);
    if (valid(saved)) theme = saved;
  } catch (err) { /* Storage can be unavailable in private or file browsing. */ }

  function syncButton() {
    if (!toggle) return;
    var action = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode';
    toggle.setAttribute('aria-label', action);
    toggle.setAttribute('title', action);
    var label = toggle.querySelector('.theme-toggle__label');
    if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }

  function apply(value, persist) {
    theme = valid(value) ? value : 'dark';
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101522' : '#F5F7FA');
    syncButton();

    if (persist) {
      try { localStorage.setItem(KEY, theme); } catch (err) { /* Choice still works for this visit. */ }
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  apply(theme, false);

  function init() {
    toggle = document.getElementById('themeToggle');
    syncButton();
    if (toggle) {
      toggle.addEventListener('click', function () {
        apply(theme === 'dark' ? 'light' : 'dark', true);
      });
    }
  }

  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) apply(event.key === null ? 'dark' : event.newValue, false);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
