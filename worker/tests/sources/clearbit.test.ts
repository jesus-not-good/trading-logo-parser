import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearbitSource } from '../../src/sources/clearbit';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('clearbitSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo for a ticker with known domain', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await clearbitSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://logo.clearbit.com/apple.com',
      source: 'clearbit',
    });
  });

  it('returns null for ticker with no domain mapping', async () => {
    const result = await clearbitSource.search('UNKNOWNTICKER', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when Clearbit returns 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await clearbitSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
