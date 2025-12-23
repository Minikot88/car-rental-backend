import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// ตรวจสอบ availability
router.post("/check-availability", authUser, async (req, res) => {
  const { car_id, start_date, end_date } = req.body;
  const conflicts = await prisma.reservations.findMany({
    where: {
      car_id,
      status: { not: "cancelled" },
      OR: [
        {
          start_date: { lte: new Date(end_date) },
          end_date: { gte: new Date(start_date) },
        },
      ],
    },
  });
  res.json({ available: conflicts.length === 0 });
});

// สร้าง reservation
router.post("/", authUser, async (req, res) => {
  const { car_id, start_date, end_date, insurance_fee = 0 } = req.body;
  const conflicts = await prisma.reservations.findMany({
    where: {
      car_id,
      status: { not: "cancelled" },
      OR: [
        {
          start_date: { lte: new Date(end_date) },
          end_date: { gte: new Date(start_date) },
        },
      ],
    },
  });
  if (conflicts.length > 0)
    return res.status(400).json({ error: "Car not available" });

  const car = await prisma.cars.findUnique({ where: { car_id } });
  const days =
    Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) +
    1;
  const total_price = car.price_per_day * days + insurance_fee;

  const reservation = await prisma.reservations.create({
    data: {
      user_id: req.user.user_id,
      car_id,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      total_price,
    },
  });
  res.json(reservation);
});

export default router;
