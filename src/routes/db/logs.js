import express from "express";
import { PrismaClient } from "@prisma/client";
import { authAdmin } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", authAdmin, async (req, res) => {
  const logs = await prisma.logs.findMany({ orderBy: { created_at: "desc" } });
  res.json(logs);
});

export default router;
