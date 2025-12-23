import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser, permit } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Checkin
router.post("/checkin/:reservation_id", authUser, permit("staff", "admin"), async (req, res) => {
  const cc = await prisma.checkin_checkout.create({
    data: {
      reservation_id: req.params.reservation_id,
      checkin_time: new Date(),
      status: "checked-in",
    },
  });
  res.json(cc);
});

// Checkout
router.post("/checkout/:reservation_id", authUser, permit("staff", "admin"), async (req, res) => {
  const cc = await prisma.checkin_checkout.updateMany({
    where: { reservation_id: req.params.reservation_id, status: "checked-in" },
    data: { checkout_time: new Date(), status: "checked-out" },
  });
  res.json(cc);
});

export default router;
