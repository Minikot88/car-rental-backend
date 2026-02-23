import prisma from "../prismaClient.js";

export const getAnalyticsData = async () => {
  const now = new Date();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  /* ================= PARALLEL KPI ================= */

  const [
    totalUsers,
    totalCars,
    totalBookings,
    totalRevenue,
    todayRevenue,
    monthRevenue,
    todayCount,
    weekCount,
    monthCount,
    canceled,
    paidAmount,
    pendingAmount,
    availableCars,
    usingCars,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),

    prisma.car.count({ where: { deletedAt: null } }),

    prisma.reservation.count({ where: { deletedAt: null } }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "PAID",
        paidAt: { not: null, gte: startOfToday },
      },
    }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "PAID",
        paidAt: { not: null, gte: startOfMonth },
      },
    }),

    prisma.reservation.count({
      where: {
        createdAt: { gte: startOfToday },
        deletedAt: null,
      },
    }),

    prisma.reservation.count({
      where: {
        createdAt: { gte: startOfWeek },
        deletedAt: null,
      },
    }),

    prisma.reservation.count({
      where: {
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    }),

    prisma.reservation.count({
      where: { status: "CANCELLED" },
    }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: ["PENDING", "WAITING_VERIFY"] },
      },
    }),

    prisma.car.count({
      where: {
        status: "AVAILABLE",
        deletedAt: null,
      },
    }),

    prisma.reservation.count({
      where: {
        status: "CONFIRMED",
        startDate: { lte: now },
        endDate: { gte: now },
        deletedAt: null,
      },
    }),
  ]);

  /* ================= REVENUE 7 DAYS ================= */

  const payments7Days = await prisma.payment.findMany({
    where: {
      status: "PAID",
      paidAt: { not: null, gte: startOfWeek },
    },
    select: { amount: true, paidAt: true },
  });

  const revenueMap = {};

  payments7Days.forEach((p) => {
    const date = p.paidAt.toISOString().split("T")[0];
    revenueMap[date] = (revenueMap[date] || 0) + p.amount;
  });

  const revenueChart7Days = Object.keys(revenueMap)
    .sort()
    .map((date) => ({
      date,
      revenue: revenueMap[date],
    }));

  /* ================= MONTHLY REVENUE ================= */

  const monthlyPayments = await prisma.payment.findMany({
    where: {
      status: "PAID",
      paidAt: { not: null },
    },
    select: { amount: true, paidAt: true },
  });

  const monthlyMap = {};

  monthlyPayments.forEach((p) => {
    const month = p.paidAt.toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + p.amount;
  });

  const revenueMonthly = Object.keys(monthlyMap)
    .sort()
    .map((month) => ({
      month,
      revenue: monthlyMap[month],
    }));

  return {
    kpiSummary: [
      { title: "รายได้วันนี้", value: todayRevenue._sum.amount || 0 },
      { title: "รายได้เดือนนี้", value: monthRevenue._sum.amount || 0 },
      { title: "รถว่าง", value: availableCars },
      { title: "รถกำลังใช้งาน", value: usingCars },
      { title: "ผู้ใช้ทั้งหมด", value: totalUsers },
      { title: "รถทั้งหมด", value: totalCars },
      { title: "การจองทั้งหมด", value: totalBookings },
      { title: "รายรับรวม", value: totalRevenue._sum.amount || 0 },
    ],

    bookingStats: {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      canceled,
    },

    paymentStats: {
      paidAmount: paidAmount._sum.amount || 0,
      pendingAmount: pendingAmount._sum.amount || 0,
    },

    revenueChart7Days,
    revenueMonthly,
  };
};
