// pnpm galaxy:shots — a screenshot of every scene of the arcade, at the three sizes it is checked
// at, and a report of the text in the screen too small to read on a phone held upright.
//
// It walks the demo galaxy from the keyboard, as a player would: the boot, the title's three
// phases, INSERT COIN, the simulated Google sign-in and GitHub link, the whole joining flow, the
// level-up (the demo guest's borrowed level, not yet celebrated in this browser), the menu and every
// screen behind it (the planet's four tabs each on its own, the star chart, a system and its reading
// card, the game room, and Entropy Invaders' score table, play and pause), then the welcome back.
// The page's clock is Playwright's, advanced step by step, so every screenshot is taken at the same
// moment of its scene on every run. Nothing here runs in `pnpm test`.
//
// Needs `pnpm galaxy:dev` running, and Playwright's Chromium installed once:
//   pnpm --filter @omni/galaxy-app exec playwright install chromium
// The screenshots land in apps/galaxy/shots/<width>x<height>/, which git ignores.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.GALAXY_URL ?? 'http://localhost:3000/'; // another dev server: GALAXY_URL=http://localhost:3001/
const OUT = fileURLToPath(new URL('../shots/', import.meta.url));
const SMALLEST = 8; // CSS px: the smallest text a player should have to read

const SIZES = [
  { name: '393x700', width: 393, height: 700, touch: true, report: true, what: 'upright touch, an iPhone with Safari\'s bars' },
  { name: '852x393', width: 852, height: 393, touch: true, what: 'sideways touch' },
  { name: '1440x900', width: 1440, height: 900, touch: false, what: 'a mouse' },
];

// Every screenshot, in walk order: the 24 scenes, with the title's phases, the planet's tabs, a
// system's reading card and Entropy Invaders' ready screen, play and pause each its own. The number
// in a file's name is its place here.
const SHOTS = [
  'boot', 'title', 'title-story', 'title-hiscore', 'coin', 'away', 'gate', 'link', 'intro', 'select', 'name', 'hero',
  'ready', 'levelup', 'menu', 'map', 'planet-status', 'planet-zones', 'planet-entropy', 'planet-log', 'chart', 'system',
  'system-card', 'fleets', 'heroes', 'games', 'invaders', 'invaders-play', 'invaders-paused', 'briefing', 'welcome', 'outsider',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── In the page ──────────────────────────────────────────────────────────────
// The screen is the element that carries the scene's class (`scene-title`); these run in the page.

function sceneInPage() {
  for (const el of document.querySelectorAll('[class*="scene-"]')) {
    for (const c of el.classList) if (/^scene-[a-z]+$/.test(c)) return c.slice('scene-'.length);
  }
  return null;
}

/** True once React has hydrated the screen: its canvas carries React's props. */
function hydratedInPage() {
  const canvas = document.querySelector('[class*="scene-"] canvas');
  return Boolean(canvas && Object.keys(canvas).some((k) => k.startsWith('__reactProps$')));
}

/**
 * Every element in the screen with text of its own, whose text renders below `min` CSS px: its
 * font size times every scale and zoom above it (the screen is scaled to fit its slot).
 */
function smallTextInPage(min) {
  const screen = [...document.querySelectorAll('[class*="scene-"]')]
    .find((el) => [...el.classList].some((c) => /^scene-[a-z]+$/.test(c)));
  if (!screen) return [];
  const scaleOf = (el) => {
    let k = 1;
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.transform && cs.transform !== 'none') {
        const m = new DOMMatrixReadOnly(cs.transform);
        k *= Math.hypot(m.c, m.d); // how much a vertical line grows: the text's height
      }
      if (cs.scale && cs.scale !== 'none') {
        const [x, y = x] = cs.scale.split(' ').map(Number);
        k *= y;
      }
      k *= parseFloat(cs.zoom) || 1; // a computed font size leaves zoom out
    }
    return k;
  };
  const found = [];
  for (const el of screen.querySelectorAll('*')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('')
      .replace(/\s+/g, ' ').trim();
    if (!text || !el.checkVisibility()) continue;
    const px = parseFloat(getComputedStyle(el).fontSize) * scaleOf(el);
    if (px < min) {
      const where = el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
      found.push({ px: Math.round(px * 10) / 10, where, text });
    }
  }
  return found;
}

// ── Driving one page ─────────────────────────────────────────────────────────
// The page's clock stands still from its first script on, and only the walk moves it, by the same
// steps on every run. React still renders in real time: every step lets it catch up before and
// after the clock moves, so each screenshot is taken at the same moment of its scene.

class WalkError extends Error {}

function driver(page, size, dir, small) {
  const scene = () => page.evaluate(sceneInPage);
  const catchUp = () => sleep(40);

  /** Moves the page's clock on by `ms`: a long wait jumps, its last half second plays frame by frame. */
  const hold = async (ms) => {
    await catchUp();
    if (ms > 1000) { await page.clock.fastForward(ms - 500); await catchUp(); ms = 500; }
    await page.clock.runFor(ms);
    await catchUp();
    await page.clock.runFor(40); // two more frames, drawn with what React has rendered
    await catchUp();
  };

  const expect = async (want, after) => {
    const now = await scene();
    if (now !== want) throw new WalkError(`${after} should show the ${want} scene; the arcade shows ${now ?? 'no scene'}`);
  };

  return {
    /** Presses a key, lets `ms` pass, and checks the arcade shows `want`. */
    async key(key, want, ms = 200) {
      await page.keyboard.press(key);
      await hold(ms);
      await expect(want, `pressing ${key}`);
    },
    /** Holds `keys` down together while `ms` pass, lets them go, and checks the arcade shows `want`. */
    async holdKeys(keys, want, ms) {
      for (const k of keys) await page.keyboard.down(k);
      await hold(ms);
      for (const k of keys) await page.keyboard.up(k);
      await expect(want, `holding ${keys.join(' and ')}`);
    },
    /** Lets `ms` pass, and checks the arcade shows `want`. */
    async wait(want, ms) {
      await hold(ms);
      await expect(want, `waiting ${ms} ms`);
    },
    /** Lets `ms` pass on scene `want`, saves the screenshot and measures its text. */
    async shot(name, want, ms) {
      await hold(ms);
      await expect(want, `the ${name} screenshot`);
      const file = `${dir}/${String(SHOTS.indexOf(name) + 1).padStart(2, '0')}-${name}.png`;
      // Finite CSS animations (a line typing in, a title zooming) are shown finished, and the
      // dev server's own badge is left out.
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', style: 'nextjs-portal { display: none !important; }' });
      if (size.report) for (const hit of await page.evaluate(smallTextInPage, SMALLEST)) small.push({ shot: name, ...hit });
      return name;
    },
  };
}

/** A fresh page on the arcade, on its boot, with its clock stopped. */
async function openArcade(context, errors) {
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  // The clock is installed stopped, and read by the page's very first script, before the page's
  // own time can run on: the page starts at the same tick, and draws on the same beat, every run.
  await page.clock.pauseAt(Date.now());
  await page.addInitScript(() => performance.now());
  await page.goto(BASE, { waitUntil: 'load', timeout: 120_000 });
  await Promise.race([page.evaluate(() => document.fonts.ready.then(() => true)), sleep(10_000)]);
  for (let waited = 0; !(await page.evaluate(hydratedInPage)); waited += 50) {
    if (waited > 60_000) throw new WalkError('the arcade never started: React did not hydrate the screen');
    await sleep(50);
  }
  await sleep(500); // its effects run: the keys are listened to, the game loop asks for frames
  return page;
}

// ── The walks ────────────────────────────────────────────────────────────────

/** A new guest, from the boot to the welcome back: every scene but `outsider`. */
async function walkGuest(d, taken) {
  const shot = async (...a) => taken.push(await d.shot(...a));
  await shot('boot', 'boot', 1500);
  await d.key('Enter', 'title');
  await shot('title', 'title', 2000);
  await shot('title-story', 'title', 21000); // the story from 14 s, its six lines in by 22.4 s
  await shot('title-hiscore', 'title', 5000); // the high scores from 26 s
  await d.key('Enter', 'coin'); // signed out: INSERT COIN
  await shot('coin', 'coin', 500);
  await d.key('a', 'coin'); // the demo's Google sign-in takes 1.4 s: the arcade is away meanwhile
  await shot('away', 'coin', 300);
  await d.wait('gate', 1000);
  await shot('gate', 'gate', 500);
  await d.key('Enter', 'link');
  await shot('link', 'link', 500);
  await d.key('a', 'link'); // the demo's GitHub link, 1.4 s away
  await d.wait('link', 1400);
  await d.key('Enter', 'intro');
  await shot('intro', 'intro', 16300); // the fleets are all in from 16 s
  await d.key('Enter', 'select');
  await shot('select', 'select', 500);
  await d.key('a', 'name', 2000); // the lock-in plays 1.8 s
  await shot('name', 'name', 500);
  await d.key('Enter', 'hero');
  await shot('hero', 'hero', 500);
  await d.key('Enter', 'ready');
  await shot('ready', 'ready', 2000);
  await d.key('Enter', 'levelup'); // the menu's first arrival: the guest's borrowed LV 3 is new here, and opened Entropy Invaders
  await shot('levelup', 'levelup', 1500);
  await d.key('b', 'menu'); // B: on to the menu, the level now celebrated in this browser
  await shot('menu', 'menu', 500);
  await d.key('Enter', 'map'); // the menu's first row: GALAXY MAP
  await shot('map', 'map', 800);
  await d.key('Enter', 'planet');
  await shot('planet-status', 'planet', 800);
  for (const tab of ['zones', 'entropy', 'log']) {
    await d.key('ArrowRight', 'planet');
    await shot(`planet-${tab}`, 'planet', 300);
  }
  await d.key('b', 'map');
  await d.key('b', 'menu');
  await d.key('ArrowDown', 'menu'); // the menu's second row: STAR CHART
  await d.key('Enter', 'chart');
  await shot('chart', 'chart', 800);
  await d.key('Enter', 'system'); // the product's system, on its first principle
  await d.key('ArrowDown', 'system');
  await d.key('ArrowDown', 'system'); // out to the rules' orbit: a rule, and the line to the principle it serves
  await shot('system', 'system', 800);
  await d.key('a', 'system'); // the reading card, over the system
  await shot('system-card', 'system', 300);
  await d.key('b', 'system');
  await d.key('b', 'chart');
  await d.key('b', 'menu');
  for (const row of ['fleets', 'heroes', 'games', 'briefing']) { // the menu's next four rows: the game room with the demo guest's borrowed XP
    await d.key('ArrowDown', 'menu');
    await d.key('Enter', row);
    await shot(row, row, 800);
    if (row === 'games') await walkInvaders(d, shot);
    await d.key('b', 'menu');
  }
  await d.key('b', 'title');
  await d.key('Enter', 'welcome'); // a player now: START on the title welcomes them back
  await shot('welcome', 'welcome', 1500);
}

/** From the game room: A on the lit cabinet, Entropy Invaders' ready screen, a moment of play, the pause, and back. */
async function walkInvaders(d, shot) {
  await d.key('Enter', 'invaders'); // the first cabinet, lit by the demo guest's borrowed XP
  await shot('invaders', 'invaders', 800); // the ready screen: the score table
  await d.key('a', 'invaders'); // A plays at once
  await d.holdKeys(['ArrowRight', 'a'], 'invaders', 1500); // fly right, firing
  await shot('invaders-play', 'invaders', 300);
  await d.key('Enter', 'invaders'); // START pauses
  await shot('invaders-paused', 'invaders', 300);
  await d.key('b', 'games'); // B from the pause: back to the room
}

// The demo's guest is always a @vertuoza.com account, so `outsider` (signed in from another domain)
// is out of its reach. This walk rewrites the guest in the page's scripts as it loads them.
const GUEST = /(["'])guest@vertuoza\.com\1([^}]*?\bcrew\s*:\s*)(?:true|!0)/;

async function asOutsider(context) {
  let found = false;
  await context.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (!GUEST.test(body)) return route.fulfill({ response });
    found = true;
    const headers = { ...response.headers() };
    delete headers['content-encoding'];
    delete headers['content-length'];
    return route.fulfill({ status: response.status(), headers, body: body.replace(GUEST, '$1guest@example.com$1$2false') });
  });
  return () => found;
}

/** A guest from another domain: signs in, comes back to the title, and presses START. */
async function walkOutsider(d, taken, rewritten) {
  await d.key('Enter', 'title');
  await d.key('Enter', 'coin');
  await d.key('a', 'coin');
  await d.wait('gate', 1400);
  await d.key('Enter', 'link');
  await d.key('b', 'menu');
  await d.key('b', 'title');
  try {
    await d.key('Enter', 'outsider');
  } catch (err) {
    if (!rewritten()) throw new WalkError('no script held the demo guest, so it could not sign in from another domain');
    throw err;
  }
  taken.push(await d.shot('outsider', 'outsider', 500));
}

// ── One size, then all of them ───────────────────────────────────────────────

async function shootSize(browser, size) {
  const dir = `${OUT}${size.name}`;
  mkdirSync(dir, { recursive: true });
  const taken = [], small = [], problems = [];
  const newContext = async () => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.touch ? 2 : 1,
      hasTouch: size.touch,
      isMobile: size.touch,
    });
    // The same random heroes on every run, so two runs' screenshots can be compared.
    await context.addInitScript(() => {
      let seed = 94;
      Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    });
    return context;
  };
  const errors = [];
  for (const [walk, prepare] of [[walkGuest, null], [walkOutsider, asOutsider]]) {
    const context = await newContext();
    try {
      const rewritten = prepare ? await prepare(context) : null;
      const page = await openArcade(context, errors);
      await walk(driver(page, size, dir, small), taken, rewritten);
    } catch (err) {
      // One walk stuck does not stop the others: what it missed is listed, and the run fails.
      problems.push(err instanceof WalkError ? err.message : `${err.name}: ${err.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
  const missed = SHOTS.filter((s) => !taken.includes(s));
  return { size, taken, missed, small, problems, errors };
}

function report(results) {
  let failed = false;
  for (const { size, taken, missed, problems, errors } of results) {
    console.log(`${size.name.padEnd(9)} ${String(taken.length).padStart(2)}/${SHOTS.length} screenshots (${size.what})`);
    if (missed.length) {
      failed = true;
      for (const p of problems) console.log(`          stopped: ${p}`);
      console.log(`          missed: ${missed.join(', ')}`);
    }
    for (const e of [...new Set(errors)]) console.log(`          page error: ${e}`);
  }
  console.log(`Saved under ${OUT}`);
  for (const { size, small, taken } of results.filter((r) => r.size.report)) {
    const screens = new Set(small.map((s) => s.shot));
    console.log(`\nText below ${SMALLEST} CSS px at ${size.name} (${size.what}): a report, not a failure.`);
    for (const shot of SHOTS.filter((s) => screens.has(s))) {
      for (const { px, where, text } of small.filter((s) => s.shot === shot)) {
        const said = text.length > 48 ? `${text.slice(0, 47)}…` : text;
        console.log(`  ${shot.padEnd(15)} ${px.toFixed(1).padStart(4)}px  ${where.padEnd(24)} "${said}"`);
      }
    }
    console.log(`${small.length} text element(s) below ${SMALLEST} CSS px in ${screens.size} of ${taken.length} screenshots.`);
  }
  return failed;
}

async function main() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`it answered ${res.status}`);
  } catch (err) {
    const why = err.cause?.code ?? err.message;
    console.error(`No arcade at ${BASE} (${why}). Start it with \`pnpm galaxy:dev\`, then run \`pnpm galaxy:shots\` again.`);
    return 1;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(`Chromium did not start: ${err.message.split('\n')[0]}`);
    console.error('Install Playwright\'s Chromium once: pnpm --filter @omni/galaxy-app exec playwright install chromium');
    return 1;
  }
  try {
    const results = [];
    for (const size of SIZES) results.push(await shootSize(browser, size));
    return report(results) ? 1 : 0;
  } finally {
    await browser.close();
  }
}

process.exitCode = await main();
