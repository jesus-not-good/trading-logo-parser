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
