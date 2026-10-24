#!/usr/bin/env node
/**
 * prepare-game.mjs
 *
 * Obtains the single-file game HTML, verifies it, injects the
 * ultra-high-performance preamble and writes dist/index.html, which Tauri
 * embeds into the native application.
 *
 * The payload is large (~86 MB) and is never committed to this repository.
 *
 * Source precedence (highest first):
 *   GAME_LOCAL   path to an HTML file already on disk
 *   GAME_URL     direct download URL
 *   game.lock.json -> url
 *
 * Other env:
 *   GAME_SHA256      expected sha256 (overrides game.lock.json -> sha256)
 *   SKIP_SHA_CHECK   "1" to download without verifying
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(ROOT, '.game-cache');
const OUT_DIR = resolve(ROOT, 'dist');
const OUT_FILE = resolve(OUT_DIR, 'index.html');
const PREAMBLE_FILE = resolve(ROOT, 'scripts/perf-preamble.js');
const LOCK_FILE = resolve(ROOT, 'game.lock.json');

const log = (...a) => console.log('[prepare-game]', ...a);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

const env = (k) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : '';
};

class Fail extends Error {}

function loadLock() {
  if (!existsSync(LOCK_FILE)) throw new Fail(`missing ${LOCK_FILE}`);
  try {
    return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch (e) {
    throw new Fail(`game.lock.json is not valid JSON: ${e.message}`);
  }
}

const lock = loadLock();
const GAME_URL = env('GAME_URL') || (lock.url || '').trim();
const EXPECTED_SHA = (env('GAME_SHA256') || lock.sha256 || '').trim().toLowerCase();
const FILENAME = (lock.filename || 'game.html').replace(/[^A-Za-z0-9._-]/g, '_');
const CACHE_FILE = resolve(CACHE_DIR, FILENAME);

const NO_SOURCE_HELP = `
No game payload source is configured.

  ${lock.name || 'game'} is built in the browser by ${lock.source || 'the upstream site'},
  so there is no fixed download URL to hard-code.

Pick one:

  1. Host the HTML and set the URL
       - open ${lock.source || 'the site'} and use its offline / download option
       - upload the resulting .html as a GitHub release asset
       - put the link in game.lock.json -> "url"
         or define a repository variable named GAME_URL
         (Settings > Secrets and variables > Actions > Variables)

  2. Build from a local copy
       GAME_LOCAL=/path/to/game.html npm run dmg
`.trim();

async function download(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Fail(`GAME_URL / game.lock.json url is not a valid URL: ${url}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Fail(`refusing to download over ${parsed.protocol} (use http or https): ${url}`);
  }

  log('downloading', url);
  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'source-26-3-desktop/1.0 (+tauri build)' },
    });
  } catch (e) {
    throw new Fail(`network error fetching ${url}: ${e.message}`);
  }
  if (!res.ok) throw new Fail(`HTTP ${res.status} ${res.statusText} for ${url}`);
  if (!res.body) throw new Fail(`empty response body for ${url}`);

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype && !/html|octet-stream|text\/plain/.test(ctype)) {
    log(`WARNING: unexpected content-type "${ctype}" — continuing anyway`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  const chunks = [];
  let got = 0;
  let nextTick = 16 * 1048576;
  for await (const chunk of res.body) {
    chunks.push(chunk);
    got += chunk.length;
    if (got >= nextTick) {
      log(`  ${mb(got)}${total ? ' / ' + mb(total) : ''}`);
      nextTick = got + 16 * 1048576;
    }
  }
  if (got === 0) throw new Fail(`downloaded 0 bytes from ${url}`);
  return Buffer.concat(chunks);
}

async function getGameHtml() {
  const local = env('GAME_LOCAL');
  if (local) {
    const p = resolve(local);
    if (!existsSync(p)) throw new Fail(`GAME_LOCAL points at a file that does not exist: ${p}`);
    log('using local game file', p);
    return readFileSync(p);
  }

  if (!GAME_URL) throw new Fail(NO_SOURCE_HELP);

  if (existsSync(CACHE_FILE)) {
    const cached = readFileSync(CACHE_FILE);
    const h = sha256(cached);
    if (!EXPECTED_SHA || h === EXPECTED_SHA || env('SKIP_SHA_CHECK') === '1') {
      log(`cache hit ${CACHE_FILE} (${mb(cached.length)})`);
      return cached;
    }
    log('cache checksum mismatch — re-downloading');
  }

  const buf = await download(GAME_URL);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, buf);
  return buf;
}

function verify(buf) {
  const actual = sha256(buf);
  log('sha256', actual, `(${mb(buf.length)})`);

  if (env('SKIP_SHA_CHECK') === '1') {
    log('WARNING: checksum verification skipped (SKIP_SHA_CHECK=1)');
  } else if (!EXPECTED_SHA) {
    log('WARNING: no sha256 pinned. Pin this to make builds reproducible:', actual);
  } else if (actual !== EXPECTED_SHA) {
    throw new Fail(
      `Checksum mismatch for the game payload.\n` +
        `  expected ${EXPECTED_SHA}\n` +
        `  actual   ${actual}\n` +
        `Refusing to bundle an unexpected payload. Update game.lock.json if this is intentional.`
    );
  } else {
    log('checksum OK');
  }
  return actual;
}

function verifySize(buf) {
  const expected = Number(lock.size || 0);
  if (!expected) return;
  if (buf.length !== expected) {
    throw new Fail(
      `Size mismatch for the game payload.\n` +
        `  expected ${expected} bytes\n` +
        `  actual   ${buf.length} bytes\n` +
        `This is a second integrity check for payloads that have no pinned sha256.\n` +
        `If the upstream file legitimately changed, update "size" in payloads.json.`
    );
  }
  log(`size OK (${expected} bytes)`);
}

function sanityCheckHtml(html) {
  const head = html.slice(0, 4096).toLowerCase();
  if (!head.includes('<html') && !head.includes('<!doctype html')) {
    throw new Fail(
      'The downloaded payload does not look like an HTML document.\n' +
        '  First bytes: ' + JSON.stringify(html.slice(0, 120))
    );
  }
  if (html.length < 1024 * 512) {
    log(`WARNING: payload is only ${mb(html.length)} — a full game build is usually tens of MB.`);
    log('         If this is a landing page rather than the offline build, fix the URL.');
  }
}

function inject(html) {
  if (!existsSync(PREAMBLE_FILE)) throw new Fail(`missing ${PREAMBLE_FILE}`);
  const js = readFileSync(PREAMBLE_FILE, 'utf8').replace(/<\/script/gi, '<\\/script');
  const tag = `<script id="jm263-perf-preamble">\n${js}\n</script>\n`;

  const headOpen = html.search(/<head\b[^>]*>/i);
  if (headOpen !== -1) {
    const end = html.indexOf('>', headOpen) + 1;
    return html.slice(0, end) + '\n' + tag + html.slice(end);
  }
  const htmlOpen = html.search(/<html\b[^>]*>/i);
  if (htmlOpen !== -1) {
    const end = html.indexOf('>', htmlOpen) + 1;
    return html.slice(0, end) + '\n' + tag + html.slice(end);
  }
  log('WARNING: no <head> or <html> tag found — prepending the preamble');
  return tag + html;
}

async function main() {
  const raw = await getGameHtml();
  verify(raw);
  verifySize(raw);

  let html = raw.toString('utf8');
  sanityCheckHtml(html);

  if (html.includes('id="jm263-perf-preamble"')) {
    log('preamble already present — not injecting twice');
  } else {
    html = inject(html);
    log('injected ultra-high-performance preamble');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf8');
  const size = statSync(OUT_FILE).size;
  if (size === 0) throw new Fail('wrote an empty dist/index.html');
  log('wrote', OUT_FILE, `(${mb(size)})`);
}

main().catch((err) => {
  console.error('\n[prepare-game] FAILED\n');
  console.error(err instanceof Fail ? err.message : err);
  console.error('');
  process.exit(1);
});
