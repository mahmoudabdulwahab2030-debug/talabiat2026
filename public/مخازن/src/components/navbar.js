// Central navbar component — loads navbar.html and injects it once
(async function(){
  async function loadNavbar(){
    try{
      const res = await fetch('navbar.html');
      if(!res.ok) return console.warn('navbar.html not found');
      const html = await res.text();
      // parse HTML so we can execute scripts inside the fragment
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // move non-script nodes into the body
      Array.from(tmp.childNodes).forEach(node => {
        if (node.tagName && node.tagName.toLowerCase() === 'script') return; // defer scripts
        document.body.insertBefore(node, document.body.firstChild);
      });
      // execute scripts (inline or external)
      Array.from(tmp.querySelectorAll('script')).forEach(oldScript => {
        const script = document.createElement('script');
        // copy attributes
        Array.from(oldScript.attributes).forEach(a=> script.setAttribute(a.name,a.value));
        // copy inline content
        if (oldScript.textContent) script.textContent = oldScript.textContent;
        document.body.insertBefore(script, document.body.firstChild);
      });

      // mark active link
      const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      document.querySelectorAll('.navbar-nav .nav-link').forEach(a=>{
        a.classList.remove('active');
        const href = (a.getAttribute('href')||'').split('/').pop().toLowerCase();
        if(href === path) a.classList.add('active');
      });

      // accessibility: ensure navbar toggler has aria-controls and aria-expanded
      const toggler = document.querySelector('.navbar-toggler');
      const navCollapse = document.querySelector('.navbar-collapse');
      if (toggler && navCollapse) {
        const id = navCollapse.id || 'site-navbar-collapse';
        navCollapse.id = id;
        toggler.setAttribute('aria-controls', id);
        toggler.setAttribute('aria-expanded', 'false');
      }

    }catch(e){ console.error('Failed to load navbar', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNavbar); else loadNavbar();
})();
