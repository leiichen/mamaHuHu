import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });
const prisma = new PrismaClient();
const rows = await prisma.serie_fragment.findMany({
  where: { NOT: { video: "" } },
  orderBy: { id: "asc" },
  select: { id: true, serie_id: true, sort_order: true, cover: true, video: true, duration_sec: true },
});
for (const r of rows) {
  console.log(JSON.stringify({ id: r.id, serie_id: r.serie_id, sort: r.sort_order, cover: r.cover, video: r.video, duration: r.duration_sec }));
}
console.log("TOTAL with video:", rows.length);
await prisma.$disconnect();
