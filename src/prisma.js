// src/prisma.js
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// ใช้ DATABASE_URL จาก .env ที่คุณเซ็ตไว้แล้ว
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// สร้าง PrismaClient แบบง่าย ๆ แต่ถูกต้องตาม Prisma 7
export const prisma = new PrismaClient({ adapter }); 
