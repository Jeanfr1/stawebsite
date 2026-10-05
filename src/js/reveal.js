import { media } from './state.js';

// Section entrances: short, once, and only when motion is welcome. The hidden starting state
// only applies once this code runs (class on <html>), so nothing stays invisible without it.
export function initReveal() {
  if (media.reduced.matches || !('IntersectionObserver' in window)) return;
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (!items.length) return;
  document.documentElement.classList.add('reveal-live');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
  );
  items.forEach((n) => io.observe(n));
}
