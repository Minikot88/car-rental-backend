import express from "express";
import { PrismaClient } from "@prisma/client";
import { authUser } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", authUser, async (req, res) => {
  const notifications = await prisma.notifications.findMany({
    where: { user_id: req.user.user_id },
    orderBy: { created_at: "desc" },
  });
  res.json(notifications);
});

export default router;
