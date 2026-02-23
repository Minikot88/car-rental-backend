import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =====================================================
   USER CONFIRM PAYMENT
===================================================== */
router.post("/confirm", authenticate, async (req, res) => {
  try {
    const { reservationId, method } = req.body;

    if (!reservationId || !method)
      return res.status(400).json({ message: "Missing payment data" });

    const validMethods = ["CASH", "TRANSFER", "CREDIT_CARD", "QR"];
    if (!validMethods.includes(method))
      return res.status(400).json({ message: "Invalid payment method" });

    await prisma.$transaction(async (tx) => {

      const reservation = await tx.reservation.findUnique({
        where: { id: Number(reservationId) },
        include: { payment: true }
      });

      if (!reservation)
        throw new Error("NOT_FOUND");

      if (reservation.userId !== req.user.id)
        throw new Error("FORBIDDEN");

      console.log("RES STATUS:", reservation.status);
      console.log("PAY STATUS:", reservation.payment?.status);

      /* =====================================================
         PRODUCTION SAFE VALIDATION
      ===================================================== */

      // 🔹 ถ้าจ่ายแล้ว → idempotent
      if (reservation.payment?.status === "PAID") {
        return;
      }

      // 🔹 ถ้ากำลังรอ verify → idempotent
      if (reservation.payment?.status === "WAITING_VERIFY") {
        return;
      }

      // 🔹 กรณี WAITING_PAYMENT แต่ไม่มี payment record (legacy fix)
      if (
        reservation.status === "WAITING_PAYMENT" &&
        !reservation.payment
      ) {
        // ปล่อยให้ flow ด้านล่างสร้าง payment ใหม่
      }
      else if (reservation.status !== "PENDING") {
        throw new Error("INVALID_STATUS");
      }

      // 🔹 เช็คหมดเวลา
      if (
        reservation.lockExpiresAt &&
        reservation.lockExpiresAt < new Date()
      ) {
        throw new Error("EXPIRED");
      }

      /* =====================================================
         CREATE OR UPDATE PAYMENT
      ===================================================== */

      if (!reservation.payment) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            method,
            amount: reservation.totalPrice,
            status: "WAITING_VERIFY"
          }
        });
      } else {
        await tx.payment.update({
          where: { reservationId: reservation.id },
          data: {
            method,
            status: "WAITING_VERIFY"
          }
        });
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "WAITING_PAYMENT" }
      });

    });

    res.json({ message: "Waiting for admin verification" });

  } catch (err) {

    const map = {
      NOT_FOUND: [404, "Reservation not found"],
      FORBIDDEN: [403, "Not your reservation"],
      INVALID_STATUS: [400, "Invalid reservation status"],
      EXPIRED: [400, "Reservation expired"]
    };

    if (map[err.message])
      return res.status(map[err.message][0]).json({
        message: map[err.message][1]
      });

    console.error("CONFIRM ERROR:", err);
    res.status(500).json({ message: "Payment failed" });
  }
});

/* =====================================================
   ADMIN APPROVE PAYMENT
===================================================== */
router.post(
  "/admin/approve/:reservationId",
  authenticate,
  async (req, res) => {
    try {

      if (req.user.role !== "ADMIN")
        return res.status(403).json({ message: "Unauthorized" });

      const reservationId = Number(req.params.reservationId);

      await prisma.$transaction(async (tx) => {

        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          include: { payment: true }
        });

        if (!reservation || !reservation.payment)
          throw new Error("NOT_FOUND");

        // 🔁 idempotent approve
        if (reservation.payment.status === "PAID") {
          return;
        }

        await tx.payment.update({
          where: { reservationId },
          data: {
            status: "PAID",
            paidAt: new Date()
          }
        });

        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "CONFIRMED" }
        });

        await tx.car.update({
          where: { id: reservation.carId },
          data: { status: "BOOKED" }
        });

      });

      res.json({ message: "Payment approved" });

    } catch (err) {

      if (err.message === "NOT_FOUND")
        return res.status(404).json({ message: "Payment not found" });

      console.error("APPROVE ERROR:", err);
      res.status(500).json({ message: "Approval failed" });
    }
  }
);

export default router;
