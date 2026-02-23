import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prismaClient.js";

import authRoutes from "./routes/auth.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import checkinRoutes from "./routes/checkin.routes.js";
import carRoutes from "./routes/car.routes.js";
import userRoutes from "./routes/user.routes.js";
import contractRoutes from "./routes/contract.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reservationStatusRoutes from "./routes/reservation.status.routes.js";

dotenv.config();

const app = express();

// ================= FIX __dirname =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= SECURITY =================
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ================= STATIC =================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);

// ================= HEALTH CHECK =================
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Car Rental API running 🚗" });
});

// ================= ROUTES =================
app.use("/auth", authRoutes);
app.use("/reservations", reservationRoutes);
app.use("/admin", adminRoutes);
app.use("/operations", operationsRoutes);
app.use("/checkin", checkinRoutes);
app.use("/cars", carRoutes);
app.use("/users", userRoutes);
app.use("/contracts", contractRoutes);
app.use("/payments", paymentRoutes);
app.use("/reservations", reservationStatusRoutes);

//////////////////////////////////////////////////////////
// AUTO EXPIRE RESERVATION + PAYMENT (Every 1 Minute)
//////////////////////////////////////////////////////////

const expireJob = setInterval(async () => {
  try {
    const now = new Date();

    // 🔎 หา reservation ที่หมดเวลา
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "WAITING_PAYMENT"] },
        lockExpiresAt: {
          not: null,
          lt: now,
        },
      },
      select: {
        id: true,
        carId: true,
      },
    });

    if (!expiredReservations.length) return;

    const reservationIds = expiredReservations.map(r => r.id);
    const carIds = expiredReservations.map(r => r.carId);

    await prisma.$transaction(async (tx) => {

      // 1️⃣ Expire Reservation
      await tx.reservation.updateMany({
        where: { id: { in: reservationIds } },
        data: { status: "EXPIRED" },
      });

      // 2️⃣ Expire Payment (เฉพาะที่ยังไม่ PAID)
      await tx.payment.updateMany({
        where: {
          reservationId: { in: reservationIds },
          status: { not: "PAID" },
        },
        data: { status: "EXPIRED" },
      });

      // 3️⃣ คืนรถ
      await tx.car.updateMany({
        where: { id: { in: carIds } },
        data: { status: "AVAILABLE" },
      });

    });

    console.log(`⏰ Expired ${reservationIds.length} reservations`);

  } catch (err) {
    console.error("Expire Job Error:", err);
  }
}, 60 * 1000);

//////////////////////////////////////////////////////////
// 404
//////////////////////////////////////////////////////////

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

//////////////////////////////////////////////////////////
// GLOBAL ERROR HANDLER
//////////////////////////////////////////////////////////

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

//////////////////////////////////////////////////////////
// GRACEFUL SHUTDOWN (สำคัญมาก)
//////////////////////////////////////////////////////////

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  clearInterval(expireJob);
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Server terminated...");
  clearInterval(expireJob);
  await prisma.$disconnect();
  process.exit(0);
});

//////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`🚀 API running on port ${port}`);
});
