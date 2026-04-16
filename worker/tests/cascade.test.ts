import { describe, it, expect, vi } from 'vitest';
import { searchCascade } from '../src/cascade';
import type { SourceModule, LogoResult } from '../src/types';

function makeSource(name: string, result: LogoResult | null): SourceModule {
  return {
    name,
    search: vi.fn().mockResolvedValue(result),
  };
}

describe('searchCascade', () => {
  it('returns the first source that finds a result', async () => {
    const sources = [
      makeSource('source-a', null),
      makeSource('source-b', {
        found: true,
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        imageUrl: 'https://example.com/aapl.png',
        source: 'source-b',
      }),
      makeSource('source-c', null),
    ];

    const result = await searchCascade('AAPL', undefined, sources);

    expect(result).toEqual({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'source-b',
    });
    expect(sources[0].search).toHaveBeenCalledWith('AAPL', undefined);
    expect(sources[1].search).toHaveBeenCalledWith('AAPL', undefined);
    expect(sources[2].search).not.toHaveBeenCalled();
  });

  it('returns not-found when all sources fail', async () => {
    const sources = [
      makeSource('a', null),
      makeSource('b', null),
    ];

    const result = await searchCascade('XYZ', undefined, sources);

    expect(result).toEqual({
      found: false,
      ticker: 'XYZ',
      companyName: null,
    });
  });

  it('returns not-found with companyName from a source that recognized the ticker', async () => {
    const sources = [
      makeSource('a', null),
      makeSource('b', {
        found: false,
        ticker: 'XYZ',
        companyName: 'Xyz Corp',
      }),
      makeSource('c', null),
    ];

    const result = await searchCascade('XYZ', undefined, sources);

    expect(result).toEqual({
      found: false,
      ticker: 'XYZ',
      companyName: 'Xyz Corp',
    });
  });

  it('passes type parameter to sources', async () => {
    const sources = [
      makeSource('a', {
        found: true,
        ticker: 'BTC',
        companyName: 'Bitcoin',
        imageUrl: 'https://example.com/btc.png',
        source: 'a',
      }),
    ];

    await searchCascade('BTC', 'crypto', sources);

    expect(sources[0].search).toHaveBeenCalledWith('BTC', 'crypto');
  });

  it('skips sources that throw and continues cascade', async () => {
    const errorSource: SourceModule = {
      name: 'broken',
      search: vi.fn().mockRejectedValue(new Error('network error')),
    };
    const goodSource = makeSource('good', {
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'good',
    });

    const result = await searchCascade('AAPL', undefined, [errorSource, goodSource]);

    expect(result.found).toBe(true);
  });
});
