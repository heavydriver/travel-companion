import Elysia from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  CurrencyRatesParams,
  CurrencyRatesResponse,
  SupportedCurrenciesResponse,
} from "./model";
import { currencyService } from "./service";

export const currencyModule = new Elysia({ prefix: "/currency" })
  .use(authGuard)
  .get(
    "/supported",
    () => ({ currencies: currencyService.listSupported() }),
    { response: SupportedCurrenciesResponse },
  )
  .get(
    "/rates/:base",
    async ({ params }) => {
      return currencyService.ratesForBase(params.base);
    },
    {
      params: CurrencyRatesParams,
      response: CurrencyRatesResponse,
    },
  );
