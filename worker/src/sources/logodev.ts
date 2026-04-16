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
