// Redirect to centralized navbar component
(function(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('script'); s.src = './src/components/navbar.js'; s.setAttribute('data-component','navbar'); document.body.appendChild(s);
    });
  } else {
    const s = document.createElement('script'); s.src = './src/components/navbar.js'; s.setAttribute('data-component','navbar'); document.body.appendChild(s);
  }
})();
