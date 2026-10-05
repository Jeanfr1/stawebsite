// Phones: once the hero is behind, "Call us" and "Get a quote" stay at the bottom of the screen,
// and step aside when the contact section (with its own call button) is in view.
export function initCallBar() {
  const bar = document.querySelector('[data-call-bar]');
  const track = document.querySelector('[data-hero-track]');
  const contact = document.querySelector('#contact');
  if (!bar || !track) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const h = window.innerHeight;
    const pastHero = track.getBoundingClientRect().bottom < h * 0.5;
    const r = contact?.getBoundingClientRect();
    const atContact = r ? r.top < h * 0.85 && r.bottom > 0 : false;
    bar.classList.toggle('is-visible', pastHero && !atContact);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}
