import { db } from "@safuney/db";
import { QuoteService } from "./service";

export * from "./service";

export function quoteService(): QuoteService {
  return new QuoteService(db());
}
