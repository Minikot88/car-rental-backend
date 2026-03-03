import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prismaClient.js";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import reservationStatusRoutes from "./routes/reservation.status.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import checkinRoutes from "./routes/checkin.routes.js";
import carRoutes from "./routes/car.routes.js";
import userRoutes from "./routes/user.routes.js";
import contractRoutes from "./routes/contract.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import pdfRoutes from "./routes/pdf.routes.js";

dotenv.config();

const app = express();

// =====================================================
// FIX __dirname (ESM)
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// SECURITY
// =====================================================
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());
app.use(cookieParser());

// =====================================================
// CORS (SAFE)
// =====================================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// =====================================================
// BODY LIMIT
// =====================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// =====================================================
// RATE LIMIT
// =====================================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// =====================================================
// LOGGING (Production Friendly)
// =====================================================
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// =====================================================
// STATIC FILES
// =====================================================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);

// =====================================================
// HEALTH CHECK
// =====================================================
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// =====================================================
// ROUTES
// =====================================================
app.use("/auth", authRoutes);
app.use("/reservations", reservationRoutes);
app.use("/reservations/status", reservationStatusRoutes);
app.use("/admin", adminRoutes);
app.use("/operations", operationsRoutes);
app.use("/checkin", checkinRoutes);
app.use("/cars", carRoutes);
app.use("/users", userRoutes);
app.use("/contracts", contractRoutes);
app.use("/payments", paymentRoutes);
app.use("/pdf", pdfRoutes);

// =====================================================
// AUTO EXPIRE JOB (SAFE VERSION)
// =====================================================

const startExpireJob = () => {
  if (process.env.ENABLE_EXPIRE_JOB !== "true") {
    console.log("⚠ Expire job disabled");
    return;
  }

  console.log("⏰ Expire job started");

  setInterval(async () => {
    try {
      const now = new Date();

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
        await tx.reservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { status: "EXPIRED" },
        });

        await tx.payment.updateMany({
          where: {
            reservationId: { in: reservationIds },
            status: { not: "PAID" },
          },
          data: { status: "EXPIRED" },
        });

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
};

startExpireJob();

// =====================================================
// 404
// =====================================================
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================
app.use((err, _req, res, _next) => {
  console.error(err);

  if (err.code === "P2002") {
    return res.status(400).json({
      message: "Duplicate field value",
    });
  }

  res.status(err.status || 500).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================
const shutdown = async () => {
  console.log("🛑 Shutting down server...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// =====================================================
// START SERVER
// =====================================================
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`🚀 API running on port ${port}`);
});