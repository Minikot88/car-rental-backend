import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Add review
router.post("/", authUser, async (req, res) => {
  const { car_id, rating, comment } = req.body;
  const review = await prisma.reviews.create({
    data: { user_id: req.user.user_id, car_id, rating, comment },
  });
  res.json(review);
});

// Get reviews for a car
router.get("/car/:car_id", async (req, res) => {
  const reviews = await prisma.reviews.findMany({
    where: { car_id: req.params.car_id },
  });
  res.json(reviews);
});

export default router;
