import reviews from '../data/reviews.json';

// The Reviews section of the brief, built from src/data/reviews.json. It stays hidden until real
// reviews are added there: the kit's images carry no ratings, and none are invented here.
// Item shape: { "quote": "…", "name": "…", "detail": "Google review, March 2026" }
// Source shape (optional): { "label": "4.9 on Google", "url": "https://…" }
export function initReviews() {
  const section = document.querySelector('[data-reviews]');
  const list = document.querySelector('[data-review-list]');
  if (!section || !list || !reviews.items?.length) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  list.innerHTML = reviews.items
    .map(
      (r) => `<li><figure class="review">
        <svg class="icon" aria-hidden="true"><use href="#i-quote" /></svg>
        <blockquote><p>${esc(r.quote)}</p></blockquote>
        <figcaption><strong>${esc(r.name)}</strong>${r.detail ? `<br /><span class="mono">${esc(r.detail)}</span>` : ''}</figcaption>
      </figure></li>`,
    )
    .join('');
  const source = section.querySelector('[data-reviews-source]');
  if (source && reviews.source?.label) {
    source.innerHTML = reviews.source.url ? `<a class="text-link" href="${esc(reviews.source.url)}" rel="noopener" target="_blank">${esc(reviews.source.label)}</a>` : esc(reviews.source.label);
  }
  section.hidden = false;
}
