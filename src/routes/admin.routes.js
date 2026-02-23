import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getAnalyticsData } from "../services/analytics.service.js";

const router = express.Router();

router.get(
  "/analytics",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const data = await getAnalyticsData();
      res.json(data);
    } catch (err) {
      console.error("ANALYTICS ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
