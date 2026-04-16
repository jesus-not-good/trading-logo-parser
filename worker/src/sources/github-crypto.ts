import type { SourceModule, LogoResult, InstrumentType } from '../types';

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
