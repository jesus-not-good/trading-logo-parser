import type { SourceModule, LogoResult, InstrumentType } from '../types';

const TV_SEARCH = 'https://symbol-search.tradingview.com/symbol_search/v3/';
const TV_LOGO_BASE = 'https://s3-symbol-logo.tradingview.com';

const SEARCH_HEADERS = {
  Origin: 'https://www.tradingview.com',
  Referer: 'https://www.tradingview.com/',
};

interface TvSearchSymbol {
  symbol?: string;
  description?: string;
  logoid?: string;
  type?: string;
}

interface TvSearchResponse {
  symbols?: TvSearchSymbol[];
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function buildLogoUrl(logoid: string): string {
  return `${TV_LOGO_BASE}/${logoid}--600.png`;
}

function pickMatch(
  symbols: TvSearchSymbol[],
  ticker: string
): TvSearchSymbol | null {
  const upper = ticker.toUpperCase();
  for (const s of symbols) {
    const rawSymbol = stripTags(s.symbol ?? '').toUpperCase();
    if (rawSymbol === upper && s.logoid) return s;
  }
  return null;
}

export const tradingviewSource: SourceModule = {
  name: 'tradingview',
  async search(ticker: string, _type?: InstrumentType): Promise<LogoResult | null> {
    try {
      const searchUrl = `${TV_SEARCH}?text=${encodeURIComponent(ticker)}&hl=1&lang=en&domain=production`;
      const searchResponse = await fetch(searchUrl, { headers: SEARCH_HEADERS });
      if (!searchResponse.ok) return null;

      const data = (await searchResponse.json()) as TvSearchResponse;
      const match = pickMatch(data.symbols ?? [], ticker);
      if (!match || !match.logoid) return null;

      const imageUrl = buildLogoUrl(match.logoid);
      const headResponse = await fetch(imageUrl, { method: 'HEAD' });
      if (!headResponse.ok) return null;

      const companyName = stripTags(match.description ?? ticker) || ticker;

      return {
        found: true,
        ticker,
        companyName,
        imageUrl,
        source: 'tradingview',
      };
    } catch {
      return null;
    }
  },
};
