/**
 * render.mjs — builds the website's Open Graph cards (1200 × 630 JPEGs) into ../
 *
 *   node og/_src/render.mjs            render every card
 *   node og/_src/render.mjs home calc  render only the named cards
 *
 * Each card is an HTML page laid out on the HUM design system's Website layer
 * (Teal Faint ground, DM Sans, black 900 headline, link-teal eyebrow, app
 * screens as phone art, no pink), screenshotted with headless Chrome, then
 * converted to JPEG with macOS `sips`. Copy comes from the HUM OG Image Audit
 * and the Notion messaging docs; change copy in CARDS below, then re-render.
 *
 * Images are referenced by the site as
 *   https://raw.githubusercontent.com/cgkolb/hum-assets/main/og/<name>.jpg
 * so a card's name is part of the live URL: rename one only together with the
 * page that points at it.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(SRC, '..', '..');
const OUT = join(SRC, '..');
const TMP = join(SRC, '.tmp');
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

const CARDS = [
  { name: 'home', t: 'hero', eb: 'Private rides, done legally', h: 'Your clients. Your rates. Your business.',
    s: 'Drive private clients legally. Every ride you log is covered.', phones: ['chat', 'earnings'] },
  { name: 'driver', t: 'hero', eb: 'For Uber and Lyft drivers', h: 'Keep 100% of the fare. Set your own rate.',
    s: 'Drivers earn about 4x more per trip on average.', phones: ['earnings', 'chat'] },
  { name: 'private-drivers', t: 'hero', eb: 'For established private drivers', h: 'You built the business. We’ll carry the infrastructure.',
    s: 'Commercial coverage and compliance for roughly a tenth of carrying it alone.', phones: ['clients'] },
  { name: 'start-driving', t: 'hero', eb: 'Get started with HUM', h: 'Your vehicle. Your clients. Your rates.',
    s: 'Commercial coverage and compliance in one flat subscription.', phones: ['map', 'history'] },
  { name: 'qualify', t: 'hero', eb: 'Takes about a minute', h: 'Can you drive private clients with HUM?',
    s: 'Check your state and your vehicle.', phones: ['map'] },
  { name: 'calculator', t: 'stat', eb: 'Earnings calculator', st: '~4x', sl: 'more per trip than an Uber or Lyft trip, on average',
    h: 'What would one private ride a week add?', phones: ['earnings'] },
  { name: 'annual', t: 'stat', eb: 'For active HUM drivers', st: '10 → 12', sl: 'Pay for ten months, drive for twelve.',
    h: 'Get two months free.', phones: ['history'] },
  { name: 'plans', t: 'hero', eb: 'HUM plans', h: 'Pick the plan that matches your vehicle.',
    s: 'Commercial coverage and compliance, handled.', tiers: TIERS },
  { name: 'plans-weekly', t: 'hero', eb: 'HUM weekly plans', h: 'Pick the plan that matches your vehicle.',
    s: 'Commercial coverage and compliance, handled.', tiers: TIERS },
  ...TIERS.flatMap((k) => {
    const slug = k.toLowerCase().replace(' ', '');
    const base = { t: 'hero', h: `Your ${k} membership is ready.`,
      s: 'From your first logged ride, HUM’s commercial policy covers you.', tier: k };
    return [
      { ...base, name: `${slug}-checkout`, eb: `HUM ${k} membership` },
      { ...base, name: `${slug}-weekly`, eb: `HUM ${k} · weekly plan` },
    ];
  }),
  { name: 'rideshareprofessor', t: 'creator', eb: 'Recommended by The Rideshare Professor',
    h: 'Run your own private rides, at your own rates.', s: '50% off your first month with code', code: 'PROFESSOR50',
    photo: 'photos/creators/rideshare-professor.jpg' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (n) => `<img class="ico" src="${a(`icons/phosphor-fill/${n}-fill.svg`)}" alt="">`;

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:'DM Sans',sans-serif;color:#0D0D0D;position:relative;background:#F0FBF7}
.dots{position:absolute;inset:0;background-image:radial-gradient(#A9DCD2 2.4px,transparent 2.6px);background-size:24px 24px;
  -webkit-mask-image:radial-gradient(ellipse 70% 90% at 85% 25%,#000 0%,transparent 75%)}
.logo{position:absolute;left:64px;top:56px;height:50px}
.copy{position:absolute;left:64px;top:150px;width:640px}
.eb{font-size:21px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#2A6B62;margin-bottom:18px}
h1{font-size:64px;line-height:1.04;font-weight:900;letter-spacing:-.015em;text-wrap:balance}
.sub{font-size:28px;line-height:1.3;color:#333;margin-top:22px;max-width:600px;text-wrap:pretty}
.dom{position:absolute;left:64px;bottom:44px;font-size:22px;font-weight:600;color:#2A6B62}
.phones{position:absolute;right:40px;top:44px;bottom:0;width:440px}
.phones img{position:absolute;height:610px;filter:drop-shadow(0 18px 30px rgba(13,13,13,.16))}
.phones.one img{right:70px;top:0}
.phones.two img:nth-child(1){right:200px;top:80px;height:500px}
.twop .copy{width:580px}
.phones.two img:nth-child(2){right:0;top:0}
.tiers{position:absolute;right:64px;top:118px;display:grid;grid-template-columns:200px 200px;gap:18px}
.tc{background:#fff;border:1px solid #E2E6E5;border-radius:18px;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.tc b{font-size:30px;font-weight:800}
.circ{width:72px;height:72px;border-radius:50%;background:#F0FBF7;display:flex;align-items:center;justify-content:center}
.tc .circ{background:#F0FBF7}
.ico{width:58%;height:58%;filter:invert(32%) sepia(23%) saturate(1089%) hue-rotate(122deg) brightness(92%) contrast(88%)}
.tier{position:absolute;right:64px;top:110px;width:380px;height:410px;background:#fff;border:1px solid #E2E6E5;border-radius:18px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.tier .circ{width:120px;height:120px}
.tier b{font-size:64px;font-weight:900;line-height:1}
.tier span{font-size:20px;font-weight:700;letter-spacing:.18em;color:#2A6B62}
.stat{font-size:170px;font-weight:900;line-height:.9;letter-spacing:-.03em}
.stat.long{font-size:130px}
.sl{font-size:24px;font-weight:700;color:#2A6B62;margin-top:12px;max-width:640px;line-height:1.25}
.copy.statcopy{top:140px;width:660px}
.statcopy h1{font-size:42px;margin-top:22px;max-width:600px}
body.creator{background:#F8F8F8}
.photo{position:absolute;left:60px;top:40px;width:440px;height:550px;border-radius:18px;object-fit:cover}
.ccopy{position:absolute;left:556px;top:96px;width:580px}
.ccopy .eb2{font-size:24px;font-weight:700;color:#2A6B62;margin-bottom:18px}
.ccopy h1{font-size:58px}
.ccopy .sub{margin-top:26px}
.code{display:inline-block;margin-top:14px;border:3px dashed #0D0D0D;border-radius:12px;background:#fff;padding:10px 26px;font-size:36px;font-weight:900;letter-spacing:.06em}
.clogo{position:absolute;left:556px;bottom:48px;height:46px}
`;

function page(c) {
  let body = '';
  if (c.t === 'creator') {
    body = `<img class="photo" src="${a(c.photo)}" alt="">
<div class="ccopy"><div class="eb2">${esc(c.eb)}</div><h1>${esc(c.h)}</h1><div class="sub">${esc(c.s)}</div><div class="code">${esc(c.code)}</div></div>
<img class="clogo" src="${a('black-teal-logo.png')}" alt="">`;
    return wrapDoc(body, 'creator');
  }
  body += `<div class="dots"></div><img class="logo" src="${a('black-teal-logo.png')}" alt="">`;
  if (c.t === 'stat') {
    body += `<div class="copy statcopy"><div class="eb">${esc(c.eb)}</div><div class="stat${c.st.length > 4 ? ' long' : ''}">${esc(c.st)}</div><div class="sl">${esc(c.sl)}</div><h1>${esc(c.h)}</h1></div>`;
  } else {
    body += `<div class="copy"><div class="eb">${esc(c.eb)}</div><h1>${esc(c.h)}</h1><div class="sub">${esc(c.s)}</div></div>`;
  }
  body += `<div class="dom">humprivaterides.com</div>`;
  if (c.phones) body += `<div class="phones ${c.phones.length > 1 ? 'two' : 'one'}">${c.phones.map((p) => `<img src="${a(SCREENS[p])}" alt="">`).join('')}</div>`;
  if (c.tiers) body += `<div class="tiers">${c.tiers.map((k) => `<div class="tc"><div class="circ">${icon('car-profile')}</div><b>${esc(k)}</b></div>`).join('')}</div>`;
  if (c.tier) body += `<div class="tier"><div class="circ">${icon('car-profile')}</div><b>${esc(c.tier)}</b><span>MEMBERSHIP</span></div>`;
  return wrapDoc(body, c.phones && c.phones.length > 1 ? 'twop' : '');
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
