import express from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import xss from 'xss-clean';

dotenv.config();

// สร้าง Express app
const app = express();

// ---- Middleware ความปลอดภัย ----
// ป้องกัน HTTP headers อันตราย
app.use(helmet());

// ป้องกัน XSS attacks
app.use(xss());

// Rate limiter (จำกัดจำนวน request ต่อ IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // จำกัด 100 request ต่อ IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
 
// ตั้งค่า CORS (ปรับตามโดเมนที่อนุญาต)
app.use(cors({
  origin: 'http://localhost:3000', // เปลี่ยนเป็น frontend domain ของคุณ
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ---- Middleware พื้นฐาน ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Routes ----
app.get('/', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---- Start server ----
const port = Number(process.env.PORT) || 5000;
app.listen(port, () => {
  console.log(`🚀 API started at http://localhost:${port}/apicar/`);
});
