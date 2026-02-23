import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";
import omise from "../config/omise.js";

const router = express.Router();

/* =====================================================
   CREATE PROMPTPAY QR (OMISE)
===================================================== */
router.post("/confirm", authenticate, async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId)
      return res.status(400).json({ message: "Missing reservationId" });

    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(reservationId) },
      include: { payment: true }
    });

    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });

    if (reservation.userId !== req.user.id)
      return res.status(403).json({ message: "Not your reservation" });

    if (!["PENDING", "WAITING_PAYMENT"].includes(reservation.status))
      return res.status(400).json({ message: "Invalid reservation status" });

    if (
      reservation.lockExpiresAt &&
      reservation.lockExpiresAt < new Date()
    )
      return res.status(400).json({ message: "Reservation expired" });

    // ✅ ถ้าเคยสร้าง QR แล้ว → return ของเดิม (กันยิงซ้ำ)
    if (
      reservation.payment &&
      reservation.payment.status === "PENDING" &&
      reservation.payment.omiseChargeId
    ) {
      const charge = await omise.charges.retrieve(
        reservation.payment.omiseChargeId
      );

      return res.json({
        qrImage:
          charge?.source?.scannable_code?.image?.download_uri,
        expiresAt: charge?.source?.scannable_code?.expires_at
      });
    }

    // 🔥 convert to satang
    const amount = Math.round(reservation.totalPrice * 100);

    if (amount < 2000)
      return res.status(400).json({
        message: "Minimum payment is 20 THB"
      });

    console.log("Creating Omise source with amount:", amount);

    const source = await omise.sources.create({
      type: "promptpay",
      amount,
      currency: "thb"
    });

    const charge = await omise.charges.create({
      amount,
      currency: "thb",
      source: source.id,
      description: `Reservation #${reservation.id}`
    });

    console.log("Charge created:", charge.id);

    const qrImage =
      charge?.source?.scannable_code?.image?.download_uri;

    if (!qrImage)
      return res.status(500).json({
        message: "QR generation failed"
      });

    // 🔥 UPSERT PAYMENT
    await prisma.payment.upsert({
      where: { reservationId: reservation.id },
      update: {
        status: "PENDING",
        omiseChargeId: charge.id,
        gateway: "OMISE"
      },
      create: {
        reservationId: reservation.id,
        method: "QR",
        amount: reservation.totalPrice,
        status: "PENDING",
        omiseChargeId: charge.id,
        gateway: "OMISE"
      }
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "WAITING_PAYMENT" }
    });

    return res.json({
      qrImage,
      expiresAt: charge.source?.scannable_code?.expires_at
    });

  } catch (err) {
    console.error("CONFIRM ERROR:", err);
    res.status(500).json({ message: "Payment failed" });
  }
});


/* =====================================================
   OMISE WEBHOOK (AUTO CONFIRM)
===================================================== */
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.key !== "charge.complete")
      return res.sendStatus(200);

    const charge = event.data;

    if (charge.status !== "successful")
      return res.sendStatus(200);

    const payment = await prisma.payment.findUnique({
      where: { omiseChargeId: charge.id }
    });

    if (!payment || payment.status === "PAID")
      return res.sendStatus(200);

    await prisma.$transaction(async (tx) => {

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: new Date()
        }
      });

      const reservation = await tx.reservation.update({
        where: { id: payment.reservationId },
        data: { status: "CONFIRMED" }
      });

      await tx.car.update({
        where: { id: reservation.carId },
        data: { status: "BOOKED" }
      });

    });

    console.log("Payment confirmed:", charge.id);

    res.sendStatus(200);

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(500);
  } 
});

/* =====================================================
   CHECK PAYMENT STATUS (POLLING)
===================================================== */
router.get("/status/:reservationId", authenticate, async (req, res) => {
  try {
    const reservationId = Number(req.params.reservationId);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payment: true }
    });

    if (!reservation)
      return res.status(404).json({ message: "Not found" });

    return res.json({
      reservationStatus: reservation.status,
      paymentStatus: reservation.payment?.status || null
    });

  } catch (err) {
    res.status(500).json({ message: "Status check failed" });
  }
});


router.post(
  "/admin/approve/:reservationId",
  authenticate,
  async (req, res) => {
    try {
      if (req.user.role !== "ADMIN")
        return res.status(403).json({ message: "Unauthorized" });

      const reservationId = Number(req.params.reservationId);

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { payment: true }
      });

      if (!reservation || !reservation.payment)
        return res.status(404).json({ message: "Payment not found" });

      if (reservation.payment.status === "PAID")
        return res.json({ message: "Already approved" });

      await prisma.$transaction(async (tx) => {

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
      console.error("APPROVE ERROR:", err);
      res.status(500).json({ message: "Approval failed" });
    }
  }
);

export default router;