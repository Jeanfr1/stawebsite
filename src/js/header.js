import { targetTop } from './scroll.js';

// Solid once the hero is behind; the current section highlighted; the phone menu.
export function initHeader() {
  const header = document.querySelector('[data-header]');
  const track = document.querySelector('[data-hero-track]');
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const label = document.querySelector('[data-menu-label]');
  const links = [...document.querySelectorAll('[data-nav-link]')];
  if (!header) return;
  const sections = links.map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) })).filter((s) => s.el);

  let tops = [];
  const measure = () => {
    tops = sections.map((s) => ({ ...s, top: targetTop(s.el) }));
  };

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const heroEnd = track ? track.getBoundingClientRect().bottom + y - header.offsetHeight : 0;
    header.classList.toggle('is-solid', y > Math.max(40, heroEnd - 1));
    const probe = y + window.innerHeight * 0.4;
    let current = null;
    for (const s of tops) if (s.top <= probe) current = s;
    links.forEach((a) => {
      if (current && a === current.a) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    onScroll();
  });
  window.addEventListener('load', () => {
    measure();
    update();
  });

  // ----- the phone menu
  if (!nav || !toggle) return;
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener?.('change', (e) => e.matches && setOpen(false));
}
