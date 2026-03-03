import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

router.post("/register", register);
router.post("/login", limiter, login);
router.post("/refresh", refresh);
router.post("/logout", authenticate, logout);

export default router;