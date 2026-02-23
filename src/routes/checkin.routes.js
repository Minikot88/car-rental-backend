import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

////////////////////////////////////////////////////////
// CHECK-IN (ADMIN)
////////////////////////////////////////////////////////
router.post("/:id/checkin", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Forbidden" });

    const reservationId = Number(req.params.id);
    if (isNaN(reservationId))
      return res.status(400).json({ message: "Invalid reservation id" });

    const {
      fuelLevel,
      mileageBefore,
      beforePhotos = [],
      damageReport,
    } = req.body;

    await prisma.$transaction(async (tx) => {

      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { checkinCheckout: true }
      });

      if (!reservation)
        throw new Error("NOT_FOUND");

      if (reservation.status !== "CONFIRMED")
        throw new Error("INVALID_STATUS");

      if (reservation.checkinCheckout?.checkInTime)
        throw new Error("ALREADY_CHECKED_IN");

      await tx.checkinCheckout.upsert({
        where: { reservationId },
        update: {
          checkInTime: new Date(),
          fuelLevel,
          mileageBefore: Number(mileageBefore),
          beforePhotos,
          damageReport,
        },
        create: {
          reservationId,
          checkInTime: new Date(),
          fuelLevel,
          mileageBefore: Number(mileageBefore),
          beforePhotos,
          damageReport,
        },
      });

    });

    return res.json({ message: "Check-in success" });

  } catch (err) {

    if (err.message === "NOT_FOUND")
      return res.status(404).json({ message: "Reservation not found" });

    if (err.message === "INVALID_STATUS")
      return res.status(400).json({ message: "Reservation not confirmed" });

    if (err.message === "ALREADY_CHECKED_IN")
      return res.status(400).json({ message: "Already checked in" });

    console.error("CHECK-IN ERROR:", err);
    return res.status(500).json({ message: "Check-in failed" });
  }
});

////////////////////////////////////////////////////////
// CHECK-OUT (ADMIN)
////////////////////////////////////////////////////////
router.post("/:id/checkout", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Forbidden" });

    const reservationId = Number(req.params.id);
    if (isNaN(reservationId))
      return res.status(400).json({ message: "Invalid reservation id" });

    const {
      mileageAfter,
      afterPhotos = [],
      damageCost = 0,
      fuelFull = true
    } = req.body;

    if (!mileageAfter)
      return res.status(400).json({ message: "Mileage required" });

    let fine = 0;
    let finalTotal = 0;

    await prisma.$transaction(async (tx) => {

      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { checkinCheckout: true }
      });

      if (!reservation)
        throw new Error("NOT_FOUND");

      if (!reservation.checkinCheckout?.checkInTime)
        throw new Error("NO_CHECKIN");

      if (reservation.checkinCheckout?.checkOutTime)
        throw new Error("ALREADY_CHECKED_OUT");

      const check = reservation.checkinCheckout;

      ////////////////////////////////////////////////////
      // FINE CALCULATION
      ////////////////////////////////////////////////////

      const freeKm = 300;
      const kmRate = 5;

      const usedKm =
        Number(mileageAfter) - Number(check.mileageBefore || 0);

      if (usedKm > freeKm) {
        fine += (usedKm - freeKm) * kmRate;
      }

      if (!fuelFull) fine += 1000;

      fine += Number(damageCost);

      finalTotal = reservation.totalPrice + fine;

      ////////////////////////////////////////////////////
      // UPDATE CHECKOUT
      ////////////////////////////////////////////////////

      await tx.checkinCheckout.update({
        where: { reservationId },
        data: {
          checkOutTime: new Date(),
          mileageAfter: Number(mileageAfter),
          afterPhotos,
        }
      });

      ////////////////////////////////////////////////////
      // UPDATE RESERVATION
      ////////////////////////////////////////////////////

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "COMPLETED",
          totalPrice: finalTotal
        }
      });

      ////////////////////////////////////////////////////
      // UPDATE CAR
      ////////////////////////////////////////////////////

      await tx.car.update({
        where: { id: reservation.carId },
        data: {
          status: "AVAILABLE",
          mileage: Number(mileageAfter)
        }
      });

    });

    return res.json({
      message: "Checkout completed",
      fine,
      finalTotal
    });

  } catch (err) {

    if (err.message === "NOT_FOUND")
      return res.status(404).json({ message: "Reservation not found" });

    if (err.message === "NO_CHECKIN")
      return res.status(400).json({ message: "Must check-in first" });

    if (err.message === "ALREADY_CHECKED_OUT")
      return res.status(400).json({ message: "Already checked out" });

    console.error("CHECKOUT ERROR:", err);
    return res.status(500).json({ message: "Checkout failed" });
  }
});

export default router;
