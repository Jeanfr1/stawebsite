// Hero: "Beneath the Extraordinary" (roteiro-criativo.pdf + ROTEIRO-DE-MONTAGEM.txt).
//
// One smoothed scroll value drives everything, so the scene is a pure function of the scroll
// position and runs backwards as cleanly as forwards. Desktop, in fractions of the pinned distance:
//   0–10 %   reveal       a light passes over the dark car and leaves it lit
//   6–31 %   scan         the camera moves in on the front axle while a cold scan line crosses the
//                         bodywork; behind it the car is wireframe, then the whole body turns to lines
//   29–47 %  inside       the engineering appears inside the silhouette; the camera moves in on
//                         the engine under the bonnet
//   44–56 %  engineering  the engine itself takes over at the same place and size, the car fades,
//                         and the engine moves to the centre of the studio
//   55–77 %  separation   the engine opens into its three groups while the brake and the oil filter
//                         arrive: five groups, then the engine closes again
//   76–92 %  services     the services section appears and the engine, the brake and the filter
//                         land in the Diagnostics, Repairs and Maintenance cards
// Phones ("compact") keep the essentials on a shorter track: the portrait opening, the scan, the
// cutaway and the engine opening and closing. Reduced motion ("static") shows the still hero.
//
// Every layer is placed with a 2D similarity (scale, angle, offset) from its own pixels to the
// screen. scene.json (scripts/register-scene.py) says how the layers fit together.
import scene from '../data/scene.json';
import { media, lerp, range, smooth, easeInOut, easeOut, windowed } from './state.js';

// only the layers the scene loads itself (the rest are referenced from index.html)
const IMG = import.meta.glob('../assets/img/{scan-1672,wireframe-1672,cutaway-1672,studio-*,engine-1102,group-*,brake-932,filter-1269}.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const url = (name) => IMG[`../assets/img/${name}.webp`];

const CAR = scene.car;
const ENGINE = scene.engine;
const PARTS = scene.parts;
const deg = Math.PI / 180;
const boxOf = (b) => ({ x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1], cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 });
const ENGINE_BOX = boxOf(ENGINE.box);
const ENGINE_C = [ENGINE_BOX.cx, ENGINE_BOX.cy];
const IN_CAR = boxOf(CAR.focus.engine.box);
const CAR_BOX = boxOf(CAR.box);
const PLANE = scene.scan.plane;
const CORE = scene.scan.core_offset;
const SCAN_FROM = CAR_BOX.x - 40 - Math.max(...PLANE.map((q) => q[0])); // the line starts just ahead of the bumper
const SERVICES_AT = 0.94; // where #services lands on desktop (fraction of the pinned distance)

// Scroll script, in fractions of the pinned distance.
const TIMELINE = {
  scroll: {
    reveal: [0, 0.1],
    intro: [0.06, 0.12],
    cue: [0, 0.03],
    push1: [0.06, 0.3],
    scan: [0.12, 0.27],
    scanOut: [0.27, 0.31],
    wire: [0.29, 0.35],
    cut: [0.34, 0.41],
    push2: [0.31, 0.47],
    engineIn: [0.44, 0.48],
    carOut: [0.46, 0.5],
    studioIn: [0.44, 0.5],
    engineOut: [0.47, 0.56],
    split: [0.555, 0.575],
    explode: [0.57, 0.65],
    partsIn: [0.58, 0.66],
    leaders: [0.64, 0.665, 0.69, 0.71],
    rejoin: [0.69, 0.75],
    merge: [0.745, 0.765],
    panel: [0.76, 0.84],
    dock: [0.77, 0.9],
    steps: [
      [0.13, 0.17, 0.27, 0.31],
      [0.34, 0.38, 0.45, 0.49],
      [0.56, 0.6, 0.71, 0.75],
    ],
    chapters: [0.12, 0.32, 0.47, 0.76],
  },
  compact: {
    intro: [0.04, 0.1],
    cue: [0, 0.03],
    toCar: [0.07, 0.16],
    push1: [0.03, 0.34],
    scan: [0.16, 0.31],
    scanOut: [0.31, 0.34],
    cut: [0.35, 0.42],
    push2: [0.36, 0.5],
    engineIn: [0.47, 0.51],
    carOut: [0.49, 0.53],
    studioIn: [0.47, 0.53],
    engineOut: [0.5, 0.58],
    split: [0.58, 0.6],
    explode: [0.6, 0.7],
    rejoin: [0.76, 0.84],
    merge: [0.83, 0.85],
    steps: [
      [0.14, 0.18, 0.3, 0.34],
      [0.37, 0.41, 0.48, 0.52],
      [0.6, 0.64, 0.92, 0.98],
    ],
    chapters: [0.12, 0.34, 0.5, 2],
  },
};

// Geometry, in fractions of the stage (W × H) unless noted.
const LAYOUT = {
  scroll: {
    focus: { x: 0.62, y: 0.72 }, // the opening frame, as the CSS object-position
    scanAt: { q: [820, 560], to: [0.55, 0.56], zoom: 1.7 }, // car px on screen point, × cover scale
    engineAt: { q: [IN_CAR.cx, IN_CAR.cy], to: [0.52, 0.52], zoom: 2.5 },
    product: { x: 0.56, y: 0.54, h: 0.6, w: 0.44 },
    exploded: { scale: 0.8, y: 0.5 },
    brake: { x: 0.21, y: 0.44, h: 0.34, rot: -8, from: { x: -0.16, y: 0.58, rot: -26 } },
    filter: { x: 0.855, y: 0.6, h: 0.22, rot: 8, from: { x: 1.16, y: 0.48, rot: 24 } },
  },
  compact: {
    mobile: { focus: { x: 0.5, y: 1 }, wheel: [490, 1030], scale: 0.64 }, // hero-mobile.png
    scanAt: { q: [820, 570], to: [0.5, 0.46], zoom: 1 },
    engineAt: { q: [IN_CAR.cx, IN_CAR.cy], to: [0.5, 0.44], zoom: 1.5 },
    product: { x: 0.5, y: 0.42, h: 0.34, w: 0.86 },
    exploded: { scale: 0.74, y: 0.4 },
  },
};

// per-frame catch-up of the scrubbed scroll position (`?nosmooth` turns it off, for captures)
const SMOOTH = new URLSearchParams(location.search).has('nosmooth') ? 1 : 0.14;
const root = document.documentElement;

// ---------- 2D similarities: p' = (x, y) + s·R(r)·p ----------
const sim = (s, r, x, y) => ({ s, r, x, y });
const apply = (A, [px, py]) => [A.x + A.s * (Math.cos(A.r) * px - Math.sin(A.r) * py), A.y + A.s * (Math.sin(A.r) * px + Math.cos(A.r) * py)];
const compose = (A, B) => {
  const [x, y] = apply(A, [B.x, B.y]);
  return sim(A.s * B.s, A.r + B.r, x, y);
};
const invert = (A) => {
  const s = 1 / A.s;
  const c = Math.cos(-A.r);
  const n = Math.sin(-A.r);
  return sim(s, -A.r, -s * (c * A.x - n * A.y), -s * (n * A.x + c * A.y));
};
// the similarity that puts local point q on screen point C
const placeAt = (s, r, q, C) => {
  const [qx, qy] = apply(sim(s, r, 0, 0), q);
  return sim(s, r, C[0] - qx, C[1] - qy);
};
// blend two placements of one layer: its point q travels in a straight line, scale eases in log space
const mix = (A, B, t, q) => {
  if (t <= 0) return A;
  if (t >= 1) return B;
  const s = Math.exp(lerp(Math.log(A.s), Math.log(B.s), t));
  const r = A.r + Math.atan2(Math.sin(B.r - A.r), Math.cos(B.r - A.r)) * t;
  const pa = apply(A, q);
  const pb = apply(B, q);
  return placeAt(s, r, q, [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t)]);
};
const fromCss = ([a, b, , , e, f]) => sim(Math.hypot(a, b), Math.atan2(b, a), e, f);
const shift = (A, dx, dy) => sim(A.s, A.r, A.x + dx, A.y + dy);
const matrix = (A) => {
  const a = A.s * Math.cos(A.r);
  const b = A.s * Math.sin(A.r);
  return `matrix(${a.toFixed(5)}, ${b.toFixed(5)}, ${(-b).toFixed(5)}, ${a.toFixed(5)}, ${A.x.toFixed(2)}, ${A.y.toFixed(2)})`;
};

// the engine, from its own canvas onto the engine under the bonnet of the cutaway
const ENGINE_IN_CAR = placeAt((IN_CAR.w * 1.06) / ENGINE_BOX.w, 0, ENGINE_C, [IN_CAR.cx, IN_CAR.cy]);
// each group's crop -> engine canvas (assembled), and its separation offset
const GROUPS = ENGINE.order.map((key) => {
  const g = ENGINE.groups[key];
  const b = boxOf(g.box);
  return { key, box: b, place: compose(fromCss(g.assembled.matrix), sim(1, 0, b.x, b.y)), spread: g.spread };
});
// the stack grows down more than up when it opens: keep it centred while it does
const SPREAD_TOP = Math.min(...GROUPS.map((g) => g.spread[1]));
const SPREAD_BOTTOM = Math.max(...GROUPS.map((g) => g.spread[1]));
const EXPLODED_CY = ENGINE_C[1] + (SPREAD_TOP + SPREAD_BOTTOM) / 2;

// the scan line: the measured plane, moved across the car by dx
const planePath = (dx, off = 0) => `M${PLANE.map(([x, y]) => `${(x + dx + off).toFixed(1)} ${y}`).join('L')}`;
const planeClip = (dx) => {
  const pts = PLANE.map(([x, y]) => `${(x + dx + 2).toFixed(1)}px ${y}px`);
  const top = PLANE[0][0] + dx + 2;
  const bottom = PLANE[PLANE.length - 1][0] + dx + 2;
  return `polygon(0 0, ${top.toFixed(1)}px 0, ${pts.join(', ')}, ${bottom.toFixed(1)}px ${CAR.height}px, 0 ${CAR.height}px)`;
};

let api = null;
// Scroll position of an in-page target that lives inside the pinned scene (desktop #services).
export function anchorTop(el) {
  return api ? api(el) : null;
}

export function initHero() {
  const track = document.querySelector('[data-hero-track]');
  const stage = document.querySelector('[data-stage]');
  if (!track || !stage) return;

  const q = (s) => stage.querySelector(s);
  const el = {
    still: q('[data-still]'),
    studio: q('[data-studio]'),
    car: q('[data-car]'),
    layers: Object.fromEntries([...stage.querySelectorAll('[data-layer]')].map((n) => [n.dataset.layer, n])),
    sweep: q('[data-sweep]'),
    scanLine: q('[data-scan-line]'),
    scanPaths: [...stage.querySelectorAll('[data-scan-path]')],
    shade: q('[data-shade]'),
    intro: q('[data-hero-intro]'),
    corner: q('[data-corner]'),
    cue: q('[data-cue]'),
    steps: [...stage.querySelectorAll('[data-step]')],
    rail: q('[data-chapters]'),
    chapters: [...stage.querySelectorAll('[data-chapters] li')],
    bar: q('[data-progress-bar]'),
    rig: q('[data-rig]'),
    engine: q('[data-engine]'),
    groups: Object.fromEntries([...stage.querySelectorAll('[data-group]')].map((n) => [n.dataset.group, n])),
    parts: Object.fromEntries([...stage.querySelectorAll('[data-part]')].map((n) => [n.dataset.part, n])),
    leaders: Object.fromEntries([...stage.querySelectorAll('[data-leader]')].map((n) => [n.dataset.leader, n])),
    slot: q('[data-services-slot]'),
    services: document.querySelector('[data-services]'),
  };
  const cards = el.services ? [...el.services.querySelectorAll('.card')] : [];
  const docks = el.services ? Object.fromEntries([...el.services.querySelectorAll('[data-dock]')].map((n) => [n.dataset.dock, n])) : {};

  // ---------- layers: fixed pixel boxes, placed with matrices ----------
  function placeLayers() {
    const e = ENGINE_BOX;
    Object.assign(el.engine.style, { width: `${e.w}px`, height: `${e.h}px`, transform: `translate(${e.x}px, ${e.y}px)` });
    for (const g of GROUPS) {
      Object.assign(el.groups[g.key].style, { width: `${g.box.w}px`, height: `${g.box.h}px` });
    }
    for (const [key, img] of Object.entries(el.parts)) {
      const b = boxOf(PARTS[key].box);
      Object.assign(img.style, { width: `${b.w}px`, height: `${b.h}px` });
    }
    if (mode === 'compact') {
      Object.assign(el.still.style, { width: '940px', height: '1672px', maxWidth: 'none', inset: 'auto', left: '0', top: '0', objectFit: 'fill' });
    }
  }

  let loaded = false;
  function loadScene() {
    if (loaded) return;
    loaded = true;
    el.layers.scan.src = url('scan-1672');
    if (mode === 'scroll') el.layers.wireframe.src = url('wireframe-1672');
    el.layers.cutaway.src = url('cutaway-1672');
    el.studio.srcset = `${url('studio-960')} 960w, ${url('studio-1672')} 1672w`;
    el.studio.sizes = '100vw';
    el.studio.src = url('studio-1672');
    el.engine.src = url(`engine-${ENGINE_BOX.w}`);
    for (const g of GROUPS) el.groups[g.key].src = url(`group-${g.key}-${g.box.w}`);
    if (mode === 'scroll') {
      for (const key of Object.keys(el.parts)) el.parts[key].src = url(`${key}-${boxOf(PARTS[key].box).w}`);
    }
  }

  // ---------- state ----------
  let mode = '';
  let T = TIMELINE.scroll;
  let L = LAYOUT.scroll;
  let W = 1;
  let H = 1;
  let G = {};
  let sy = window.scrollY;
  let target = sy;
  let raf = 0;
  let chapter = -1;

  function currentMode() {
    if (media.reduced.matches) return 'static';
    return media.wide.matches ? 'scroll' : 'compact';
  }

  // ---------- measuring ----------
  function measure() {
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
    const cover = Math.max(W / CAR.width, H / CAR.height);
    const keepCovered = (A) => {
      if (A.s < cover - 1e-6) return A;
      const x = Math.min(0, Math.max(W - CAR.width * A.s, A.x));
      const y = Math.min(0, Math.max(H - CAR.height * A.s, A.y));
      return sim(A.s, 0, x, y);
    };
    const camAt = ({ q, to, zoom }) => keepCovered(placeAt(cover * zoom, 0, q, [to[0] * W, to[1] * H]));

    let cam0;
    let mobileFromCar = null;
    if (mode === 'compact') {
      // the portrait opening, as CSS shows it (cover, bottom-aligned) …
      const M = L.mobile;
      const km = Math.max(W / 940, H / 1672);
      const mobileCover = sim(km, 0, (W - 940 * km) * M.focus.x, (H - 1672 * km) * M.focus.y);
      // … and the landscape car laid over it: front wheel on front wheel, at the car's length
      const carToMobile = placeAt(M.scale, 0, CAR.focus.front_wheel, M.wheel);
      cam0 = compose(mobileCover, carToMobile);
      mobileFromCar = invert(carToMobile);
    } else {
      cam0 = sim(cover, 0, (W - CAR.width * cover) * L.focus.x, (H - CAR.height * cover) * L.focus.y);
    }
    const camScan = camAt(L.scanAt);
    const camEngine = camAt(L.engineAt);

    // the engine: product shot, then opened
    const P = L.product;
    const sProd = Math.min((P.h * H) / ENGINE_BOX.h, (P.w * W) / ENGINE_BOX.w);
    const rigProduct = placeAt(sProd, 0, ENGINE_C, [P.x * W, P.y * H]);
    const rigExploded = placeAt(sProd * L.exploded.scale, 0, [ENGINE_C[0], EXPLODED_CY], [P.x * W, L.exploded.y * H]);

    // the brake and the filter, around the open engine
    const parts = {};
    if (mode === 'scroll') {
      for (const key of ['brake', 'filter']) {
        const c = L[key];
        const b = boxOf(PARTS[key].box);
        const s = (c.h * H) / b.h;
        const centre = [b.w / 2, b.h / 2];
        parts[key] = {
          centre,
          from: placeAt(s * 0.8, c.from.rot * deg, centre, [c.from.x * W, c.from.y * H]),
          at: placeAt(s, c.rot * deg, centre, [c.x * W, c.y * H]),
        };
      }
    }

    // where they land: the media boxes of the service cards (desktop: inside this stage)
    const docked = {};
    if (mode === 'scroll' && el.services) {
      const sr = stage.getBoundingClientRect();
      const fit = (key, w, h, centre) => {
        const r = docks[key].getBoundingClientRect();
        const s = Math.min(r.width / w, r.height / h);
        return placeAt(s, 0, centre, [r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2]);
      };
      docked.engine = fit('engine', ENGINE_BOX.w, ENGINE_BOX.h, ENGINE_C);
      for (const key of ['brake', 'filter']) {
        const b = boxOf(PARTS[key].box);
        docked[key] = fit(key, b.w, b.h, [b.w / 2, b.h / 2]);
      }
    }

    const trackTop = track.getBoundingClientRect().top + window.scrollY;
    G = { cover, cam0, camScan, camEngine, mobileFromCar, rigProduct, rigExploded, parts, docked, trackTop };
  }

  // ---------- render ----------
  const show = (n, v) => {
    if (!n) return;
    n.style.opacity = v;
    n.style.visibility = v <= 0 ? 'hidden' : 'visible';
  };

  function progress() {
    const scrollable = track.offsetHeight - H;
    return scrollable > 0 ? Math.min(1, Math.max(0, (sy - G.trackTop) / scrollable)) : 0;
  }

  function render() {
    const p = progress();
    const desktop = mode === 'scroll';

    // ----- camera: the opening frame -> the front axle -> the engine under the bonnet
    const c1 = easeInOut(range(p, ...T.push1));
    const c2 = easeInOut(range(p, ...T.push2));
    const cam = c2 > 0 ? mix(G.camScan, G.camEngine, c2, L.engineAt.q) : mix(G.cam0, G.camScan, c1, L.scanAt.q);
    el.car.style.transform = matrix(cam);
    const carAlpha = 1 - smooth(range(p, ...T.carOut));

    // ----- the opening
    if (desktop) {
      // a light passes over the dark car, left to right
      const r = easeInOut(range(p, ...T.reveal));
      const at = lerp(-12, 124, r);
      el.layers.reveal.style.maskImage = el.layers.reveal.style.webkitMaskImage = `linear-gradient(105deg, transparent ${(at - 22).toFixed(2)}%, #000 ${at.toFixed(2)}%)`;
      show(el.layers.reveal, r < 1 ? 1 : 0);
      el.sweep.style.background = `linear-gradient(105deg, transparent ${(at - 9).toFixed(2)}%, rgba(244, 243, 239, 0.16) ${(at - 2).toFixed(2)}%, transparent ${(at + 3).toFixed(2)}%)`;
      show(el.sweep, r > 0 && r < 1 ? Math.sin(r * Math.PI) : 0);
      show(el.layers.hero, carAlpha);
    } else {
      // the portrait photo moves in with the car, then hands over to it
      const k = smooth(range(p, ...T.toCar));
      el.still.style.transform = matrix(compose(cam, G.mobileFromCar));
      show(el.still, 1 - k);
      show(el.layers.hero, k * carAlpha);
    }

    // ----- the scan: a cold line crosses the bodywork; behind it, the car is lines
    const sc = easeInOut(range(p, ...T.scan));
    const dx = lerp(SCAN_FROM, 0, sc);
    const scanOn = p >= T.scan[0];
    const wire = desktop ? smooth(range(p, ...T.wire)) : 0;
    const cut = smooth(range(p, ...T.cut));
    el.layers.scan.style.clipPath = sc < 1 ? planeClip(dx) : 'none';
    show(el.layers.scan, scanOn && wire < 1 && cut < 1 ? carAlpha : 0);
    const lineAlpha = scanOn ? smooth(range(p, T.scan[0], T.scan[0] + 0.015)) * (1 - smooth(range(p, ...T.scanOut))) : 0;
    show(el.scanLine, lineAlpha * carAlpha);
    if (lineAlpha > 0) {
      const d = planePath(dx, CORE);
      el.scanPaths.forEach((path) => path.setAttribute('d', d));
    }
    if (desktop) show(el.layers.wireframe, cut < 1 ? wire * carAlpha : 0);
    show(el.layers.cutaway, cut * carAlpha);
    el.car.style.visibility = carAlpha <= 0 ? 'hidden' : 'visible';

    // ----- the engine: takes over from the one in the cutaway, then moves to the centre
    const studio = smooth(range(p, ...T.studioIn));
    const panel = desktop ? easeInOut(range(p, ...T.panel)) : 0;
    show(el.studio, studio * lerp(1, 0.4, panel));
    const eIn = smooth(range(p, ...T.engineIn));
    const eOut = easeInOut(range(p, ...T.engineOut));
    const open = easeInOut(range(p, ...T.explode)) * (1 - easeInOut(range(p, ...T.rejoin)));
    const dockT = desktop ? easeInOut(range(p, ...T.dock)) : 0;
    let rig = mix(compose(cam, ENGINE_IN_CAR), G.rigProduct, eOut, ENGINE_C);
    if (open > 0) rig = mix(rig, G.rigExploded, open, [ENGINE_C[0], lerp(ENGINE_C[1], EXPLODED_CY, open)]);
    if (dockT > 0) rig = mix(rig, G.docked.engine, dockT, ENGINE_C);
    el.rig.style.transform = matrix(rig);
    el.rig.style.visibility = eIn > 0 ? 'visible' : 'hidden';
    const split = smooth(range(p, ...T.split)) * (1 - smooth(range(p, ...T.merge)));
    el.engine.style.opacity = eIn * (1 - split);
    for (const g of GROUPS) {
      const img = el.groups[g.key];
      img.style.opacity = split;
      img.style.visibility = split > 0 ? 'visible' : 'hidden';
      img.style.transform = matrix(shift(g.place, g.spread[0] * open, g.spread[1] * open));
    }

    // ----- the brake and the filter: two more groups, then into their cards
    if (desktop) {
      const pin = easeOut(range(p, ...T.partsIn));
      for (const [key, part] of Object.entries(G.parts)) {
        let pose = mix(part.from, part.at, pin, part.centre);
        if (dockT > 0) pose = mix(pose, G.docked[key], dockT, part.centre);
        el.parts[key].style.transform = matrix(pose);
        show(el.parts[key], smooth(range(p, T.partsIn[0], T.partsIn[0] + 0.03)));
      }
      const lead = windowed(p, ...T.leaders);
      for (const [key, line] of Object.entries(el.leaders)) {
        line.style.opacity = lead;
        if (lead <= 0) continue;
        const b = boxOf(PARTS[key].box);
        const pose = mix(G.parts[key].from, G.parts[key].at, pin, G.parts[key].centre);
        const a = apply(pose, [key === 'brake' ? b.w * 0.97 : b.w * 0.03, b.h * 0.5]);
        const z = apply(rig, [key === 'brake' ? ENGINE_BOX.x + ENGINE_BOX.w * 0.06 : ENGINE_BOX.x + ENGINE_BOX.w * 0.95, ENGINE_C[1] + (key === 'brake' ? -40 : 60)]);
        const grow = lerp(0, 1, range(p, T.leaders[0], T.leaders[1]));
        line.setAttribute('x1', a[0].toFixed(1));
        line.setAttribute('y1', a[1].toFixed(1));
        line.setAttribute('x2', lerp(a[0], z[0], grow).toFixed(1));
        line.setAttribute('y2', lerp(a[1], z[1], grow).toFixed(1));
      }

      // ----- the services section: heading, then frames drawn, then the text as the parts land
      if (el.services) {
        el.services.style.visibility = panel > 0 ? 'visible' : 'hidden';
        el.services.style.setProperty('--head', easeOut(range(p, T.panel[0], T.panel[0] + 0.05)).toFixed(3));
        cards.forEach((card, i) => {
          card.style.setProperty('--draw', easeInOut(range(p, T.panel[0] + 0.01 + i * 0.015, T.panel[0] + 0.07 + i * 0.015)).toFixed(3));
          card.style.setProperty('--show', smooth(range(p, T.dock[1] - 0.04 + i * 0.008, T.dock[1] + i * 0.008)).toFixed(3));
        });
      }
    }

    // ----- copy: it keeps its place; it only fades
    const io = range(p, ...T.intro);
    show(el.intro, 1 - io);
    show(el.corner, 1 - io);
    el.shade.style.opacity = lerp(1, 0.55, io) * (1 - panel);
    el.steps.forEach((step, i) => {
      const v = windowed(p, ...T.steps[i]);
      show(step, v);
      step.style.transform = `translate3d(0, ${((1 - v) * 14).toFixed(1)}px, 0)`;
    });
    el.cue.style.opacity = 1 - range(p, ...T.cue);
    el.cue.style.visibility = p > T.cue[1] ? 'hidden' : 'visible';
    el.bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (desktop) show(el.rail, 1 - smooth(range(panel, 0, 0.5)));
    const ch = T.chapters.filter((c) => p >= c).length;
    if (ch !== chapter) {
      chapter = ch;
      el.chapters.forEach((li, i) => li.classList.toggle('is-active', i === ch));
    }
  }

  // ---------- loop ----------
  function frame() {
    raf = 0;
    const diff = target - sy;
    // long jumps (anchor links, hash on arrival) land at once instead of crawling through the scene
    sy = Math.abs(diff) < 0.5 || Math.abs(diff) > H * 1.5 ? target : sy + diff * SMOOTH;
    render();
    if (sy !== target) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && mode !== 'static') raf = requestAnimationFrame(frame);
  }

  // ---------- modes ----------
  const STYLED = () => [
    el.still, el.studio, el.car, ...Object.values(el.layers), el.sweep, el.scanLine, el.shade, el.intro, el.corner, el.cue, el.rail,
    ...el.steps, el.bar, el.rig, el.engine, ...Object.values(el.groups), ...Object.values(el.parts), ...Object.values(el.leaders),
    el.services, ...cards,
  ];
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    root.classList.remove('hero-scroll', 'hero-compact', 'hero-static');
    root.classList.add(`hero-${mode}`);
    root.classList.toggle('motion-ok', !media.reduced.matches);
    STYLED().forEach((n) => n?.removeAttribute('style'));
    // desktop: the services section is the last state of the scene; elsewhere it follows the hero
    if (el.services) {
      if (mode === 'scroll') el.slot.append(el.services);
      else if (el.services.parentElement !== track.parentElement) track.after(el.services);
    }
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    chapter = -1;
    if (mode === 'static') {
      root.classList.remove('hero-live');
      return;
    }
    T = TIMELINE[mode];
    L = LAYOUT[mode];
    root.classList.add('hero-live'); // hidden-until-animated states only apply from here
    placeLayers();
    if (loaded) {
      loaded = false;
      loadScene();
    }
    refresh();
  }
  function refresh() {
    if (mode === 'static') return;
    measure();
    target = sy = window.scrollY;
    render();
  }

  api = (target) => {
    if (mode !== 'scroll' || !target) return null;
    if (target.id === 'top') return 0;
    if (!stage.contains(target)) return null;
    const top = track.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + (track.offsetHeight - window.innerHeight) * SERVICES_AT);
  };

  setMode(currentMode());

  // the rest of the scene loads once the page has (or on the first scroll, whichever comes first)
  const startLoading = () => mode !== 'static' && loadScene();
  if (document.readyState === 'complete') startLoading();
  else window.addEventListener('load', startLoading, { once: true });

  window.addEventListener(
    'scroll',
    () => {
      startLoading();
      target = window.scrollY;
      kick();
    },
    { passive: true },
  );
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = currentMode();
      if (next !== mode) {
        setMode(next);
        startLoading();
      } else refresh();
    }, 120);
  });
  const onMedia = () => {
    setMode(currentMode());
    startLoading();
  };
  media.reduced.addEventListener?.('change', onMedia);
  media.wide.addEventListener?.('change', onMedia);
  window.addEventListener('load', refresh, { once: true });
  document.fonts?.ready.then(refresh);
  const content = document.querySelector('#content');
  if (content && 'ResizeObserver' in window) {
    let last = 0;
    new ResizeObserver(() => {
      const h = content.offsetHeight;
      if (Math.abs(h - last) > 2) {
        last = h;
        refresh();
      }
    }).observe(content);
  }
}
