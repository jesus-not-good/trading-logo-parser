import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubCryptoSource } from '../../src/sources/github-crypto';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('githubCryptoSource', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns logo from trustwallet assets for a known crypto', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await githubCryptoSource.search('ETH', 'crypto');

    expect(result).toEqual({
      found: true,
      ticker: 'ETH',
      companyName: 'ETH',
      imageUrl: expect.stringContaining('trustwallet'),
      source: 'github-crypto',
    });
  });

  it('returns null when no repo has the logo', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await githubCryptoSource.search('ZZZTOKEN', 'crypto');

    expect(result).toBeNull();
  });

  it('skips search when type is not crypto and not undefined', async () => {
    const result = await githubCryptoSource.search('ETH', 'stock');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
