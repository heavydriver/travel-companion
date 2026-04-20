import { t } from "elysia";

export const CurrencyRatesParams = t.Object({
  base: t.String({ minLength: 3, maxLength: 4 }),
});

export const SupportedCurrenciesResponse = t.Object({
  currencies: t.Array(
    t.Object({
      code: t.String(),
      name: t.String(),
      country: t.String({ minLength: 2, maxLength: 2 }),
    }),
  ),
});

export const CurrencyRatesResponse = t.Any();
