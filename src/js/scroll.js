import { media } from './state.js';
import { anchorTop } from './hero.js';

// Where an in-page target sits: #services lives inside the pinned scene on desktop, so its
// position comes from the hero; everything else is measured.
export function targetTop(el) {
  const fromHero = anchorTop(el);
  if (fromHero !== null) return fromHero;
  if (el.id === 'top') return 0;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const header = document.querySelector('[data-header]')?.offsetHeight || 0;
  return Math.round(el.getBoundingClientRect().top + window.scrollY - Math.max(margin, el.matches('.band, .contact') ? 0 : header * 0.5));
}

// Long jumps (e.g. "Get a quote" from the top, which crosses the pinned hero) are instant;
// short ones are smooth when motion is allowed.
export function scrollToTarget(el, { focus = true } = {}) {
  if (!el) return;
  const top = targetTop(el);
  const distance = Math.abs(top - window.scrollY);
  if (focus) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  if (distance < 1) return;
  const smooth = !media.reduced.matches && distance < window.innerHeight * 2.2;
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  // a target inside the pinned scene is only visible (and focusable) once the scene has caught up
  if (focus && document.activeElement !== el) setTimeout(() => el.focus({ preventScroll: true }), smooth ? 700 : 120);
}

export function initAnchors() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const hash = link.getAttribute('href');
    if (hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    if (history.replaceState) history.replaceState(null, '', hash);
    scrollToTarget(target, { focus: hash !== '#top' });
  });

  // Arriving with a hash: the hero track only gets its final height once styles apply.
  if (location.hash.length > 1) {
    const target = document.querySelector(location.hash);
    if (target) window.addEventListener('load', () => scrollToTarget(target, { focus: false }), { once: true });
  }
}
