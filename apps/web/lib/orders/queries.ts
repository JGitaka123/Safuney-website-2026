import { cache } from "react";
import { db } from "@safuney/db";
import { services } from "@/lib/env";

export const getOrder = cache(async (number: string, accessToken: string) => {
  if (!services.database()) return null;
  return db().order.findFirst({
    where: { number, accessToken },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      deliveryZone: {
        select: { name: true, leadTimeDays: true },
      },
    },
  });
});
