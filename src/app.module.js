// src/app.module.js
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}