import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logodevSource } from '../../src/sources/logodev';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('logodevSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo for a ticker with known domain', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await logodevSource.search('AAPL', 'stock');

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://img.logo.dev/apple.com?token=pk_anonymous&format=png&size=128',
      source: 'logodev',
    });
  });

  it('returns null for ticker with no domain mapping', async () => {
    const result = await logodevSource.search('UNKNOWNTICKER', 'stock');

    expect(result).toBeNull();
  });

  it('returns null when Logo.dev returns error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const result = await logodevSource.search('AAPL', 'stock');

    expect(result).toBeNull();
  });
});
