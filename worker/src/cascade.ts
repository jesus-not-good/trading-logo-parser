import type { LogoResult, SourceModule, InstrumentType } from './types';

export async function searchCascade(
  ticker: string,
  type: InstrumentType | undefined,
  sources: SourceModule[]
): Promise<LogoResult> {
  let bestCompanyName: string | null = null;

  for (const source of sources) {
    try {
      const result = await source.search(ticker, type);
      if (result === null) continue;

      if (result.found) {
        return result;
      }

      // Source recognized the ticker but had no image — remember the name
      if (result.companyName && !bestCompanyName) {
        bestCompanyName = result.companyName;
      }
    } catch {
      // Source threw — skip it, try next
      continue;
    }
  }

  return {
    found: false,
    ticker,
    companyName: bestCompanyName,
  };
}
