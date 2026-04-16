export type InstrumentType = 'stock' | 'crypto' | 'forex' | 'commodity' | 'index';

export interface LogoFound {
  found: true;
  ticker: string;
  companyName: string;
  imageUrl: string;
  source: string;
}

export interface LogoNotFound {
  found: false;
  ticker: string;
  companyName: string | null;
}

export type LogoResult = LogoFound | LogoNotFound;

export interface SourceModule {
  name: string;
  search: (ticker: string, type?: InstrumentType) => Promise<LogoResult | null>;
}

export interface Env {
  LOGO_CACHE: KVNamespace;
  LOGO_IMAGES?: R2Bucket;
}
