import express from "express";
import adminsRouter from "./db/admins.js";
import usersRouter from "./db/users.js";
import carsRouter from "./db/cars.js";
import reservationsRouter from "./db/reservations.js";
import checkinRouter from "./db/checkin_checkout.js";
import notificationsRouter from "./db/notifications.js";
import paymentsRouter from "./db/payments.js";
import logsRouter from "./db/logs.js";
import statsRouter from "./db/stats.js";
import reviewsRouter from "./db/reviews.js";
import autoCancelRouter from "./db/auto-cancel.js";

const router = express.Router();

router.get("/", (req, res) => res.send("Car Rental Backend is running"));

router.use("/admins", adminsRouter);
router.use("/users", usersRouter);
router.use("/cars", carsRouter);
router.use("/reservations", reservationsRouter);
router.use("/checkin_checkout", checkinRouter);
router.use("/notifications", notificationsRouter);
router.use("/payments", paymentsRouter);
router.use("/logs", logsRouter);
router.use("/stats", statsRouter);
router.use("/reviews", reviewsRouter);
router.use("/auto-cancel", autoCancelRouter);

export default router;
