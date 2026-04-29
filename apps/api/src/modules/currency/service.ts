import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../../middleware/errorHandler";

type FiatEntry = { code: string; name: string; country: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const supportedPath = join(__dirname, "../../data/supported-fiat-currencies.json");
const SUPPORTED_LIST: FiatEntry[] = JSON.parse(readFileSync(supportedPath, "utf-8"));
const SUPPORTED_CODES = new Set(SUPPORTED_LIST.map((c) => c.code.toUpperCase()));

const CDN_RATES = (base: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;

export const currencyService = {
  listSupported(): FiatEntry[] {
    return SUPPORTED_LIST;
  },

  isSupportedCode(code: string): boolean {
    return SUPPORTED_CODES.has(code.trim().toUpperCase());
  },

  async ratesForBase(baseRaw: string) {
    const base = baseRaw.trim().toUpperCase();
    if (!SUPPORTED_CODES.has(base)) {
      throw new AppError(404, "NOT_FOUND", "Unsupported currency code");
    }

    const res = await fetch(CDN_RATES(base));
    if (!res.ok) {
      throw new AppError(502, "UPSTREAM_ERROR", "Rates provider request failed");
    }

    return res.json() as Promise<Record<string, unknown>>;
  },
};
