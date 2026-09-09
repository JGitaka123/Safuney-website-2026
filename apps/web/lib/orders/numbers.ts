import type { Prisma } from "@safuney/db";
import { ORDER_NUMBER_PREFIX } from "@safuney/config";

/** SFN-YYYYMMDD-NNNN. Serialised with an advisory lock inside the caller's transaction. */
export async function nextOrderNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${ORDER_NUMBER_PREFIX}-${day}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('order-number'))`;
  const last = await tx.order.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
