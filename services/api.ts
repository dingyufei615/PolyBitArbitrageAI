import { PolySearchResponse, DeribitResponse, DeribitSpotResponse, DeribitOption } from '../types';

// List of CORS proxies to try in round-robin/failover fashion.
// These are free public proxies; rotation helps avoid rate limits (429) from the target API
// by utilizing different IP addresses from the proxy providers.
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// Cache structure
const cache: Record<string, { timestamp: number; data: any }> = {};
const DEFAULT_CACHE_DURATION = 60 * 1000; // 1 minute default

// Request deduplication map
const inFlightRequests: Record<string, Promise<any>> = {};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tries to fetch the target URL using the defined proxies.
 * Rotates through proxies on failure (Network error or 429/403).
 */
const fetchWithFailover = async (targetUrl: string): Promise<any> => {
  let lastError: any;

  for (let i = 0; i < PROXIES.length; i++) {
    const buildProxyUrl = PROXIES[i];
    const proxyUrl = buildProxyUrl(targetUrl);

    try {
      // console.log(`[API] Attempting fetch via proxy ${i + 1}/${PROXIES.length}`);
      const response = await fetch(proxyUrl);

      // If Rate Limit (429) or Forbidden (403 - often WAF blocking proxy), try next proxy
      if (response.status === 429 || response.status === 403) {
        console.warn(`[API] Proxy ${i + 1} hit rate limit/block (${response.status}). Switching...`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`[API] Proxy ${i + 1} failed: ${error.message}`);
      lastError = error;
      // Wait a tiny bit before hitting next proxy to be polite, unless it's the last one
      if (i < PROXIES.length - 1) await wait(200);
    }
  }

  throw lastError || new Error("All proxies failed to fetch data.");
};

/**
 * Wrapper for fetching with Caching, Deduplication, and Proxy Failover.
 * @param url - The raw target URL (not proxied)
 * @param duration - Cache duration in ms
 */
const fetchWithCache = async (url: string, duration = DEFAULT_CACHE_DURATION): Promise<any> => {
  const now = Date.now();
  
  // 1. Check Cache
  if (cache[url] && now - cache[url].timestamp < duration) {
    return cache[url].data;
  }

  // 2. Check In-Flight (Deduplication)
  if (inFlightRequests[url]) {
    return inFlightRequests[url];
  }

  // 3. Perform Request
  const requestPromise = (async () => {
    try {
      const data = await fetchWithFailover(url);
      cache[url] = { timestamp: Date.now(), data };
      return data;
    } finally {
      delete inFlightRequests[url];
    }
  })();

  inFlightRequests[url] = requestPromise;
  return requestPromise;
};

/**
 * Fetches Polymarket data via search query.
 */
export const fetchPolymarketData = async (query: string): Promise<PolySearchResponse> => {
  const targetUrl = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}&cache=true&optimized=false`;
  // Cache search results for 15 seconds
  return fetchWithCache(targetUrl, 15 * 1000);
};

/**
 * Fetches Deribit Option Chain for a currency (e.g., BTC).
 */
export const fetchDeribitOptions = async (currency: string = 'BTC'): Promise<DeribitOption[]> => {
  const targetUrl = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`;
  // Option chains are heavy. 60s cache.
  const data: DeribitResponse = await fetchWithCache(targetUrl, 60 * 1000);
  return data.result || [];
};

/**
 * Fetches Deribit Spot Price.
 */
export const fetchDeribitSpot = async (indexName: string = 'btc_usdc'): Promise<number> => {
  const targetUrl = `https://www.deribit.com/api/v2/public/get_index_price?index_name=${indexName}`;
  // Spot price: 30s cache.
  const data: DeribitSpotResponse = await fetchWithCache(targetUrl, 30 * 1000);
  return data.result?.price || 0;
};