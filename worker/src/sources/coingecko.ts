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
