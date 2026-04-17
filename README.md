# Trading Logo Parser

Figma plugin for inserting trading instrument logos (stocks, crypto, ETFs, forex, indices) directly onto the canvas. Enter a ticker, pick the match, and the logo lands as an image fill on the selected layer — or as a new 48×48 circular frame if nothing is selected.

Backend is a Cloudflare Worker that cascades across multiple logo sources (TradingView, CoinGecko, Clearbit, Logo.dev, GitHub crypto repos) and caches hits in KV.

## Project structure

```
plugin/              Figma plugin (sandbox + UI)
  src/code.ts        Sandbox: image insert, fallback generation
  src/ui/            Iframe UI: search, preview, insert trigger
  manifest.json      Figma plugin manifest

worker/              Cloudflare Worker (logo proxy)
  src/index.ts       HTTP router: /logo, /image/:key, CORS
  src/cascade.ts     Waterfall source resolver
  src/sources/       TradingView, CoinGecko, Clearbit, Logo.dev, GitHub crypto
  src/ticker-domains.ts  Static ticker → company domain map
  wrangler.toml      CF Worker config (KV namespace binding)

docs/superpowers/
  specs/             Design spec
  plans/             Implementation plan
```

## Quick start — just use the plugin

1. Grab the latest release zip (or build from source — see below).
2. Unpack it.
3. In Figma Desktop: `Menu → Plugins → Development → Import plugin from manifest…` → pick `manifest.json`.
4. Run via `Menu → Plugins → Development → Trading Logo Parser`.

The plugin talks to the production worker at `https://trading-logo-worker.tradinglogos.workers.dev` — no local setup required.

## Development

### Requirements

- Node 20+
- pnpm 9+
- (For worker deploy) a Cloudflare account and `wrangler` auth

### Setup

```bash
pnpm install
```

### Plugin

```bash
pnpm --filter plugin build       # one-off build → plugin/dist/
pnpm --filter plugin dev         # watch mode
```

Then in Figma: `Plugins → Development → Import plugin from manifest…` and point it at `plugin/manifest.json`. After that, hitting `Cmd+Shift+P` → "Trading Logo Parser" re-runs the plugin, so watch-mode iteration is instant.

### Worker

```bash
pnpm --filter worker dev         # local dev server
pnpm --filter worker test        # vitest
pnpm --filter worker exec wrangler deploy   # push to Cloudflare
```

Logs from the deployed worker (after `observability.enabled = true` in `wrangler.toml`):

```bash
pnpm --filter worker exec wrangler tail --format json
```

### Working with KV

The worker caches results in a KV namespace bound as `LOGO_CACHE`. `wrangler kv` commands default to a local simulator — pass `--remote` to touch the actual production namespace:

```bash
pnpm --filter worker exec wrangler kv key list \
  --namespace-id <id> --remote

pnpm --filter worker exec wrangler kv key delete \
  --namespace-id <id> --remote "logo:AVGO"
```

## How the cascade works

For `GET /logo?ticker=AVGO`, the worker walks sources in order and returns the first hit:

1. **TradingView** — resolves the ticker to a `logoid` via `symbol-search` API, then fetches `https://s3-symbol-logo.tradingview.com/<logoid>--600.png`. Covers most stocks, ETFs, indices, forex.
2. **CoinGecko** — search API, match by symbol, return `large` image URL. Crypto only.
3. **Clearbit** — looks up the ticker in the static `ticker-domains.ts` map, fetches `https://logo.clearbit.com/<domain>`.
4. **Logo.dev** — same ticker→domain map, used as Clearbit fallback.
5. **GitHub crypto repos** — `trustwallet/assets` and `spothq/cryptocurrency-icons` raw URLs, matched by known symbol→chain map.

Found responses cache for 7 days, `not found` for 1 day. The returned `imageUrl` always points at the worker's `/image/:key` proxy so that the Figma sandbox, which cannot do cross-origin fetches against arbitrary CDNs, sees a CORS-friendly origin.

## Adding more tickers

The only manually-maintained list is `worker/src/ticker-domains.ts` (for Clearbit and Logo.dev). TradingView and CoinGecko lookups are automatic. Pull requests adding entries to `TICKER_DOMAINS` are welcome.

## Sharing the plugin without publishing

Build the plugin, then zip:

```
trading-logo-parser/
├── manifest.json
└── dist/
    ├── code.js
    └── ui.html
```

Send the zip. Recipient unpacks and imports `manifest.json` via `Plugins → Development → Import plugin from manifest…`.

## License

MIT.
