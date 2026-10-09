(() => {
  const root = document.documentElement;
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.setAttribute('data-open', 'false');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.querySelector('.cinematic-intro');
  if (intro) {
    const seen = sessionStorage.getItem('uskoci-intro-seen');
    if (reduce || seen) {
      intro.remove();
    } else {
      sessionStorage.setItem('uskoci-intro-seen', '1');
      window.setTimeout(() => intro.classList.add('is-ending'), 1550);
      window.setTimeout(() => intro.remove(), 2250);
    }
  }

  const reveal = document.querySelectorAll('[data-reveal]');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    reveal.forEach(el => io.observe(el));
  } else {
    reveal.forEach(el => el.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });

  const copy = document.querySelector('[data-copy-email]');
  if (copy) {
    copy.addEventListener('click', async () => {
      const email = 'uskocibusiness@gmail.com';
      try {
        await navigator.clipboard.writeText(email);
        const old = copy.textContent;
        copy.textContent = 'Email je kopiran';
        setTimeout(() => { copy.textContent = old; }, 1800);
      } catch {
        window.location.href = 'mailto:' + email;
      }
    });
  }

  root.classList.add('js');
})();
