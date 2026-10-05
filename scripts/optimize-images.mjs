// Generates the web images (WebP) from the kit in automotives-sta-assets-animacao/. The kit's
// PNGs stay the source of truth; run `npm run images` after changing any of them (and
// `python3 scripts/register-scene.py` first if a car state, an engine group or a cut-out changed).
//
// - Photos get a few widths for srcset. The car states share one frame (register-scene.py), so
//   they keep the full 1672 x 941 canvas.
// - Cut-outs are cropped to their visible box (caixa_alpha); src/data/scene.json keeps the box,
//   so the scene can still place each crop on its original canvas.
// - Favicon, touch icon and the social image are drawn from the monogram, the logo and the hero.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KIT = 'automotives-sta-assets-animacao';
const OUT = 'src/assets/img';
const PUBLIC = 'public';
const BASE = '#08090B';

const photo = { quality: 80, effort: 6, smartSubsample: true };
const cutout = { quality: 84, alphaQuality: 90, effort: 6, smartSubsample: true };

await mkdir(OUT, { recursive: true });
const scene = JSON.parse(await readFile('src/data/scene.json', 'utf8'));
const report = [];
const src = (p) => path.join(KIT, p);
const boxOf = ([x0, y0, x1, y1]) => ({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });

async function write(input, name, width, options = photo, extract) {
  let img = sharp(input);
  if (extract) img = img.extract(extract);
  const info = await img.resize({ width, withoutEnlargement: true }).webp(options).toFile(path.join(OUT, name));
  report.push(`${name.padEnd(30)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(5)} ${(info.size / 1024).toFixed(0).padStart(4)} KB`);
}

// ---------- the car states (one shared frame) ----------
for (const [file, slug, widths] of [
  ['01-hero/hero-desktop.png', 'hero', [1672, 1200, 800]],
  ['01-hero/reveal-escuro.png', 'reveal', [1672, 1200, 800]],
  ['02-animacao/carro-scan.png', 'scan', [1672, 1200]],
  ['02-animacao/carro-wireframe.png', 'wireframe', [1672, 1200]],
  ['02-animacao/carro-cutaway.png', 'cutaway', [1672, 1200]],
  ['01-hero/fundo-estudio.png', 'studio', [1672, 960]],
]) {
  for (const w of widths) await write(src(file), `${slug}-${w}.webp`, w);
}
for (const w of [940, 720]) await write(src('01-hero/hero-mobile.png'), `hero-mobile-${w}.webp`, w);

// ---------- section photos ----------
for (const [file, slug] of [
  ['04-secoes/diagnostico-tablet.png', 'approach'],
  ['04-secoes/precisao-mecanico.png', 'craft'],
  ['04-secoes/carro-contato.png', 'contact'],
]) {
  for (const w of [1672, 1000]) await write(src(file), `${slug}-${w}.webp`, w);
}

// ---------- engine: assembled + the three groups, cut to their boxes ----------
const engine = scene.engine;
const ebox = boxOf(engine.box);
for (const w of [ebox.width, 640]) await write(src('02-animacao/motor-montado-transparente.png'), `engine-${w}.webp`, w, cutout, ebox);
for (const [key, g] of Object.entries(engine.groups)) {
  const box = boxOf(g.box);
  for (const w of new Set([box.width, Math.min(640, box.width)])) await write(src(g.file), `group-${key}-${w}.webp`, w, cutout, box);
}

// ---------- service parts (the kit's suspension strut is an extra for confirmed repairs; not used yet) ----------
for (const key of ['brake', 'filter']) {
  const p = scene.parts[key];
  const box = boxOf(p.box);
  for (const w of [box.width, 640]) await write(src(p.file), `${key}-${w}.webp`, w, cutout, box);
}

// ---------- brand ----------
const logoBox = boxOf(scene.parts.logo.box);
for (const w of [1024, 520]) await write(src(scene.parts.logo.file), `logo-${w}.webp`, w, { ...cutout, quality: 92, alphaQuality: 100 }, logoBox);
const monoBox = boxOf(scene.parts.monogram.box);
await write(src(scene.parts.monogram.file), 'monogram-520.webp', 520, { ...cutout, quality: 92, alphaQuality: 100 }, monoBox);

// favicon + touch icon: the monogram, centred on the base colour
async function icon(size, file, pad) {
  const inner = Math.round(size * (1 - pad * 2));
  const mono = await sharp(src(scene.parts.monogram.file)).extract(monoBox).resize({ width: inner, height: inner, fit: 'inside' }).png().toBuffer();
  const meta = await sharp(mono).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: BASE } })
    .composite([{ input: mono, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, file));
  report.push(`${('public/' + file).padEnd(30)} ${size}x${size}`);
}
await icon(64, 'favicon.png', 0.06);
await icon(180, 'apple-touch-icon.png', 0.12);

// social image: the hero, the logo top left, a red rule along the bottom
{
  const W = 1200;
  const H = 630;
  const hero = await sharp(src('01-hero/hero-desktop.png')).resize({ width: W, height: H, fit: 'cover', position: 'centre' }).toBuffer();
  const logo = await sharp(src(scene.parts.logo.file)).extract(logoBox).resize({ width: 360 }).png().toBuffer();
  const rule = await sharp({ create: { width: W, height: 6, channels: 4, background: '#E63B32' } }).png().toBuffer();
  const info = await sharp(hero)
    .composite([
      { input: logo, left: 56, top: 52 },
      { input: rule, left: 0, top: H - 6 },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(PUBLIC, 'og-image.jpg'));
  report.push(`${'public/og-image.jpg'.padEnd(30)} ${W}x${H}  ${(info.size / 1024).toFixed(0)} KB`);
}

await writeFile(path.join(OUT, '.generated'), report.join('\n') + '\n');
console.log(report.join('\n'));
