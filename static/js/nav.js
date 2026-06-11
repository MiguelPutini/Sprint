// ─── MOBILE HAMBURGER MENU ───────────────────────────────────────────────────
(function () {
  function initNav() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const navOverlay = document.getElementById('navOverlay');
    if (!hamburger || !mobileMenu || !navOverlay) return;

    function openMenu() {
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileMenu.style.display = 'flex';
      navOverlay.style.display = 'block';
      requestAnimationFrame(() => {
        mobileMenu.classList.add('open');
        navOverlay.classList.add('visible');
      });
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.classList.remove('open');
      navOverlay.classList.remove('visible');
      document.body.style.overflow = '';
      setTimeout(() => {
        mobileMenu.style.display = 'none';
        navOverlay.style.display = 'none';
      }, 350);
    }

    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });

    navOverlay.addEventListener('click', closeMenu);

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
