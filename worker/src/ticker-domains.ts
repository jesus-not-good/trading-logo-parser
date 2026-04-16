export interface TickerInfo {
  domain: string;
  name: string;
}

// Popular tickers → company domain + name
// Expand over time from SEC EDGAR, Wikipedia, etc.
export const TICKER_DOMAINS: Record<string, TickerInfo> = {
  AAPL: { domain: 'apple.com', name: 'Apple Inc' },
  MSFT: { domain: 'microsoft.com', name: 'Microsoft Corporation' },
  GOOGL: { domain: 'google.com', name: 'Alphabet Inc' },
  GOOG: { domain: 'google.com', name: 'Alphabet Inc' },
  AMZN: { domain: 'amazon.com', name: 'Amazon.com Inc' },
  META: { domain: 'meta.com', name: 'Meta Platforms Inc' },
  TSLA: { domain: 'tesla.com', name: 'Tesla Inc' },
  NVDA: { domain: 'nvidia.com', name: 'NVIDIA Corporation' },
  JPM: { domain: 'jpmorganchase.com', name: 'JPMorgan Chase & Co' },
  V: { domain: 'visa.com', name: 'Visa Inc' },
  MA: { domain: 'mastercard.com', name: 'Mastercard Inc' },
  DIS: { domain: 'disney.com', name: 'The Walt Disney Company' },
  NFLX: { domain: 'netflix.com', name: 'Netflix Inc' },
  PYPL: { domain: 'paypal.com', name: 'PayPal Holdings Inc' },
  ADBE: { domain: 'adobe.com', name: 'Adobe Inc' },
  CRM: { domain: 'salesforce.com', name: 'Salesforce Inc' },
  INTC: { domain: 'intel.com', name: 'Intel Corporation' },
  AMD: { domain: 'amd.com', name: 'Advanced Micro Devices Inc' },
  CSCO: { domain: 'cisco.com', name: 'Cisco Systems Inc' },
  ORCL: { domain: 'oracle.com', name: 'Oracle Corporation' },
  IBM: { domain: 'ibm.com', name: 'IBM Corporation' },
  UBER: { domain: 'uber.com', name: 'Uber Technologies Inc' },
  ABNB: { domain: 'airbnb.com', name: 'Airbnb Inc' },
  SQ: { domain: 'squareup.com', name: 'Block Inc' },
  SHOP: { domain: 'shopify.com', name: 'Shopify Inc' },
  SPOT: { domain: 'spotify.com', name: 'Spotify Technology SA' },
  SNAP: { domain: 'snap.com', name: 'Snap Inc' },
  PINS: { domain: 'pinterest.com', name: 'Pinterest Inc' },
  COIN: { domain: 'coinbase.com', name: 'Coinbase Global Inc' },
  BA: { domain: 'boeing.com', name: 'The Boeing Company' },
  WMT: { domain: 'walmart.com', name: 'Walmart Inc' },
  KO: { domain: 'coca-cola.com', name: 'The Coca-Cola Company' },
  PEP: { domain: 'pepsico.com', name: 'PepsiCo Inc' },
  MCD: { domain: 'mcdonalds.com', name: "McDonald's Corporation" },
  NKE: { domain: 'nike.com', name: 'NIKE Inc' },
  SBUX: { domain: 'starbucks.com', name: 'Starbucks Corporation' },
};
