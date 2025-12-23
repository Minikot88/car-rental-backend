import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Create payment
router.post("/", authUser, async (req, res) => {
  const { reservation_id, amount, method } = req.body;
  const payment = await prisma.payments.create({ data: { reservation_id, amount, method } });
  res.json(payment);
});

// Mark paid
router.put("/:id/paid", authUser, async (req, res) => {
  const payment = await prisma.payments.update({
    where: { payment_id: req.params.id },
    data: { status: "paid", paid_at: new Date() },
  });
  res.json(payment);
});

export default router;
