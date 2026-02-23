import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =====================================================
   GET RESERVATION STATUS (สำหรับ Waiting Page)
===================================================== */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);

    if (isNaN(reservationId)) {
      return res.status(400).json({ message: "Invalid reservation id" });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        payment: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // 🔐 ป้องกันดูของคนอื่น
    if (
      reservation.userId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(reservation);

  } catch (err) {
    console.error("GET RESERVATION STATUS ERROR:", err);
    res.status(500).json({ message: "Fetch reservation failed" });
  }
});

export default router;
