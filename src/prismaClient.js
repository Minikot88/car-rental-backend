// src/prismaClient.js
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';

const { Pool } = pkg;

// กันสร้างซ้ำเวลา hot reload ด้วย nodemon
const globalForPrisma = globalThis;

// แชร์ pool เดียวทั้งแอป
globalForPrisma.__PG_POOL__ ??= new Pool({
  connectionString: process.env.DATABASE_URL,
});

const pool = globalForPrisma.__PG_POOL__;

// สร้าง PrismaClient พร้อม adapter
globalForPrisma.__PRISMA__ ??= new PrismaClient({
  adapter: new PrismaPg(pool),
});

export const prisma = globalForPrisma.__PRISMA__;
export default prisma;
