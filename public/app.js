// Small UI helpers used across pages
function showAlert(message, type = 'success', timeout = 3000) {
  const container = document.querySelector('.container');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
  alert.style.zIndex = 2000;
  alert.innerText = message;
  container.appendChild(alert);
  setTimeout(() => alert.remove(), timeout);
}

function formatCurrency(val) {
  return (Number(val) || 0).toLocaleString();
}

// Simple helper to ensure nav active link
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  // Theme (dark mode) handling
  const themeToggle = document.getElementById('themeToggle');
  function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', theme || 'light');
    if (themeToggle) themeToggle.innerHTML = theme === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
  }
  const saved = localStorage.getItem('theme');
  applyTheme(saved === 'dark' ? 'dark' : 'light');
  if (themeToggle) themeToggle.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
});

// -----------------------------
// Product Picker bridge — uses central component if present
// -----------------------------
(function(){
  // ensure the central productPicker component is loaded (creates window.productPicker)
  if (!window.productPicker) {
    const existing = document.querySelector('script[data-component="productPicker"]');
    if (!existing) {
      const s = document.createElement('script'); s.src = './src/components/productPicker.js'; s.setAttribute('data-component','productPicker');
      s.onload = () => {};
      s.onerror = () => console.warn('failed to load productPicker component');
      document.body.appendChild(s);
    }
  }

  function applySelectionToTarget(p, target) {
    if (!target || !p) return;
    target.value = p.name || p.barcode || '';
    const row = target.closest('tr');
    if (row) {
      const codeEl = row.querySelector('.product-code') || row.querySelector('.row-barcode') || row.querySelector('.product-code-input');
      if (codeEl) {
        if (codeEl.tagName === 'INPUT') codeEl.value = p.barcode || '';
        else codeEl.innerText = p.barcode || '-';
      }
      const currentEl = row.querySelector('.row-current') || row.querySelector('.balance-input');
      if (currentEl) currentEl.innerText = (p.quantity || 0);
      const priceElInput = row.querySelector('.row-price');
      if (priceElInput && priceElInput.tagName === 'INPUT') priceElInput.value = (p.salePrice || 0).toFixed(2);
      else if (priceElInput) priceElInput.innerText = (p.salePrice || 0).toFixed(2);
    }
    target.dispatchEvent(new Event('change'));
  }

  window.openProductPicker = async (inputEl) => {
    if (window.productPicker && typeof window.productPicker.open === 'function') {
      const p = await window.productPicker.open();
      applySelectionToTarget(p, inputEl);
      return;
    }
    if (typeof window._legacyOpenProductPicker === 'function') return window._legacyOpenProductPicker(inputEl);
    console.warn('No product picker available');
  };

  // F1 handler for inputs that want the picker
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      const el = document.activeElement;
      if (!el) return;
      if (el.classList && el.classList.contains('product-search')) {
        e.preventDefault(); window.openProductPicker(el); return;
      }
      if (el.tagName === 'INPUT' && el.closest && el.closest('table')) {
        // common inputs inside tables (requisition rows, etc.)
        if (el.classList.contains('product-name-input') || el.classList.contains('product-code-input') || el.closest('#reqRows')) {
          e.preventDefault(); window.openProductPicker(el); return;
        }
      }
    }
  });

  // preserve legacy reference if any
  if (typeof window.openProductPicker === 'function' && !window._legacyOpenProductPicker) {
    window._legacyOpenProductPicker = window.openProductPicker;
  }
})();

// Load exports utilities (print/pdf/excel) and auto attach on tables
(function(){
  // Only load exports.js when a page contains exportable tables and did not opt-out
  try {
    if (document.body && document.body.hasAttribute && document.body.hasAttribute('data-no-export-attach')) return;
    if (!document.querySelector || !document.querySelector('.exportable-table')) return;
    const s = document.createElement('script'); s.src = 'exports.js'; s.onload = () => {
      try { if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar(); } catch(e){console.error('exports init failed', e);} };
    s.onerror = () => console.warn('failed to load exports.js');
    document.body.appendChild(s);
  } catch (e) { console.error('exports loader error', e); }
})();
