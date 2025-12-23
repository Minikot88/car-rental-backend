import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ทุก 10 นาที ยกเลิก reservation pending > 24h
cron.schedule("*/10 * * * *", async () => {
  try {
    const expired = await prisma.reservation.findMany({
      where: {
        status: "pending",
        created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    for (const r of expired) {
      await prisma.reservation.update({
        where: { reservation_id: r.reservation_id },
        data: { status: "cancelled" },
      });
    }

    if (expired.length > 0) {
      console.log("Expired reservations auto-cancelled:", expired.length);
    }
  } catch (err) {
    console.error("Error in reservationExpiry cron:", err);
  }
});
