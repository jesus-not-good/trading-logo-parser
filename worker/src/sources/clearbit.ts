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
