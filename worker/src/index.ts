import type { Env, InstrumentType, LogoResult } from './types';
import { searchCascade } from './cascade';
import { tradingviewSource } from './sources/tradingview';
import { coingeckoSource } from './sources/coingecko';
import { clearbitSource } from './sources/clearbit';
import { logodevSource } from './sources/logodev';
import { githubCryptoSource } from './sources/github-crypto';

const SOURCES = [
  tradingviewSource,
  coingeckoSource,
  clearbitSource,
  logodevSource,
  githubCryptoSource,
];

const CACHE_TTL_FOUND = 60 * 60 * 24 * 7; // 7 days
const CACHE_TTL_NOT_FOUND = 60 * 60 * 24; // 1 day

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

async function handleLogo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker');
  const type = url.searchParams.get('type') as InstrumentType | null;

  if (!ticker) {
    return jsonResponse({ error: 'ticker parameter required' }, 400);
  }

  const cacheKey = `logo:${ticker.toUpperCase()}`;

  // Check KV cache
  const cached = await env.LOGO_CACHE.get(cacheKey);
  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  // Search cascade
  const result = await searchCascade(ticker, type ?? undefined, SOURCES);

  // Store in KV (with original imageUrl for proxy)
  const ttl = result.found ? CACHE_TTL_FOUND : CACHE_TTL_NOT_FOUND;
  await env.LOGO_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });

  // Rewrite imageUrl to point to our proxy
  if (result.found) {
    const selfUrl = new URL(request.url);
    result.imageUrl = `${selfUrl.origin}/image/${ticker.toUpperCase()}`;
  }

  return jsonResponse(result);
}

async function handleImage(request: Request, env: Env, key: string): Promise<Response> {
  // Check R2 first if available
  if (env.LOGO_IMAGES) {
    const object = await env.LOGO_IMAGES.get(key);
    if (object) {
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...corsHeaders(),
        },
      });
    }
  }

  // Look up the original URL from KV
  const cached = await env.LOGO_CACHE.get(`logo:${key.toUpperCase()}`);
  if (!cached) {
    return jsonResponse({ error: 'image not found' }, 404);
  }

  const data = JSON.parse(cached);
  if (!data.found || !data.imageUrl) {
    return jsonResponse({ error: 'image not found' }, 404);
  }

  // Proxy the image from the original source
  try {
    const imageResponse = await fetch(data.imageUrl);
    if (!imageResponse.ok) {
      return jsonResponse({ error: 'upstream image fetch failed' }, 502);
    }

    const imageBytes = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/png';

    // Store in R2 if available
    if (env.LOGO_IMAGES) {
      await env.LOGO_IMAGES.put(key, imageBytes, {
        httpMetadata: { contentType },
      });
    }

    return new Response(imageBytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
        ...corsHeaders(),
      },
    });
  } catch {
    return jsonResponse({ error: 'image proxy failed' }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/logo') {
      return handleLogo(request, env);
    }

    const imageMatch = url.pathname.match(/^\/image\/(.+)$/);
    if (imageMatch) {
      return handleImage(request, env, imageMatch[1]);
    }

    return jsonResponse({ error: 'not found' }, 404);
  },
};
