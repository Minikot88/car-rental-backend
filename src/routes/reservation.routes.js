import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

////////////////////////////////////////////////////////
// GET ALL RESERVATIONS
////////////////////////////////////////////////////////
router.get("/", authenticate, async (req, res) => {
  try {
    const where = { deletedAt: null };

    if (req.user.role !== "ADMIN") {
      where.userId = req.user.id;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        car: true,
        user: true,
        payment: true,
        checkinCheckout: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(reservations);

  } catch (err) {
    console.error("GET RESERVATIONS ERROR:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
});

////////////////////////////////////////////////////////
// CREATE RESERVATION (1 ACTIVE PER USER)
////////////////////////////////////////////////////////
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      carId,
      startDate,
      endDate,
      pickupLocation,
      dropoffLocation,
    } = req.body;

    if (!carId || !startDate || !endDate)
      return res.status(400).json({ message: "Missing fields" });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start) || isNaN(end) || start >= end)
      return res.status(400).json({ message: "Invalid date range" });

    const result = await prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // 🔒 CHECK USER HAS ACTIVE UNPAID RESERVATION
      //////////////////////////////////////////////////////
      const existingActive = await tx.reservation.findFirst({
        where: {
          userId: req.user.id,
          deletedAt: null,
          status: {
            in: ["PENDING", "WAITING_PAYMENT"]
          }
        }
      });

      if (existingActive)
        throw new Error("USER_HAS_ACTIVE_RESERVATION");

      //////////////////////////////////////////////////////
      // CHECK CAR EXISTS
      //////////////////////////////////////////////////////
      const car = await tx.car.findFirst({
        where: {
          id: Number(carId),
          deletedAt: null,
          status: { not: "MAINTENANCE" },
        },
      });

      if (!car) throw new Error("CAR_NOT_FOUND");

      //////////////////////////////////////////////////////
      // CHECK OVERLAPPING
      //////////////////////////////////////////////////////
      const overlapping = await tx.reservation.findFirst({
        where: {
          carId: Number(carId),
          deletedAt: null,
          AND: [
            { startDate: { lt: end } },
            { endDate: { gt: start } },
          ],
          OR: [
            { status: "CONFIRMED" },
            { status: "WAITING_PAYMENT" },
            {
              AND: [
                { status: "PENDING" },
                { lockExpiresAt: { gt: now } },
              ],
            },
          ],
        },
      });

      if (overlapping) throw new Error("CAR_NOT_AVAILABLE");

      //////////////////////////////////////////////////////
      // CREATE
      //////////////////////////////////////////////////////
      const diff =
        (end - start) / (1000 * 60 * 60 * 24);

      const rentalDays = Math.max(1, Math.ceil(diff));
      const totalPrice = rentalDays * Number(car.pricePerDay);

      return await tx.reservation.create({
        data: {
          userId: req.user.id,
          carId: Number(carId),
          startDate: start,
          endDate: end,
          pickupLocation: pickupLocation || "สาขาหลัก",
          dropoffLocation: dropoffLocation || "สาขาหลัก",
          totalPrice,
          status: "WAITING_PAYMENT",
          lockExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
        include: {
          car: true,
          user: true,
        },
      });
    });

    res.status(201).json(result);

  } catch (err) {

    if (err.message === "USER_HAS_ACTIVE_RESERVATION")
      return res.status(400).json({
        message: "คุณมีรายการจองที่ยังไม่ได้ชำระเงินอยู่"
      });

    if (err.message === "CAR_NOT_FOUND")
      return res.status(404).json({ message: "Car not found" });

    if (err.message === "CAR_NOT_AVAILABLE")
      return res.status(400).json({ message: "Car not available" });

    console.error("CREATE ERROR:", err);
    res.status(500).json({ message: "Create failed" });
  }
});

////////////////////////////////////////////////////////
// UPDATE STATUS (ADMIN)
////////////////////////////////////////////////////////
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Forbidden" });

    const id = Number(req.params.id);
    const { status } = req.body;

    const allowed = [
      "PENDING",
      "WAITING_PAYMENT",
      "CONFIRMED",
      "CANCELLED",
      "COMPLETED",
      "EXPIRED",
    ];

    if (!allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { status },
    });

    res.json(reservation);

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
});

////////////////////////////////////////////////////////
// DELETE (SOFT CANCEL)
////////////////////////////////////////////////////////
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation)
      return res.status(404).json({ message: "Not found" });

    if (
      req.user.role !== "ADMIN" &&
      reservation.userId !== req.user.id
    )
      return res.status(403).json({ message: "Forbidden" });

    await prisma.reservation.update({
      where: { id },
      data: {
        status: "CANCELLED",
        deletedAt: new Date(),
      },
    });

    res.json({ message: "Cancelled" });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Cancel failed" });
  }
});

export default router;
