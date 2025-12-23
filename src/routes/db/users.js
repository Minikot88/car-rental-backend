import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authUser, permit } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post("/register", async (req, res) => {
  const {
    first_name,
    last_name,
    username,
    password,
    id_card,
    phone,
    role = "user",
  } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.users.create({
    data: {
      first_name,
      last_name,
      username,
      password_hash: hash,
      id_card,
      phone,
      role,
    },
  });
  res.json(user);
});

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.users.findUnique({ where: { username } });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });
  const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
});

// Get all users
router.get("/", authUser, permit("admin", "staff"), async (req, res) => {
  const users = await prisma.users.findMany({ where: { deleted_at: null } });
  res.json(users);
});

// Update user
router.put("/:id", authUser, permit("admin", "staff"), async (req, res) => {
  const { first_name, last_name, phone, password } = req.body;
  const data = { first_name, last_name, phone };
  if (password) data.password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.users.update({
    where: { user_id: req.params.id },
    data,
  });
  res.json(user);
});

// Soft delete
router.delete("/:id", authUser, permit("admin"), async (req, res) => {
  const user = await prisma.users.update({
    where: { user_id: req.params.id },
    data: { deleted_at: new Date() },
  });
  res.json({ message: "Soft deleted", user });
});

export default router;
