# Trading Logo Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Figma community plugin + Cloudflare Worker backend that lets users search trading instrument tickers and insert their logos onto the canvas.

**Architecture:** Monorepo with two packages — `plugin/` (Figma plugin: iframe UI + sandbox code) and `worker/` (Cloudflare Worker: cascading logo search proxy with KV caching). Communication: UI → Worker via fetch, UI → Sandbox via postMessage.

**Tech Stack:** TypeScript, esbuild, pnpm workspaces, Cloudflare Workers/KV/R2, Figma Plugin API

---

## File Structure

### Worker (`worker/`)
| File | Responsibility |
|------|---------------|
| `worker/package.json` | Dependencies: wrangler, typescript, vitest |
| `worker/tsconfig.json` | TypeScript config targeting ES2022 |
| `worker/wrangler.toml` | Cloudflare Worker config with KV and R2 bindings |
| `worker/src/index.ts` | HTTP router: `/logo`, `/image/:key`, CORS headers |
| `worker/src/types.ts` | Shared types: `LogoResult`, `SourceModule`, `Env` |
| `worker/src/cascade.ts` | Waterfall search engine: tries sources in order, returns first hit |
| `worker/src/sources/tradingview.ts` | TradingView CDN logo fetcher |
| `worker/src/sources/coingecko.ts` | CoinGecko API logo fetcher |
| `worker/src/sources/clearbit.ts` | Clearbit Logo API fetcher (uses ticker→domain mapping) |
| `worker/src/sources/logodev.ts` | Logo.dev API fetcher |
| `worker/src/sources/github-crypto.ts` | GitHub crypto repos raw URL fetcher |
| `worker/src/ticker-domains.ts` | Static ticker→domain mapping for Clearbit/Logo.dev |
| `worker/tests/cascade.test.ts` | Tests for cascade logic |
| `worker/tests/sources/tradingview.test.ts` | Tests for TradingView source |
| `worker/tests/sources/coingecko.test.ts` | Tests for CoinGecko source |
| `worker/tests/sources/clearbit.test.ts` | Tests for Clearbit source |
| `worker/tests/sources/logodev.test.ts` | Tests for Logo.dev source |
| `worker/tests/sources/github-crypto.test.ts` | Tests for GitHub crypto source |
| `worker/tests/index.test.ts` | Tests for HTTP router |

### Plugin (`plugin/`)
| File | Responsibility |
|------|---------------|
| `plugin/package.json` | Dependencies: esbuild, @figma/plugin-typings |
| `plugin/tsconfig.json` | TypeScript config |
| `plugin/manifest.json` | Figma plugin manifest (name, id, UI entry point) |
| `plugin/src/code.ts` | Sandbox: message handler, image insertion, fallback creation |
| `plugin/src/ui/index.html` | HTML shell that loads bundled JS + CSS |
| `plugin/src/ui/ui.ts` | UI logic: search, debounce, preview, insert trigger |
| `plugin/src/ui/styles.css` | Plugin dialog styles |
| `plugin/esbuild.config.mjs` | Build config for code.ts and ui.ts bundles |

### Root
| File | Responsibility |
|------|---------------|
| `package.json` | pnpm workspace root |
| `pnpm-workspace.yaml` | Workspace packages definition |
| `.gitignore` | Node modules, dist, .superpowers |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.toml`
- Create: `plugin/package.json`, `plugin/tsconfig.json`, `plugin/manifest.json`
- Create: `plugin/esbuild.config.mjs`

- [ ] **Step 1: Create root workspace files**

Create `package.json`:
```json
{
  "name": "trading-logo-parser",
  "private": true,
  "scripts": {
    "dev:worker": "pnpm --filter worker dev",
    "dev:plugin": "pnpm --filter plugin dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'worker'
  - 'plugin'
```

Create `.gitignore`:
```
node_modules/
dist/
.wrangler/
.superpowers/
*.log
```

- [ ] **Step 2: Create worker package scaffolding**

Create `worker/package.json`:
```json
{
  "name": "worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

Create `worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests"]
}
```

Create `worker/wrangler.toml`:
```toml
name = "trading-logo-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "LOGO_CACHE"
id = "placeholder-fill-after-creating-namespace"

# Uncomment when ready to enable R2
# [[r2_buckets]]
# binding = "LOGO_IMAGES"
# bucket_name = "trading-logos"
```

- [ ] **Step 3: Create plugin package scaffolding**

Create `plugin/package.json`:
```json
{
  "name": "plugin",
  "private": true,
  "scripts": {
    "dev": "node esbuild.config.mjs --watch",
    "build": "node esbuild.config.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0",
    "@figma/plugin-typings": "^1.106.0"
  }
}
```

Create `plugin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `plugin/manifest.json`:
```json
{
  "name": "Trading Logo Parser",
  "id": "trading-logo-parser",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"]
}
```

Create `plugin/esbuild.config.mjs`:
```js
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

// Build sandbox code
const codeBuild = esbuild.build({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2020',
  ...(isWatch ? { plugins: [watchPlugin('code.js')] } : {}),
});

// Build UI code
const uiBuild = esbuild.build({
  entryPoints: ['src/ui/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  format: 'iife',
  target: 'es2020',
  ...(isWatch ? { plugins: [watchPlugin('ui-bundle.js')] } : {}),
});

function watchPlugin(name) {
  return {
    name: `watch-${name}`,
    setup(build) {
      build.onEnd(() => {
        buildHtml();
        console.log(`[${name}] rebuilt`);
      });
    },
  };
}

function buildHtml() {
  const htmlTemplate = fs.readFileSync('src/ui/index.html', 'utf8');
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');
  let js = '';
  try {
    js = fs.readFileSync('dist/ui-bundle.js', 'utf8');
  } catch {}

  const output = htmlTemplate
    .replace('<!-- STYLES -->', `<style>${css}</style>`)
    .replace('<!-- SCRIPT -->', `<script>${js}</script>`);

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/ui.html', output);
}

await Promise.all([codeBuild, uiBuild]);
buildHtml();
console.log('Build complete');

if (isWatch) {
  console.log('Watching for changes...');
  // esbuild watch keeps process alive
}
```

- [ ] **Step 4: Install dependencies**

Run:
```bash
cd /Users/uidesigner/Desktop/AI\ Projects/Trading-logo-images-parser-figma
pnpm install
```
Expected: lockfile created, node_modules populated in root, worker, and plugin.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold monorepo with plugin and worker packages"
```

---

## Task 2: Worker Types and Cascade Engine

**Files:**
- Create: `worker/src/types.ts`
- Create: `worker/src/cascade.ts`
- Create: `worker/tests/cascade.test.ts`

- [ ] **Step 1: Write the failing tests for cascade**

Create `worker/tests/cascade.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { searchCascade } from '../src/cascade';
import type { SourceModule, LogoResult } from '../src/types';

function makeSource(name: string, result: LogoResult | null): SourceModule {
  return {
    name,
    search: vi.fn().mockResolvedValue(result),
  };
}

describe('searchCascade', () => {
  it('returns the first source that finds a result', async () => {
    const sources = [
      makeSource('source-a', null),
      makeSource('source-b', {
        found: true,
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        imageUrl: 'https://example.com/aapl.png',
        source: 'source-b',
      }),
      makeSource('source-c', null),
    ];

    const result = await searchCascade('AAPL', undefined, sources);

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'source-b',
    });
    expect(sources[0].search).toHaveBeenCalledWith('AAPL', undefined);
    expect(sources[1].search).toHaveBeenCalledWith('AAPL', undefined);
    expect(sources[2].search).not.toHaveBeenCalled();
  });

  it('returns not-found when all sources fail', async () => {
    const sources = [
      makeSource('a', null),
      makeSource('b', null),
    ];

    const result = await searchCascade('XYZ', undefined, sources);

    expect(result).toEqual({
      found: false,
      ticker: 'XYZ',
      companyName: null,
    });
  });

  it('returns not-found with companyName from a source that recognized the ticker', async () => {
    const sources = [
      makeSource('a', null),
      makeSource('b', {
        found: false,
        ticker: 'XYZ',
        companyName: 'Xyz Corp',
      }),
      makeSource('c', null),
    ];

    const result = await searchCascade('XYZ', undefined, sources);

    expect(result).toEqual({
      found: false,
      ticker: 'XYZ',
      companyName: 'Xyz Corp',
    });
  });

  it('passes type parameter to sources', async () => {
    const sources = [
      makeSource('a', {
        found: true,
        ticker: 'BTC',
        companyName: 'Bitcoin',
        imageUrl: 'https://example.com/btc.png',
        source: 'a',
      }),
    ];

    await searchCascade('BTC', 'crypto', sources);

    expect(sources[0].search).toHaveBeenCalledWith('BTC', 'crypto');
  });

  it('skips sources that throw and continues cascade', async () => {
    const errorSource: SourceModule = {
      name: 'broken',
      search: vi.fn().mockRejectedValue(new Error('network error')),
    };
    const goodSource = makeSource('good', {
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'good',
    });

    const result = await searchCascade('AAPL', undefined, [errorSource, goodSource]);

    expect(result.found).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/cascade.test.ts`
Expected: FAIL — cannot resolve `../src/cascade` or `../src/types`

- [ ] **Step 3: Create types**

Create `worker/src/types.ts`:
```ts
export type InstrumentType = 'stock' | 'crypto' | 'forex' | 'commodity' | 'index';

export interface LogoFound {
  found: true;
  ticker: string;
  companyName: string;
  imageUrl: string;
  source: string;
}

export interface LogoNotFound {
  found: false;
  ticker: string;
  companyName: string | null;
}

export type LogoResult = LogoFound | LogoNotFound;

export interface SourceModule {
  name: string;
  search: (ticker: string, type?: InstrumentType) => Promise<LogoResult | null>;
}

export interface Env {
  LOGO_CACHE: KVNamespace;
  LOGO_IMAGES?: R2Bucket;
}
```

- [ ] **Step 4: Implement cascade**

Create `worker/src/cascade.ts`:
```ts
import type { LogoResult, SourceModule, InstrumentType } from './types';

export async function searchCascade(
  ticker: string,
  type: InstrumentType | undefined,
  sources: SourceModule[]
): Promise<LogoResult> {
  let bestCompanyName: string | null = null;

  for (const source of sources) {
    try {
      const result = await source.search(ticker, type);
      if (result === null) continue;

      if (result.found) {
        return result;
      }

      // Source recognized the ticker but had no image — remember the name
      if (result.companyName && !bestCompanyName) {
        bestCompanyName = result.companyName;
      }
    } catch {
      // Source threw — skip it, try next
      continue;
    }
  }

  return {
    found: false,
    ticker,
    companyName: bestCompanyName,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/cascade.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add worker/src/types.ts worker/src/cascade.ts worker/tests/cascade.test.ts
git commit -m "feat(worker): add types and cascade search engine"
```

---

## Task 3: TradingView Source

**Files:**
- Create: `worker/src/sources/tradingview.ts`
- Create: `worker/tests/sources/tradingview.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/sources/tradingview.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tradingviewSource } from '../../src/sources/tradingview';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('tradingviewSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo URL for a valid stock ticker', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'AAPL',
      imageUrl: expect.stringContaining('AAPL'),
      source: 'tradingview',
    });
  });

  it('returns null when TradingView returns 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await tradingviewSource.search('ZZZZZZ', 'stock');

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/sources/tradingview.test.ts`
Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement TradingView source**

Create `worker/src/sources/tradingview.ts`:
```ts
import type { SourceModule, LogoResult, InstrumentType } from '../types';

const TV_LOGO_BASE = 'https://s3-symbol-logo.tradingview.com';

function buildUrl(ticker: string): string {
  const symbol = ticker.toUpperCase().replace('/', '');
  return `${TV_LOGO_BASE}/${symbol.toLowerCase()}--big.svg`;
}

export const tradingviewSource: SourceModule = {
  name: 'tradingview',
  async search(ticker: string, _type?: InstrumentType): Promise<LogoResult | null> {
    const url = buildUrl(ticker);

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return null;

      return {
        found: true,
        ticker,
        companyName: ticker,
        imageUrl: url,
        source: 'tradingview',
      };
    } catch {
      return null;
    }
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/sources/tradingview.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources/tradingview.ts worker/tests/sources/tradingview.test.ts
git commit -m "feat(worker): add TradingView logo source"
```

---

## Task 4: CoinGecko Source

**Files:**
- Create: `worker/src/sources/coingecko.ts`
- Create: `worker/tests/sources/coingecko.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/sources/coingecko.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coingeckoSource } from '../../src/sources/coingecko';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('coingeckoSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo for a known crypto ticker', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: { large: 'https://coingecko.com/btc.png' } },
      ]),
    });

    const result = await coingeckoSource.search('BTC', 'crypto');

    expect(result).toEqual({
      found: true,
      ticker: 'BTC',
      companyName: 'Bitcoin',
      imageUrl: 'https://coingecko.com/btc.png',
      source: 'coingecko',
    });
  });

  it('returns null for unknown ticker', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await coingeckoSource.search('ZZZZZZ', 'crypto');

    expect(result).toBeNull();
  });

  it('skips search when type is not crypto and not undefined', async () => {
    const result = await coingeckoSource.search('AAPL', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on API error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });

    const result = await coingeckoSource.search('BTC', 'crypto');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/sources/coingecko.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CoinGecko source**

Create `worker/src/sources/coingecko.ts`:
```ts
import type { SourceModule, LogoResult, InstrumentType } from '../types';

const COINGECKO_SEARCH = 'https://api.coingecko.com/api/v3/search';

export const coingeckoSource: SourceModule = {
  name: 'coingecko',
  async search(ticker: string, type?: InstrumentType): Promise<LogoResult | null> {
    // Skip if explicitly searching non-crypto
    if (type && type !== 'crypto') return null;

    try {
      const response = await fetch(`${COINGECKO_SEARCH}?query=${encodeURIComponent(ticker)}`);
      if (!response.ok) return null;

      const data = await response.json() as { coins: Array<{ id: string; symbol: string; name: string; large: string }> };
      const coins = data.coins || [];

      const match = coins.find(
        (c) => c.symbol.toLowerCase() === ticker.toLowerCase()
      );

      if (!match || !match.large) return null;

      return {
        found: true,
        ticker,
        companyName: match.name,
        imageUrl: match.large,
        source: 'coingecko',
      };
    } catch {
      return null;
    }
  },
};
```

- [ ] **Step 4: Update test to match actual CoinGecko API response shape**

The CoinGecko `/search` endpoint returns `{ coins: [{ id, symbol, name, large }] }`. Update the test mock:
```ts
  it('returns logo for a known crypto ticker', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        coins: [
          { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', large: 'https://coingecko.com/btc.png' },
        ],
      }),
    });

    const result = await coingeckoSource.search('BTC', 'crypto');

    expect(result).toEqual({
      found: true,
      ticker: 'BTC',
      companyName: 'Bitcoin',
      imageUrl: 'https://coingecko.com/btc.png',
      source: 'coingecko',
    });
  });

  it('returns null for unknown ticker', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ coins: [] }),
    });

    const result = await coingeckoSource.search('ZZZZZZ', 'crypto');

    expect(result).toBeNull();
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/sources/coingecko.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add worker/src/sources/coingecko.ts worker/tests/sources/coingecko.test.ts
git commit -m "feat(worker): add CoinGecko logo source"
```

---

## Task 5: Clearbit Source + Ticker-Domain Mapping

**Files:**
- Create: `worker/src/ticker-domains.ts`
- Create: `worker/src/sources/clearbit.ts`
- Create: `worker/tests/sources/clearbit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/sources/clearbit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearbitSource } from '../../src/sources/clearbit';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('clearbitSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo for a ticker with known domain', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await clearbitSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://logo.clearbit.com/apple.com',
      source: 'clearbit',
    });
  });

  it('returns null for ticker with no domain mapping', async () => {
    const result = await clearbitSource.search('UNKNOWNTICKER', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when Clearbit returns 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await clearbitSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/sources/clearbit.test.ts`
Expected: FAIL

- [ ] **Step 3: Create ticker-domain mapping**

Create `worker/src/ticker-domains.ts`:
```ts
export interface TickerInfo {
  domain: string;
  name: string;
}

// Popular tickers → company domain + name
// Expand over time from SEC EDGAR, Wikipedia, etc.
export const TICKER_DOMAINS: Record<string, TickerInfo> = {
  AAPL: { domain: 'apple.com', name: 'Apple Inc' },
  MSFT: { domain: 'microsoft.com', name: 'Microsoft Corporation' },
  GOOGL: { domain: 'google.com', name: 'Alphabet Inc' },
  GOOG: { domain: 'google.com', name: 'Alphabet Inc' },
  AMZN: { domain: 'amazon.com', name: 'Amazon.com Inc' },
  META: { domain: 'meta.com', name: 'Meta Platforms Inc' },
  TSLA: { domain: 'tesla.com', name: 'Tesla Inc' },
  NVDA: { domain: 'nvidia.com', name: 'NVIDIA Corporation' },
  JPM: { domain: 'jpmorganchase.com', name: 'JPMorgan Chase & Co' },
  V: { domain: 'visa.com', name: 'Visa Inc' },
  MA: { domain: 'mastercard.com', name: 'Mastercard Inc' },
  DIS: { domain: 'disney.com', name: 'The Walt Disney Company' },
  NFLX: { domain: 'netflix.com', name: 'Netflix Inc' },
  PYPL: { domain: 'paypal.com', name: 'PayPal Holdings Inc' },
  ADBE: { domain: 'adobe.com', name: 'Adobe Inc' },
  CRM: { domain: 'salesforce.com', name: 'Salesforce Inc' },
  INTC: { domain: 'intel.com', name: 'Intel Corporation' },
  AMD: { domain: 'amd.com', name: 'Advanced Micro Devices Inc' },
  CSCO: { domain: 'cisco.com', name: 'Cisco Systems Inc' },
  ORCL: { domain: 'oracle.com', name: 'Oracle Corporation' },
  IBM: { domain: 'ibm.com', name: 'IBM Corporation' },
  UBER: { domain: 'uber.com', name: 'Uber Technologies Inc' },
  ABNB: { domain: 'airbnb.com', name: 'Airbnb Inc' },
  SQ: { domain: 'squareup.com', name: 'Block Inc' },
  SHOP: { domain: 'shopify.com', name: 'Shopify Inc' },
  SPOT: { domain: 'spotify.com', name: 'Spotify Technology SA' },
  SNAP: { domain: 'snap.com', name: 'Snap Inc' },
  PINS: { domain: 'pinterest.com', name: 'Pinterest Inc' },
  COIN: { domain: 'coinbase.com', name: 'Coinbase Global Inc' },
  BA: { domain: 'boeing.com', name: 'The Boeing Company' },
  WMT: { domain: 'walmart.com', name: 'Walmart Inc' },
  KO: { domain: 'coca-cola.com', name: 'The Coca-Cola Company' },
  PEP: { domain: 'pepsico.com', name: 'PepsiCo Inc' },
  MCD: { domain: 'mcdonalds.com', name: "McDonald's Corporation" },
  NKE: { domain: 'nike.com', name: 'NIKE Inc' },
  SBUX: { domain: 'starbucks.com', name: 'Starbucks Corporation' },
};
```

- [ ] **Step 4: Implement Clearbit source**

Create `worker/src/sources/clearbit.ts`:
```ts
import type { SourceModule, LogoResult, InstrumentType } from '../types';
import { TICKER_DOMAINS } from '../ticker-domains';

const CLEARBIT_LOGO_BASE = 'https://logo.clearbit.com';

export const clearbitSource: SourceModule = {
  name: 'clearbit',
  async search(ticker: string, _type?: InstrumentType): Promise<LogoResult | null> {
    const info = TICKER_DOMAINS[ticker.toUpperCase()];
    if (!info) return null;

    const url = `${CLEARBIT_LOGO_BASE}/${info.domain}`;

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return null;

      return {
        found: true,
        ticker,
        companyName: info.name,
        imageUrl: url,
        source: 'clearbit',
      };
    } catch {
      return null;
    }
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/sources/clearbit.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add worker/src/ticker-domains.ts worker/src/sources/clearbit.ts worker/tests/sources/clearbit.test.ts
git commit -m "feat(worker): add Clearbit logo source with ticker-domain mapping"
```

---

## Task 6: Logo.dev Source

**Files:**
- Create: `worker/src/sources/logodev.ts`
- Create: `worker/tests/sources/logodev.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/sources/logodev.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logodevSource } from '../../src/sources/logodev';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('logodevSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo for a ticker with known domain', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await logodevSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://img.logo.dev/apple.com?token=pk_anonymous&format=png&size=128',
      source: 'logodev',
    });
  });

  it('returns null for ticker with no domain mapping', async () => {
    const result = await logodevSource.search('UNKNOWNTICKER', 'stock');

    expect(result).toBeNull();
  });

  it('returns null when Logo.dev returns error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const result = await logodevSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/sources/logodev.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Logo.dev source**

Create `worker/src/sources/logodev.ts`:
```ts
import type { SourceModule, LogoResult, InstrumentType } from '../types';
import { TICKER_DOMAINS } from '../ticker-domains';

const LOGODEV_BASE = 'https://img.logo.dev';

function buildUrl(domain: string): string {
  return `${LOGODEV_BASE}/${domain}?token=pk_anonymous&format=png&size=128`;
}

export const logodevSource: SourceModule = {
  name: 'logodev',
  async search(ticker: string, _type?: InstrumentType): Promise<LogoResult | null> {
    const info = TICKER_DOMAINS[ticker.toUpperCase()];
    if (!info) return null;

    const url = buildUrl(info.domain);

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return null;

      return {
        found: true,
        ticker,
        companyName: info.name,
        imageUrl: url,
        source: 'logodev',
      };
    } catch {
      return null;
    }
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/sources/logodev.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources/logodev.ts worker/tests/sources/logodev.test.ts
git commit -m "feat(worker): add Logo.dev logo source"
```

---

## Task 7: GitHub Crypto Source

**Files:**
- Create: `worker/src/sources/github-crypto.ts`
- Create: `worker/tests/sources/github-crypto.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/sources/github-crypto.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubCryptoSource } from '../../src/sources/github-crypto';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('githubCryptoSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo from trustwallet assets for a known crypto', async () => {
    // First URL (trustwallet) succeeds
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await githubCryptoSource.search('ETH', 'crypto');

    expect(result).toEqual({
      found: true,
      ticker: 'ETH',
      companyName: 'ETH',
      imageUrl: expect.stringContaining('trustwallet'),
      source: 'github-crypto',
    });
  });

  it('returns null when no repo has the logo', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await githubCryptoSource.search('ZZZTOKEN', 'crypto');

    expect(result).toBeNull();
  });

  it('skips search when type is not crypto and not undefined', async () => {
    const result = await githubCryptoSource.search('ETH', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/sources/github-crypto.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement GitHub crypto source**

Create `worker/src/sources/github-crypto.ts`:
```ts
import type { SourceModule, LogoResult, InstrumentType } from '../types';

// Mapping of common crypto symbols to their blockchain identifiers for trustwallet
const CRYPTO_CHAINS: Record<string, { chain: string; address?: string }> = {
  BTC: { chain: 'bitcoin' },
  ETH: { chain: 'ethereum' },
  BNB: { chain: 'binance' },
  SOL: { chain: 'solana' },
  ADA: { chain: 'cardano' },
  DOT: { chain: 'polkadot' },
  AVAX: { chain: 'avalanche' },
  MATIC: { chain: 'polygon' },
  ATOM: { chain: 'cosmos' },
  NEAR: { chain: 'near' },
  FTM: { chain: 'fantom' },
  ALGO: { chain: 'algorand' },
  XRP: { chain: 'ripple' },
  DOGE: { chain: 'doge' },
  LTC: { chain: 'litecoin' },
  XLM: { chain: 'stellar' },
  TRX: { chain: 'tron' },
};

function trustwalletUrl(chain: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;
}

function cryptocurrencyIconsUrl(symbol: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}

export const githubCryptoSource: SourceModule = {
  name: 'github-crypto',
  async search(ticker: string, type?: InstrumentType): Promise<LogoResult | null> {
    if (type && type !== 'crypto') return null;

    const symbol = ticker.toUpperCase();

    // Try trustwallet first
    const chainInfo = CRYPTO_CHAINS[symbol];
    if (chainInfo) {
      const url = trustwalletUrl(chainInfo.chain);
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          return {
            found: true,
            ticker,
            companyName: ticker,
            imageUrl: url,
            source: 'github-crypto',
          };
        }
      } catch {
        // continue to next source
      }
    }

    // Try cryptocurrency-icons
    const altUrl = cryptocurrencyIconsUrl(symbol);
    try {
      const response = await fetch(altUrl, { method: 'HEAD' });
      if (response.ok) {
        return {
          found: true,
          ticker,
          companyName: ticker,
          imageUrl: altUrl,
          source: 'github-crypto',
        };
      }
    } catch {
      // fall through
    }

    return null;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/sources/github-crypto.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources/github-crypto.ts worker/tests/sources/github-crypto.test.ts
git commit -m "feat(worker): add GitHub crypto repos logo source"
```

---

## Task 8: Worker HTTP Router

**Files:**
- Create: `worker/src/index.ts`
- Create: `worker/tests/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/index.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cascade module
vi.mock('../src/cascade', () => ({
  searchCascade: vi.fn(),
}));

import { searchCascade } from '../src/cascade';
import worker from '../src/index';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockEnv = {
  LOGO_CACHE: mockKV as unknown as KVNamespace,
};

function makeRequest(path: string): Request {
  return new Request(`https://worker.dev${path}`);
}

describe('worker router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);
  });

  it('GET /logo?ticker=AAPL returns found result', async () => {
    (searchCascade as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'tradingview',
    });

    const response = await worker.fetch(makeRequest('/logo?ticker=AAPL'), mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'tradingview',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('GET /logo without ticker returns 400', async () => {
    const response = await worker.fetch(makeRequest('/logo'), mockEnv);

    expect(response.status).toBe(400);
  });

  it('GET /logo returns cached result from KV', async () => {
    mockKV.get.mockResolvedValue(JSON.stringify({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'tradingview',
    }));

    const response = await worker.fetch(makeRequest('/logo?ticker=AAPL'), mockEnv);
    const body = await response.json();

    expect(body.found).toBe(true);
    expect(searchCascade).not.toHaveBeenCalled();
  });

  it('unknown route returns 404', async () => {
    const response = await worker.fetch(makeRequest('/unknown'), mockEnv);

    expect(response.status).toBe(404);
  });

  it('OPTIONS request returns CORS headers', async () => {
    const request = new Request('https://worker.dev/logo', { method: 'OPTIONS' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('GET /image/:key returns 404 when key not in KV', async () => {
    mockKV.get.mockResolvedValue(null);

    const response = await worker.fetch(makeRequest('/image/unknown'), mockEnv);

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run tests/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the router**

Create `worker/src/index.ts`:
```ts
import type { Env, InstrumentType, LogoResult } from './types';
import { searchCascade } from './cascade';
import { tradingviewSource } from './sources/tradingview';
import { coingeckoSource } from './sources/coingecko';
import { clearbitSource } from './sources/clearbit';
import { logodevSource } from './sources/logodev';
import { githubCryptoSource } from './sources/github-crypto';

const SOURCES = [
  tradingviewSource,
  coingeckoSource,
  clearbitSource,
  logodevSource,
  githubCryptoSource,
];

const CACHE_TTL_FOUND = 60 * 60 * 24 * 7; // 7 days
const CACHE_TTL_NOT_FOUND = 60 * 60 * 24; // 1 day

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

async function handleLogo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker');
  const type = url.searchParams.get('type') as InstrumentType | null;

  if (!ticker) {
    return jsonResponse({ error: 'ticker parameter required' }, 400);
  }

  const cacheKey = `logo:${ticker.toUpperCase()}`;

  // Check KV cache
  const cached = await env.LOGO_CACHE.get(cacheKey);
  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  // Search cascade
  const result = await searchCascade(ticker, type ?? undefined, SOURCES);

  // Store in KV (with original imageUrl for proxy)
  const ttl = result.found ? CACHE_TTL_FOUND : CACHE_TTL_NOT_FOUND;
  await env.LOGO_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });

  // Rewrite imageUrl to point to our proxy
  if (result.found) {
    const selfUrl = new URL(request.url);
    result.imageUrl = `${selfUrl.origin}/image/${ticker.toUpperCase()}`;
  }

  return jsonResponse(result);
}

async function handleImage(request: Request, env: Env, key: string): Promise<Response> {
  // Check R2 first if available
  if (env.LOGO_IMAGES) {
    const object = await env.LOGO_IMAGES.get(key);
    if (object) {
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...corsHeaders(),
        },
      });
    }
  }

  // Look up the original URL from KV
  const cached = await env.LOGO_CACHE.get(`logo:${key.toUpperCase()}`);
  if (!cached) {
    return jsonResponse({ error: 'image not found' }, 404);
  }

  const data = JSON.parse(cached);
  if (!data.found || !data.imageUrl) {
    return jsonResponse({ error: 'image not found' }, 404);
  }

  // Proxy the image from the original source
  try {
    const imageResponse = await fetch(data.imageUrl);
    if (!imageResponse.ok) {
      return jsonResponse({ error: 'upstream image fetch failed' }, 502);
    }

    const imageBytes = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/png';

    // Store in R2 if available
    if (env.LOGO_IMAGES) {
      await env.LOGO_IMAGES.put(key, imageBytes, {
        httpMetadata: { contentType },
      });
    }

    return new Response(imageBytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
        ...corsHeaders(),
      },
    });
  } catch {
    return jsonResponse({ error: 'image proxy failed' }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/logo') {
      return handleLogo(request, env);
    }

    const imageMatch = url.pathname.match(/^\/image\/(.+)$/);
    if (imageMatch) {
      return handleImage(request, env, imageMatch[1]);
    }

    return jsonResponse({ error: 'not found' }, 404);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run tests/index.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Run all worker tests**

Run: `cd worker && npx vitest run`
Expected: all tests across all files PASS

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/tests/index.test.ts
git commit -m "feat(worker): add HTTP router with KV caching and CORS"
```

---

## Task 9: Plugin Sandbox (code.ts)

**Files:**
- Create: `plugin/src/code.ts`

- [ ] **Step 1: Implement plugin sandbox**

Create `plugin/src/code.ts`:
```ts
figma.showUI(__html__, { width: 300, height: 200 });

let insertOffset = 0;

interface InsertImageMessage {
  type: 'insert-image';
  imageUrl: string;
}

interface InsertFallbackMessage {
  type: 'insert-fallback';
  letters: string;
}

type PluginMessage = InsertImageMessage | InsertFallbackMessage;

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'insert-image') {
    await insertImage(msg.imageUrl);
  } else if (msg.type === 'insert-fallback') {
    await insertFallback(msg.letters);
  }
};

async function insertImage(imageUrl: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const imageHash = figma.createImage(new Uint8Array(buffer)).hash;

    const selection = figma.currentPage.selection;

    if (selection.length > 0) {
      const node = selection[0];
      if ('fills' in node) {
        node.fills = [
          {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash,
          },
        ];
      }
    } else {
      const frame = figma.createFrame();
      frame.resize(48, 48);
      frame.cornerRadius = 24;
      frame.fills = [
        {
          type: 'IMAGE',
          scaleMode: 'FILL',
          imageHash,
        },
      ];

      const center = figma.viewport.center;
      frame.x = center.x + insertOffset;
      frame.y = center.y;
      insertOffset += 60;

      figma.currentPage.appendChild(frame);
    }

    figma.ui.postMessage({ type: 'insert-success' });
  } catch (error) {
    figma.ui.postMessage({ type: 'insert-error', error: String(error) });
  }
}

async function insertFallback(letters: string): Promise<void> {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

    const selection = figma.currentPage.selection;

    if (selection.length > 0) {
      const node = selection[0];

      if ('fills' in node) {
        node.fills = [
          {
            type: 'SOLID',
            color: { r: 0.769, g: 0.769, b: 0.769 }, // #C4C4C4
          },
        ];
      }

      // Create text node on top
      const text = figma.createText();
      text.fontName = { family: 'Inter', style: 'Bold' };
      text.characters = letters;
      text.fontSize = 18;
      text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      text.textAlignHorizontal = 'CENTER';
      text.textAlignVertical = 'CENTER';

      // Position text over the node
      if ('width' in node && 'height' in node) {
        text.resize(node.width as number, node.height as number);
        text.x = node.x;
        text.y = node.y;
      }

      const group = figma.group([node, text], figma.currentPage);
      group.name = `Fallback: ${letters}`;
    } else {
      const frame = figma.createFrame();
      frame.resize(48, 48);
      frame.cornerRadius = 24;
      frame.fills = [
        {
          type: 'SOLID',
          color: { r: 0.769, g: 0.769, b: 0.769 }, // #C4C4C4
        },
      ];
      frame.name = `Fallback: ${letters}`;

      const text = figma.createText();
      text.fontName = { family: 'Inter', style: 'Bold' };
      text.characters = letters;
      text.fontSize = 18;
      text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      text.textAlignHorizontal = 'CENTER';
      text.textAlignVertical = 'CENTER';
      text.resize(48, 48);

      frame.appendChild(text);
      text.x = 0;
      text.y = 0;

      const center = figma.viewport.center;
      frame.x = center.x + insertOffset;
      frame.y = center.y;
      insertOffset += 60;

      figma.currentPage.appendChild(frame);
    }

    figma.ui.postMessage({ type: 'insert-success' });
  } catch (error) {
    figma.ui.postMessage({ type: 'insert-error', error: String(error) });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd plugin && npx tsc --noEmit`
Expected: no errors (may show warnings about Figma types — acceptable at this stage without the plugin running in Figma)

- [ ] **Step 3: Commit**

```bash
git add plugin/src/code.ts
git commit -m "feat(plugin): add sandbox code with image insert and fallback"
```

---

## Task 10: Plugin UI

**Files:**
- Create: `plugin/src/ui/index.html`
- Create: `plugin/src/ui/styles.css`
- Create: `plugin/src/ui/ui.ts`

- [ ] **Step 1: Create HTML shell**

Create `plugin/src/ui/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <!-- STYLES -->
</head>
<body>
  <div id="app">
    <div class="search-container">
      <input
        id="search-input"
        type="text"
        placeholder="Enter ticker (AAPL, BTC, EURUSD...)"
        autocomplete="off"
      />
    </div>

    <div id="state-initial" class="state">
      <p class="hint">Search for a trading instrument logo</p>
    </div>

    <div id="state-loading" class="state hidden">
      <div class="spinner"></div>
    </div>

    <div id="state-found" class="state hidden">
      <div class="result">
        <div class="preview" id="preview-image"></div>
        <div class="result-info">
          <span class="company-name" id="company-name"></span>
          <span class="ticker-label" id="ticker-label"></span>
        </div>
      </div>
      <button id="btn-insert" class="btn-primary">Insert</button>
    </div>

    <div id="state-not-found" class="state hidden">
      <div class="result">
        <div class="preview fallback-preview" id="preview-fallback"></div>
        <div class="result-info">
          <span class="company-name">Logo not found</span>
          <span class="ticker-label" id="ticker-label-fallback"></span>
        </div>
      </div>
      <button id="btn-insert-fallback" class="btn-secondary">Insert fallback</button>
    </div>

    <div id="state-error" class="state hidden">
      <p class="error-text">Network error</p>
      <button id="btn-retry" class="btn-secondary">Retry</button>
    </div>

    <div id="state-success" class="state hidden">
      <p class="success-text">Inserted!</p>
    </div>
  </div>
  <!-- SCRIPT -->
</body>
</html>
```

- [ ] **Step 2: Create styles**

Create `plugin/src/ui/styles.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: #333;
  background: #fff;
  padding: 12px;
}

.search-container {
  margin-bottom: 12px;
}

#search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

#search-input:focus {
  border-color: #18a0fb;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.hidden {
  display: none !important;
}

.hint {
  color: #999;
  text-align: center;
  padding: 16px 0;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #eee;
  border-top-color: #18a0fb;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: 16px 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.preview {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
  border: 1px solid #eee;
}

.fallback-preview {
  background: #C4C4C4;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  border: none;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.company-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticker-label {
  color: #999;
  font-size: 11px;
}

.btn-primary,
.btn-secondary {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary {
  background: #18a0fb;
  color: #fff;
}

.btn-primary:hover {
  background: #0d8ce0;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.error-text {
  color: #e74c3c;
  text-align: center;
}

.success-text {
  color: #27ae60;
  font-weight: 600;
  text-align: center;
  padding: 8px 0;
}
```

- [ ] **Step 3: Create UI logic**

Create `plugin/src/ui/ui.ts`:
```ts
const WORKER_BASE = 'https://trading-logo-worker.YOUR_SUBDOMAIN.workers.dev';

const searchInput = document.getElementById('search-input') as HTMLInputElement;
const stateInitial = document.getElementById('state-initial')!;
const stateLoading = document.getElementById('state-loading')!;
const stateFound = document.getElementById('state-found')!;
const stateNotFound = document.getElementById('state-not-found')!;
const stateError = document.getElementById('state-error')!;
const stateSuccess = document.getElementById('state-success')!;
const previewImage = document.getElementById('preview-image')!;
const previewFallback = document.getElementById('preview-fallback')!;
const companyName = document.getElementById('company-name')!;
const tickerLabel = document.getElementById('ticker-label')!;
const tickerLabelFallback = document.getElementById('ticker-label-fallback')!;
const btnInsert = document.getElementById('btn-insert')!;
const btnInsertFallback = document.getElementById('btn-insert-fallback')!;
const btnRetry = document.getElementById('btn-retry')!;

interface LogoFoundResponse {
  found: true;
  ticker: string;
  companyName: string;
  imageUrl: string;
  source: string;
}

interface LogoNotFoundResponse {
  found: false;
  ticker: string;
  companyName: string | null;
}

type LogoResponse = LogoFoundResponse | LogoNotFoundResponse;

let currentResult: LogoResponse | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastQuery = '';

function showState(state: HTMLElement): void {
  [stateInitial, stateLoading, stateFound, stateNotFound, stateError, stateSuccess].forEach(
    (el) => el.classList.add('hidden')
  );
  state.classList.remove('hidden');
}

function getLetters(ticker: string, companyNameStr: string | null): string {
  if (companyNameStr) {
    const words = companyNameStr.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyNameStr.slice(0, 2).toUpperCase();
  }
  return ticker.slice(0, 2).toUpperCase();
}

async function searchTicker(query: string): Promise<void> {
  if (!query.trim()) {
    showState(stateInitial);
    return;
  }

  showState(stateLoading);

  try {
    const response = await fetch(
      `${WORKER_BASE}/logo?ticker=${encodeURIComponent(query.trim())}`
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: LogoResponse = await response.json();
    currentResult = data;

    if (data.found) {
      previewImage.style.backgroundImage = `url(${data.imageUrl})`;
      companyName.textContent = data.companyName;
      tickerLabel.textContent = data.ticker;
      showState(stateFound);
    } else {
      const letters = getLetters(data.ticker, data.companyName);
      previewFallback.textContent = letters;
      tickerLabelFallback.textContent = data.ticker;
      showState(stateNotFound);
    }
  } catch {
    currentResult = null;
    showState(stateError);
  }
}

function handleInsertSuccess(): void {
  showState(stateSuccess);
  searchInput.value = '';
  lastQuery = '';
  currentResult = null;

  setTimeout(() => {
    showState(stateInitial);
    searchInput.focus();
  }, 1500);
}

// Search input: debounce 500ms + Enter
searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (query === lastQuery) return;

  debounceTimer = setTimeout(() => {
    lastQuery = query;
    searchTicker(query);
  }, 500);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (debounceTimer) clearTimeout(debounceTimer);
    const query = searchInput.value;
    lastQuery = query;
    searchTicker(query);
  }
});

// Insert buttons
btnInsert.addEventListener('click', () => {
  if (currentResult?.found) {
    parent.postMessage(
      { pluginMessage: { type: 'insert-image', imageUrl: currentResult.imageUrl } },
      '*'
    );
  }
});

btnInsertFallback.addEventListener('click', () => {
  if (currentResult && !currentResult.found) {
    const letters = getLetters(currentResult.ticker, currentResult.companyName);
    parent.postMessage(
      { pluginMessage: { type: 'insert-fallback', letters } },
      '*'
    );
  }
});

// Double-click on preview to insert
previewImage.addEventListener('dblclick', () => btnInsert.click());
previewFallback.addEventListener('dblclick', () => btnInsertFallback.click());

// Retry button
btnRetry.addEventListener('click', () => {
  searchTicker(lastQuery);
});

// Messages from sandbox
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'insert-success') {
    handleInsertSuccess();
  } else if (msg.type === 'insert-error') {
    showState(stateError);
  }
};

// Focus input on load
searchInput.focus();
```

- [ ] **Step 4: Build the plugin**

Run:
```bash
cd plugin && node esbuild.config.mjs
```
Expected: `dist/code.js`, `dist/ui-bundle.js`, `dist/ui.html` created. Console shows "Build complete".

- [ ] **Step 5: Verify dist/ui.html contains inlined CSS and JS**

Run: `ls -la plugin/dist/`
Expected: `code.js`, `ui-bundle.js`, `ui.html` exist. `ui.html` should contain `<style>` and `<script>` tags with inlined content.

- [ ] **Step 6: Commit**

```bash
git add plugin/src/ui/index.html plugin/src/ui/styles.css plugin/src/ui/ui.ts
git commit -m "feat(plugin): add UI with search, preview, and insert states"
```

---

## Task 11: End-to-End Verification

**Files:** No new files — verification only.

- [ ] **Step 1: Run all worker tests**

Run: `cd worker && npx vitest run`
Expected: all tests pass across all test files

- [ ] **Step 2: Build plugin**

Run: `cd plugin && node esbuild.config.mjs`
Expected: clean build, all 3 dist files generated

- [ ] **Step 3: TypeScript check on worker**

Run: `cd worker && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Update WORKER_BASE URL placeholder**

The `plugin/src/ui/ui.ts` file contains `YOUR_SUBDOMAIN` as a placeholder. This is expected — it will be replaced after the Worker is deployed. Add a comment in the file to make this clear.

Edit `plugin/src/ui/ui.ts` line 1:
```ts
// TODO: Replace with your actual Worker URL after deployment
const WORKER_BASE = 'https://trading-logo-worker.YOUR_SUBDOMAIN.workers.dev';
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification pass"
```
