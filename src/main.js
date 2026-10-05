import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/main.css';

import { initAnchors } from './js/scroll.js';
import { initHeader } from './js/header.js';
import { initHero } from './js/hero.js';
import { initReviews } from './js/reviews.js';
import { initCallBar } from './js/callbar.js';
import { initReveal } from './js/reveal.js';

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

initReviews();
initHero();
initAnchors();
initHeader();
initCallBar();
initReveal();
