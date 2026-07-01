/* nav-dropdown.js — click-to-open sticky dropdown for site navigation */
(function () {
  'use strict';

  function closeAll() {
    document.querySelectorAll('.nav-dropdown.is-open').forEach(function (dd) {
      dd.classList.remove('is-open');
      var t = dd.querySelector('.nav-dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function initDropdowns() {
    document.querySelectorAll('.nav-dropdown').forEach(function (dropdown) {
      var toggle = dropdown.querySelector('.nav-dropdown-toggle');
      var menu   = dropdown.querySelector('.nav-dropdown-menu');
      if (!toggle || !menu) return;

      toggle.setAttribute('aria-expanded', 'false');

      /* click / tap to open or close */
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        var opening = !dropdown.classList.contains('is-open');
        closeAll();
        if (opening) {
          dropdown.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });

      /* keyboard: Enter or Space activate the toggle */
      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle.click();
        }
      });

      /* clicking a submenu link closes the dropdown */
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          closeAll();
        });
      });
    });

    /* click outside → close */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-dropdown')) {
        closeAll();
      }
    });

    /* Escape key → close */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAll();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdowns);
  } else {
    initDropdowns();
  }
})();
