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
