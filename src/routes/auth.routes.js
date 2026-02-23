import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";

const router = express.Router();

/* =====================================================
   REGISTER
===================================================== */
router.post("/register", async (req, res) => {
  try {
    const { username, name, surname, phone, address, password } = req.body;

    if (!username || !name || !surname || !phone || !address || !password)
      return res.status(400).json({ message: "กรอกข้อมูลให้ครบ" });

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone)
      return res.status(400).json({ message: "เบอร์โทรซ้ำ" });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername)
      return res.status(400).json({ message: "Username ซ้ำ" });

    const hashed = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        name,
        surname,
        phone,
        address,
        password: hashed,
        role: "USER", // default USER
      },
    });

    res.status(201).json({ message: "สมัครสมาชิกสำเร็จ" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   LOGIN
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "กรอกข้อมูลให้ครบ" });

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user)
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });

    if (!process.env.JWT_SECRET)
      throw new Error("JWT_SECRET not set");

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
