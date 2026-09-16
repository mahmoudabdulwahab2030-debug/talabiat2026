(function () {
  'use strict';

  if (window.__appBackButtonLoaded) return;
  window.__appBackButtonLoaded = true;

  const cssHref = '/back-button.css';
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = cssHref;
    document.head.appendChild(stylesheet);
  }

  function addBackButton() {
    if (!document.body || document.querySelector('.app-back-button')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-back-button';
    button.setAttribute('aria-label', 'الرجوع إلى الصفحة السابقة');
    button.title = 'رجوع';
    button.innerHTML = '<span class="app-back-button__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span><span class="app-back-button__label">رجوع</span>';

    button.addEventListener('click', function () {
      const currentPath = window.location.pathname.toLowerCase();
      const hasPreviousPage = window.history.length > 1 && document.referrer;
      if (hasPreviousPage) {
        window.history.back();
        return;
      }
      window.location.href = currentPath.endsWith('/main.html') ? '/login.html' : '/main.html';
    });

    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addBackButton, { once: true });
  } else {
    addBackButton();
  }
})();