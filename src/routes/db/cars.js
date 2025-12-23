import express from "express";
import { PrismaClient } from "@prisma/client";
import { authAdmin } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Create car
router.post("/", authAdmin, async (req, res) => {
  const car = await prisma.cars.create({ data: req.body });
  res.json(car);
});

// List cars with search & filter
router.get("/", async (req, res) => {
  const { brand, model, color, status } = req.query;
  const where = { deleted_at: null };
  if (brand) where.brand = brand;
  if (model) where.model = model;
  if (color) where.color = color;
  if (status) where.status = status;
  const cars = await prisma.cars.findMany({ where });
  res.json(cars);
});

// Update car
router.put("/:id", authAdmin, async (req, res) => {
  const car = await prisma.cars.update({
    where: { car_id: req.params.id },
    data: req.body,
  });
  res.json(car);
});

// Soft delete car
router.delete("/:id", authAdmin, async (req, res) => {
  const car = await prisma.cars.update({
    where: { car_id: req.params.id },
    data: { deleted_at: new Date() },
  });
  res.json({ message: "Soft deleted", car });
});

export default router;
