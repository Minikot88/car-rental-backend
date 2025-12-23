import express from "express";
import { PrismaClient } from "@prisma/client";
import { authAdmin } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", authAdmin, async (req, res) => {
  const totalUsers = await prisma.users.count();
  const activeUsers = await prisma.users.count({ where: { deleted_at: null } });
  const totalReservations = await prisma.reservations.count();
  const totalRevenue = await prisma.payments.aggregate({
    _sum: { amount: true },
    where: { status: "paid" },
  });
  const availableCars = await prisma.cars.count({ where: { status: "available" } });
  const bookedCars = await prisma.cars.count({ where: { status: "booked" } });

  res.json({
    totalUsers,
    activeUsers,
    totalReservations,
    totalRevenue: totalRevenue._sum.amount || 0,
    availableCars,
    bookedCars,
  });
});

export default router;
