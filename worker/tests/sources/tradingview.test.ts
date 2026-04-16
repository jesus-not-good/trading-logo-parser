import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tradingviewSource } from '../../src/sources/tradingview';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('tradingviewSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo URL for a valid stock ticker', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'AAPL',
      imageUrl: expect.stringContaining('aapl'),
      source: 'tradingview',
    });
  });

  it('returns null when TradingView returns 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await tradingviewSource.search('ZZZZZZ', 'stock');

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const result = await tradingviewSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
