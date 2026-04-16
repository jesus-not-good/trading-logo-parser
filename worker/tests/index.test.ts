import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cascade module
vi.mock('../src/cascade', () => ({
  searchCascade: vi.fn(),
}));

import { searchCascade } from '../src/cascade';
import worker from '../src/index';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockEnv = {
  LOGO_CACHE: mockKV as unknown as KVNamespace,
};

function makeRequest(path: string): Request {
  return new Request(`https://worker.dev${path}`);
}

describe('worker router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);
  });

  it('GET /logo?ticker=AAPL returns found result', async () => {
    (searchCascade as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'tradingview',
    });

    const response = await worker.fetch(makeRequest('/logo?ticker=AAPL'), mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.ticker).toBe('AAPL');
    expect(body.companyName).toBe('Apple Inc');
    expect(body.imageUrl).toContain('/image/AAPL');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('GET /logo without ticker returns 400', async () => {
    const response = await worker.fetch(makeRequest('/logo'), mockEnv);

    expect(response.status).toBe(400);
  });

  it('GET /logo returns cached result from KV', async () => {
    mockKV.get.mockResolvedValue(JSON.stringify({
      found: true,
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      imageUrl: 'https://example.com/aapl.png',
      source: 'tradingview',
    }));

    const response = await worker.fetch(makeRequest('/logo?ticker=AAPL'), mockEnv);
    const body = await response.json();

    expect(body.found).toBe(true);
    expect(searchCascade).not.toHaveBeenCalled();
  });

  it('unknown route returns 404', async () => {
    const response = await worker.fetch(makeRequest('/unknown'), mockEnv);

    expect(response.status).toBe(404);
  });

  it('OPTIONS request returns CORS headers', async () => {
    const request = new Request('https://worker.dev/logo', { method: 'OPTIONS' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('GET /image/:key returns 404 when key not in KV', async () => {
    mockKV.get.mockResolvedValue(null);

    const response = await worker.fetch(makeRequest('/image/unknown'), mockEnv);

    expect(response.status).toBe(404);
  });
});
