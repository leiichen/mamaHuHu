import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

const prisma = new PrismaClient();

const rows = await prisma.serie_fragment.findMany({
  orderBy: { sort_order: "asc" },
  take: 40,
  select: { id: true, serie_id: true, sort_order: true, cover: true, video: true, duration_sec: true, params: true },
});

for (const r of rows) {
  console.log(JSON.stringify({
    id: r.id, serie_id: r.serie_id, sort: r.sort_order,
    cover: r.cover, coverLen: r.cover?.length ?? 0,
    hasVideo: Boolean(r.video), duration: r.duration_sec, params: r.params,
  }));
}
await prisma.$disconnect();
