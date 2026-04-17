import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tradingviewSource } from '../../src/sources/tradingview';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function searchResponse(symbols: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ symbols }),
  };
}

describe('tradingviewSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('resolves ticker to logoid via search API and returns logo URL', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchResponse([
          {
            symbol: '<em>AVGO</em>',
            description: 'Broadcom Inc.',
            logoid: 'broadcom',
            type: 'stock',
          },
        ])
      )
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await tradingviewSource.search('AVGO', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AVGO',
      companyName: 'Broadcom Inc.',
      imageUrl: 'https://s3-symbol-logo.tradingview.com/broadcom--600.png',
      source: 'tradingview',
    });

    const firstCall = fetchMock.mock.calls[0][0] as string;
    expect(firstCall).toContain('symbol-search.tradingview.com');
    expect(firstCall).toContain('text=AVGO');
  });

  it('returns null when search API yields no matching symbol', async () => {
    fetchMock.mockResolvedValueOnce(searchResponse([]));

    const result = await tradingviewSource.search('ZZZZZZ', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when the matched symbol has no logoid', async () => {
    fetchMock.mockResolvedValueOnce(
      searchResponse([{ symbol: 'XYZ', description: 'Xyz Corp', type: 'stock' }])
    );

    const result = await tradingviewSource.search('XYZ', 'stock');

    expect(result).toBeNull();
  });

  it('returns null when CDN HEAD check fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchResponse([{ symbol: 'AAPL', description: 'Apple Inc.', logoid: 'apple' }])
      )
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });

  it('returns null when search API returns an error status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });

  it('skips non-matching symbols and picks the exact ticker match', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchResponse([
          { symbol: 'AVGOB', description: 'Other', logoid: 'other' },
          { symbol: '<em>AVGO</em>', description: 'Broadcom Inc.', logoid: 'broadcom' },
        ])
      )
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await tradingviewSource.search('AVGO', 'stock');

    expect(result?.found).toBe(true);
    if (result?.found) {
      expect(result.imageUrl).toContain('broadcom--600.png');
    }
  });
});
