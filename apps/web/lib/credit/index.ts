import { db } from "@safuney/db";
import { CreditService } from "./service";

export * from "./service";

export function creditService(): CreditService {
  return new CreditService(db());
}
