import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /notifications
 * ดึง notification ของ user ปัจจุบัน
 */
router.get("/notifications", authUser, async (req, res) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { user_id: req.user.user_id },
      orderBy: { created_at: "desc" },
    });
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

/**
 * ฟังก์ชันช่วย auto-cancel reservations pending
 */
export const autoCancelReservations = async () => {
  const now = new Date();

  const pendingReservations = await prisma.reservations.findMany({
    where: {
      status: "pending",
      start_date: { lt: now },
    },
  });

  if (pendingReservations.length === 0) return 0;

  await Promise.all(
    pendingReservations.map(async (reservation) => {
      // อัปเดต status เป็น canceled
      await prisma.reservations.update({
        where: { reservation_id: reservation.reservation_id },
        data: { status: "canceled", updated_at: now },
      });

      // สร้าง notification ให้ user
      await prisma.notifications.create({
        data: {
          user_id: reservation.user_id,
          reservation_id: reservation.reservation_id,
          message: `Your reservation ${reservation.reservation_id} has been automatically canceled.`,
          type: "auto-cancel",
          status: "unread",
        },
      });
    })
  );

  return pendingReservations.length;
};

/**
 * GET /auto-cancel
 * เรียกเพื่อ auto-cancel reservations ที่เกินเวลา
 */
router.get("/auto-cancel", async (req, res) => {
  try {
    const count = await autoCancelReservations();
    res.json({ message: `${count} reservation(s) canceled automatically.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to auto-cancel reservations." });
  }
});

export default router;
