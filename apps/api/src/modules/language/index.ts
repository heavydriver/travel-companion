import Elysia, { t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
  LanguageListResponse,
  LanguagePhraseListResponse,
  LanguagePhraseQuery,
} from "./model";
import { languageService } from "./service";

export const languageModule = new Elysia({ prefix: "/languages" })
  .use(authGuard)
  .get(
    "/",
    async () => {
      const languages = await languageService.list();
      return { languages };
    },
    { response: LanguageListResponse }
  )
  .get(
    "/:languageId/phrases",
    async ({ params, query }) => {
      return languageService.listPhrasesByLanguage(
        params.languageId,
        query.page ?? 1,
        query.destinationId,
      );
    },
    {
      params: t.Object({ languageId: t.String() }),
      query: LanguagePhraseQuery,
      response: LanguagePhraseListResponse,
    }
  );

