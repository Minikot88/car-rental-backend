import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getAnalyticsData } from "../services/analytics.service.js";

const router = express.Router();

// Async wrapper (ไม่ต้อง try/catch ทุก route)
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  "/analytics",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = await getAnalyticsData();

    return res.status(200).json({
      success: true,
      data,
    });
  })
);

export default router;