import express from "express";
import prisma from "../prismaClient.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =====================================================
   GET CURRENT USER (สำหรับหน้า Booking / Profile)
===================================================== */
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        name: true,
        surname: true,
        phone: true,
        address: true,
        role: true,
        status: true,
      },
    });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    res.json(user);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch user",
    });
  }
});

/* =====================================================
   GET ALL USERS (ADMIN)
===================================================== */
router.get("/", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        surname: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.json(users);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   UPDATE USER
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, name, surname, phone, address, role } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    /* 🔥 ตรวจ username ซ้ำ */
    if (username && username !== user.username) {
      const existUser = await prisma.user.findFirst({
        where: { username, NOT: { id } },
      });
      if (existUser)
        return res.status(400).json({ message: "Username ซ้ำ" });
    }

    /* 🔥 ตรวจ phone ซ้ำ */
    if (phone && phone !== user.phone) {
      const existPhone = await prisma.user.findFirst({
        where: { phone, NOT: { id } },
      });
      if (existPhone)
        return res.status(400).json({ message: "เบอร์โทรซ้ำ" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        username: username ?? user.username,
        name: name ?? user.name,
        surname: surname ?? user.surname,
        phone: phone ?? user.phone,
        address: address ?? user.address,
        role: role ?? user.role,
      },
      select: {
        id: true,
        username: true,
        name: true,
        surname: true,
        phone: true,
        address: true,
        role: true,
        status: true,
      },
    });

    res.json(updated);

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Update failed" });
  }
});

/* =====================================================
   SOFT DELETE USER
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.json({ message: "Deleted" });

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Delete failed" });
  }
});

export default router;
