# Trading Logo Images Parser — Figma Plugin

## Overview

Figma community plugin for searching and inserting trading instrument logos (stocks, crypto, forex, commodities, indices) directly onto the canvas. Users enter a ticker symbol, the plugin fetches the logo from multiple open sources via a Cloudflare Worker proxy, and inserts it as an image fill or a new element.

## Architecture

### System Components

**Figma Plugin (client)**
- UI layer: iframe with HTML/CSS/JS — search dialog
- Sandbox layer: Figma API interaction — filling elements, creating frames, generating fallbacks
- Communication between UI and sandbox via `postMessage`

**Cloudflare Worker (backend)**
- Single endpoint: `GET /logo?ticker=AAPL&type=stock`
- Cascading search across multiple logo sources (waterfall pattern)
- Cache: Cloudflare KV for ticker→metadata mapping, R2 for image storage (optional at launch)
- Returns: `{ found, ticker, companyName, imageUrl, source }` or `{ found: false, ticker, companyName }`

### Data Flow

1. User enters ticker → UI sends request to Worker
2. Worker searches cascade of sources → returns logo URL + company name
3. UI shows preview → user clicks "Insert"
4. UI sends `postMessage` to sandbox with image URL
5. Sandbox downloads image (`figma.createImage`), fills selected element or creates new one

## Logo Sources and Cascade

Worker queries sources in priority order, returning the first successful result:

### Priority 1 — Specialized APIs
1. **TradingView CDN** — stocks, ETFs, indices, forex, commodities. URL pattern by symbol, broad coverage
2. **CoinGecko API** — cryptocurrencies. Free API, good documentation, ticker→id mapping via their coin list

### Priority 2 — Universal Sources
3. **Clearbit Logo API** — by company domain. Requires ticker→domain mapping (stored in KV as lookup table)
4. **Logo.dev** — Clearbit alternative, free tier 1000 req/month, fallback if Clearbit fails

### Priority 3 — Open Repositories
5. **GitHub repositories** (trustwallet/assets, cryptocurrency-icons) — direct raw file URLs, stable

### Ticker→Domain Mapping (for Clearbit/Logo.dev)
- Popular tickers: static lookup table in KV (AAPL→apple.com, GOOGL→google.com)
- Initially populated from open datasets (SEC EDGAR, Wikipedia)
- Expanded over time

### Type Parameter
Worker accepts `type=stock|crypto|forex|commodity|index` hint to narrow search. If omitted, tries all sources.

## Plugin UI

### Dialog Window
- Size: ~300x200px, compact, does not obstruct canvas work
- Minimal design, similar to Unsplash plugin

### States
1. **Initial** — search field + hint "Enter ticker (AAPL, BTC, EURUSD...)"
2. **Loading** — spinner/skeleton while Worker responds
3. **Found** — logo preview (circle), company name, ticker, "Insert" button
4. **Not found** — fallback circle preview with letters, "Logo not found" text, "Insert fallback" button
5. **Network error** — error message + "Retry" button

### Search Behavior
- Triggers on Enter or 500ms debounce after input
- Minimum 1 character to start search
- Shows one ticker result at a time (not a list)

### Insert Behavior
- Click "Insert" button or double-click preview
- If element selected on canvas → applies as image fill
- If nothing selected → creates circular frame 48x48 near viewport center
- After insert, dialog stays open, search field clears
- Brief "Inserted!" confirmation for 1.5 seconds
- Each subsequent new element offsets 60px to the right (no overlap)
- Search field auto-focuses for next input

## Insert Logic

### Image Found
- Sandbox receives image URL from UI via `postMessage`
- Downloads bytes, creates image via `figma.createImage(imageBytes)`
- Selected element: sets `fills` with `type: 'IMAGE'`, `scaleMode: 'FILL'`
- No selection: creates `figma.createFrame()` 48x48, `cornerRadius: 24` (circle), applies image fill
- New element positioned at viewport center

### Fallback (Image Not Found)
- Creates circular frame 48x48 with gray fill (`#C4C4C4`, configurable later)
- Text node inside with two letters:
  - If `companyName` available: first letters of first two words (Apple Inc → AI)
  - If `companyName` unavailable: first two letters of ticker (XYZ → XY)
- Text styling: white, centered, bold, size proportional to frame
- If element selected: applies gray fill + text overlay (creates group)

## Cloudflare Worker — Implementation Details

### API

**Search endpoint:**
```
GET /logo?ticker=AAPL&type=stock
```

**Response (found):**
```json
{
  "found": true,
  "ticker": "AAPL",
  "companyName": "Apple Inc",
  "imageUrl": "https://worker-domain.workers.dev/image/aapl.png",
  "source": "tradingview"
}
```

**Response (not found):**
```json
{
  "found": false,
  "ticker": "XYZ",
  "companyName": "Xyz Corp"
}
```

### Image Proxy
```
GET /image/:key
```
Serves image bytes from R2 cache or proxies from source and saves. Reasons for proxying:
- Figma sandbox cannot fetch arbitrary URLs (CORS)
- External URLs may expire
- Uniform format and sizing

### Caching (KV)
- Key: `logo:{ticker}` → JSON with `imageUrl`, `companyName`, `source`, `cachedAt`
- TTL: 7 days — balance between freshness and load
- Negative cache: `notFound` entries with TTL 1 day (avoid repeated hits to sources)

### R2 Storage (Optional at Launch)
- When enabled: Worker saves logo bytes to R2 on first request
- Subsequent requests served from R2 — faster, independent of external CDNs
- Can be enabled later without changing plugin API

## Project Structure

```
/
├── plugin/                  # Figma plugin
│   ├── manifest.json        # Figma plugin manifest
│   ├── src/
│   │   ├── code.ts          # Sandbox (Figma API)
│   │   └── ui/
│   │       ├── index.html
│   │       ├── ui.ts        # UI logic
│   │       └── styles.css
│   └── package.json
│
├── worker/                  # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts         # Routing
│   │   ├── sources/         # Source modules
│   │   │   ├── tradingview.ts
│   │   │   ├── coingecko.ts
│   │   │   ├── clearbit.ts
│   │   │   ├── logodev.ts
│   │   │   └── github-crypto.ts
│   │   └── cascade.ts       # Cascading search logic
│   ├── wrangler.toml        # Cloudflare config
│   └── package.json
│
└── package.json             # Root workspace (pnpm)
```

## Technologies
- **Plugin:** TypeScript, esbuild for bundling (Figma requires single JS file)
- **Worker:** TypeScript, Wrangler CLI for deployment
- **Workspaces:** pnpm workspaces
- **No client-side caching** — every request goes to network (Worker handles caching)

## Publishing
- Via Figma Developer Console — upload manifest.json + bundle
- Community plugin — full page with description, icon, screenshots
