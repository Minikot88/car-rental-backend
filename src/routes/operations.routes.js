import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

////////////////////////////////////////////////////////
// TODAY OPERATIONS (ADMIN)
////////////////////////////////////////////////////////
router.get("/today", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Forbidden" });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const reservations = await prisma.reservation.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            startDate: { gte: start, lte: end },
          },
          {
            checkinCheckout: {
              checkInTime: { gte: start, lte: end },
            },
          },
          {
            checkinCheckout: {
              checkOutTime: { gte: start, lte: end },
            },
          },
        ],
      },
      include: {
        user: true,
        car: true,
        payment: true,
        checkinCheckout: true,
      },
      orderBy: { startDate: "asc" },
    });

    res.json(reservations);
  } catch (err) {
    console.error("TODAY OPS ERROR:", err);
    res.status(500).json({ message: "Fetch operations failed" });
  }
});

////////////////////////////////////////////////////////
// 7 DAYS SUMMARY
////////////////////////////////////////////////////////
router.get("/7days", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Forbidden" });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const records = await prisma.checkinCheckout.findMany({
      where: {
        checkInTime: { gte: sevenDaysAgo },
      },
      select: {
        checkInTime: true,
      },
    });

    const map = {};

    records.forEach((r) => {
      const date = r.checkInTime
        .toISOString()
        .split("T")[0];

      if (!map[date]) map[date] = 0;
      map[date]++;
    });

    res.json(map);
  } catch (err) {
    console.error("7 DAYS ERROR:", err);
    res.status(500).json({ message: "Summary failed" });
  }
});


////////////////////////////////////////////////////////
// CHECK-IN
////////////////////////////////////////////////////////
router.post("/:id/checkin", authenticate, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    if (isNaN(reservationId))
      return res.status(400).json({ message: "Invalid reservation id" });

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { checkinCheckout: true },
      });

      if (!reservation) throw new Error("NOT_FOUND");

      // สิทธิ์
      if (
        req.user.role !== "ADMIN" &&
        reservation.userId !== req.user.id
      )
        throw new Error("FORBIDDEN");

      if (reservation.status !== "CONFIRMED")
        throw new Error("NOT_CONFIRMED");

      // ❌ กันเช็คอินซ้ำ
      if (reservation.checkinCheckout?.checkInTime)
        throw new Error("ALREADY_CHECKED_IN");

      // ✅ เช็คเฉพาะวัน (ไม่สนเวลา)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDate = new Date(reservation.startDate);
      startDate.setHours(0, 0, 0, 0);

      if (today.getTime() !== startDate.getTime())
        throw new Error("NOT_CHECKIN_DAY");

      await tx.checkinCheckout.upsert({
        where: { reservationId },
        update: {
          checkInTime: new Date(),
        },
        create: {
          reservationId,
          checkInTime: new Date(),
        },
      });
    });

    res.json({ message: "Check-in success" });

  } catch (err) {
    const map = {
      NOT_FOUND: [404, "Reservation not found"],
      FORBIDDEN: [403, "Forbidden"],
      NOT_CONFIRMED: [400, "Reservation not confirmed"],
      ALREADY_CHECKED_IN: [400, "Already checked-in"],
      NOT_CHECKIN_DAY: [
        400,
        "สามารถเช็คอินได้เฉพาะวันเริ่มเช่าเท่านั้น",
      ],
    };

    if (map[err.message])
      return res.status(map[err.message][0]).json({
        message: map[err.message][1],
      });

    console.error("CHECK-IN ERROR:", err);
    res.status(500).json({ message: "Check-in failed" });
  }
});

////////////////////////////////////////////////////////
// CHECK-OUT
////////////////////////////////////////////////////////
router.post("/:id/checkout", authenticate, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    if (isNaN(reservationId))
      return res.status(400).json({ message: "Invalid reservation id" });

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { checkinCheckout: true },
      });

      if (!reservation) throw new Error("NOT_FOUND");

      if (
        req.user.role !== "ADMIN" &&
        reservation.userId !== req.user.id
      )
        throw new Error("FORBIDDEN");

      if (!reservation.checkinCheckout?.checkInTime)
        throw new Error("MUST_CHECKIN_FIRST");

      if (reservation.checkinCheckout?.checkOutTime)
        throw new Error("ALREADY_CHECKED_OUT");

      await tx.checkinCheckout.update({
        where: { reservationId },
        data: {
          checkOutTime: new Date(),
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "COMPLETED",
        },
      });
    });

    res.json({ message: "Checkout success" });

  } catch (err) {
    const map = {
      NOT_FOUND: [404, "Reservation not found"],
      FORBIDDEN: [403, "Forbidden"],
      MUST_CHECKIN_FIRST: [400, "Must check-in first"],
      ALREADY_CHECKED_OUT: [400, "Already checked-out"],
    };

    if (map[err.message])
      return res.status(map[err.message][0]).json({
        message: map[err.message][1],
      });

    console.error("CHECK-OUT ERROR:", err);
    res.status(500).json({ message: "Checkout failed" });
  }
});

export default router;
