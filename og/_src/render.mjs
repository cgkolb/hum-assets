/**
 * render.mjs — builds the website's Open Graph cards (1200 × 630 JPEGs) into ../
 *
 *   node og/_src/render.mjs            render every card
 *   node og/_src/render.mjs home calc  render only the named cards
 *
 * Low-text style: one idea per card, a few huge words, one visual, and nothing
 * smaller than about 56px. Cards show 264–375px wide on phones (a quarter of
 * their real size), so anything smaller can't be read there. No eyebrow,
 * subhead or web address: every platform prints the page title and domain
 * next to the image already. Built on the HUM design system's Website layer
 * (Teal Faint ground, DM Sans 900, link-teal accent, no pink).
 *
 * Images are referenced by the site as
 *   https://raw.githubusercontent.com/cgkolb/hum-assets/main/og/<name>.jpg
 * so a card's name is part of the live URL: rename one only together with the
 * page that points at it. Pushing a re-rendered card to main changes the live
 * share image at once.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ASSETS = process.env.ASSETS || join(SRC, '..', '..');
const OUT = process.env.OUT || join(SRC, '..');
const TMP = join(OUT, '.tmp-render');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const a = (p) => 'file://' + join(ASSETS, p);

const SCREENS = {
  earnings: 'app-screens/app-4-earnings.webp',
  chat: 'app-screens/app-2-private-ride-chat.webp',
  clients: 'app-screens/app-6-client-list.webp',
  map: 'app-screens/app-5-live-trip-map.webp',
  history: 'app-screens/app-3-ride-history.webp',
};
const TIERS = ['Sedan', 'XL', 'Lux', 'Lux XL'];

// h: black headline lines, ht: teal line(s), fs: headline px, w: headline box width.
const CARDS = [
  { name: 'home', h: 'Your clients.<br>Your rates.', ht: 'Your business.', fs: 100, phone: 'chat' },
  { name: 'driver', h: 'Keep 100%', ht: 'of the fare.', fs: 124, phone: 'earnings' },
  { name: 'private-drivers', h: 'You built the business.', ht: 'We carry the rest.', fs: 96, phone: 'clients' },
  { name: 'start-driving', h: 'Your vehicle.<br>Your clients.', ht: 'Your rates.', fs: 100, phone: 'history' },
  { name: 'qualify', h: 'Can you drive', ht: 'with HUM?', fs: 116, phone: 'map' },
  { name: 'how-it-works', h: 'Private rides,', ht: 'done legally.', fs: 112, phone: 'chat' },
  { name: 'calculator', stat: '~4x', sl: 'more per trip,<br>on average', phone: 'earnings' },
  { name: 'annual', stat: '10 → 12', sl: 'Two months free.', phone: 'history' },
  { name: 'plans', h: 'Pick your', ht: 'plan.', fs: 124, tiers: TIERS },
  { name: 'plans-weekly', h: 'Pick your', ht: 'weekly plan.', fs: 92, tiers: TIERS },
  ...TIERS.flatMap((k) => {
    const slug = k.toLowerCase().replace(' ', '');
    return [
      { name: `${slug}-checkout`, h: 'Your membership', ht: 'is ready.', fs: 100, tier: k },
      { name: `${slug}-weekly`, h: 'Your weekly plan', ht: 'is ready.', fs: 100, tier: k },
    ];
  }),
  { name: 'rideshareprofessor', creator: 'The Rideshare Professor', code: 'PROFESSOR50',
    photo: 'photos/creators/rideshare-professor.jpg' },
];

const icon = (n) => `<img class="ico" src="${a(`icons/phosphor-fill/${n}-fill.svg`)}" alt="">`;
const CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:'DM Sans',sans-serif;color:#0D0D0D;position:relative;background:#F0FBF7}
.dots{position:absolute;inset:0;background-image:radial-gradient(#A9DCD2 2.4px,transparent 2.6px);background-size:24px 24px;
  -webkit-mask-image:radial-gradient(ellipse 70% 90% at 85% 25%,#000 0%,transparent 75%)}
.logo{position:absolute;left:64px;top:56px;height:62px}
h1{position:absolute;left:64px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding-top:60px;
  font-weight:900;line-height:.98;letter-spacing:-.025em;text-wrap:balance}
h1 span,.t{color:#2A6B62}
.phone{position:absolute;right:70px;top:36px;height:640px;filter:drop-shadow(0 18px 30px rgba(13,13,13,.16))}
.circ{border-radius:50%;background:#F0FBF7;display:flex;align-items:center;justify-content:center}
.ico{width:58%;height:58%;filter:invert(32%) sepia(23%) saturate(1089%) hue-rotate(122deg) brightness(92%) contrast(88%)}
.tiers{position:absolute;right:64px;top:70px;display:grid;grid-template-columns:230px 230px;gap:20px}
.tc{background:#fff;border:1px solid #E2E6E5;border-radius:22px;height:225px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.tc .circ{width:92px;height:92px}.tc b{font-size:46px;font-weight:900}
.tier{position:absolute;right:64px;top:90px;width:400px;height:450px;background:#fff;border:1px solid #E2E6E5;border-radius:24px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
.tier .circ{width:150px;height:150px}.tier b{font-size:84px;font-weight:900;line-height:1;letter-spacing:-.02em}
.stat{position:absolute;left:64px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding-top:60px}
.stat b{font-size:250px;font-weight:900;line-height:.85;letter-spacing:-.04em}
.stat b.long{font-size:190px}
.stat span{font-size:64px;font-weight:800;line-height:1.02;color:#2A6B62;margin-top:18px;letter-spacing:-.01em}
body.creator{background:#F8F8F8}
.photo{position:absolute;left:60px;top:40px;width:440px;height:550px;border-radius:18px;object-fit:cover}
.cc{position:absolute;left:560px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:14px}
.cc .off{font-size:150px;font-weight:900;line-height:.85;letter-spacing:-.04em}
.cc .m{font-size:60px;font-weight:800;line-height:1;letter-spacing:-.01em}
.code{align-self:flex-start;margin-top:14px;border:4px dashed #0D0D0D;border-radius:14px;background:#fff;padding:10px 26px;font-size:58px;font-weight:900;letter-spacing:.04em}
.cc .by{font-size:44px;font-weight:700;color:#2A6B62;margin-top:10px}
`;

function page(c) {
  if (c.creator) {
    return wrapDoc(`<img class="photo" src="${a(c.photo)}" alt="">
<div class="cc"><div class="off">50% off</div><div class="m">your first month</div><div class="code">${c.code}</div><div class="by">From ${c.creator}</div></div>`, 'creator');
  }
  let body = `<div class="dots"></div><img class="logo" src="${a('black-teal-logo.png')}" alt="">`;
  if (c.stat) {
    body += `<div class="stat"><b class="${c.stat.length > 4 ? 'long' : ''}">${c.stat}</b><span>${c.sl}</span></div>`;
  } else {
    body += `<h1 style="font-size:${c.fs}px;width:${c.phone ? 680 : 570}px">${c.h}<span>${c.ht}</span></h1>`;
  }
  if (c.phone) body += `<img class="phone" src="${a(SCREENS[c.phone])}" alt="">`;
  if (c.tiers) body += `<div class="tiers">${c.tiers.map((k) => `<div class="tc"><div class="circ">${icon('car-profile')}</div><b>${k}</b></div>`).join('')}</div>`;
  if (c.tier) body += `<div class="tier"><div class="circ">${icon('car-profile')}</div><b>${c.tier}</b></div>`;
  return wrapDoc(body, '');
}

function wrapDoc(body, cls) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800;9..40,900&display=block" rel="stylesheet">
<style>${CSS}</style></head><body class="${cls}">${body}</body></html>`;
}

const only = process.argv.slice(2);
mkdirSync(TMP, { recursive: true });
for (const c of CARDS) {
  if (only.length && !only.includes(c.name)) continue;
  const html = join(TMP, `${c.name}.html`);
  const png = join(TMP, `${c.name}.png`);
  writeFileSync(html, page(c));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--window-size=1200,630', '--virtual-time-budget=6000',
    `--screenshot=${png}`, 'file://' + html], { stdio: 'ignore' });
  if (!existsSync(png)) throw new Error(`no screenshot for ${c.name}`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', png, '--out', join(OUT, `${c.name}.jpg`)], { stdio: 'ignore' });
  console.log(`og/${c.name}.jpg`);
}
rmSync(TMP, { recursive: true, force: true });
