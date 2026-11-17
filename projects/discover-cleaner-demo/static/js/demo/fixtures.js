// Web demo only: lazy loader for the JSON fixtures written by dev/build_web_demo.py.
//
// Fixtures live next to index.html under fixtures/ (relative URLs, so the demo works under any
// base path). They are stored gzipped (<name>.json.gz) and inflated here with the browser's
// DecompressionStream; a host that already decoded them (Content-Encoding) is handled too.
// Each file is fetched once per page and shared; callers must not mutate what they get.

const realFetch = window.fetch.bind(window);
const CFG = (window.APP_CONFIG && window.APP_CONFIG.webDemo) || {};
const BASE = new URL(CFG.fixtures || 'fixtures/', document.baseURI);
const cache = new Map();

export class FixtureError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'FixtureError';
    this.status = status;
  }
}

async function inflate(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') {
      throw new FixtureError('This browser is too old for the demo’s data. Try a current Chrome, Edge, Firefox or Safari.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}

/** load('reports/week/2026-09-28.json') → parsed JSON (fetched once). */
export function load(rel) {
  let p = cache.get(rel);
  if (!p) {
    const url = new URL(`${rel}.gz${CFG.version ? `?v=${encodeURIComponent(CFG.version)}` : ''}`, BASE);
    p = realFetch(url, { credentials: 'same-origin' }).then(async (res) => {
      if (!res.ok) throw new FixtureError(`The demo’s data file ${rel} is missing (${res.status}).`, res.status);
      return JSON.parse(await inflate(await res.arrayBuffer()));
    });
    p.catch(() => cache.delete(rel));   // a failed load may be retried
    cache.set(rel, p);
  }
  return p;
}

/** Start loading files the first screens need, without waiting for them. */
export function warm(...rels) {
  rels.forEach((r) => load(r).catch(() => {}));
}
