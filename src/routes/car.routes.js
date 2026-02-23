import express from "express";
import prisma from "../prismaClient.js";

const router = express.Router();

/* =====================================================
   GET ALL CARS (USER PAGE)
===================================================== */
router.get("/", async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.json(cars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cars" });
  }
});

/* =====================================================
   GET PUBLIC CARS (AVAILABLE ONLY)
===================================================== */
router.get("/public", async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      where: {
        deletedAt: null,
        status: "AVAILABLE",
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(cars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cars" });
  }
});

/* =====================================================
   SEARCH AVAILABLE CARS BY DATE (PRODUCTION SAFE)
===================================================== */
router.get("/available", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate)
      return res.status(400).json({
        message: "startDate and endDate required",
      });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start) || isNaN(end) || start >= end)
      return res.status(400).json({
        message: "Invalid date range",
      });

    const cars = await prisma.car.findMany({
      where: {
        deletedAt: null,
        status: { not: "MAINTENANCE" },

        // 🔥 ตรงนี้สำคัญมาก
        reservations: {
          none: {
            deletedAt: null,
            AND: [
              { startDate: { lt: end } },
              { endDate: { gt: start } },
              {
                OR: [
                  { status: "CONFIRMED" },
                  { status: "WAITING_PAYMENT" },
                  {
                    AND: [
                      { status: "PENDING" },
                      { lockExpiresAt: { gt: now } }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(cars);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to search available cars"
    });
  }
});

/* =====================================================
   GET CAR DETAIL (WITH RESERVATIONS + REVIEWS)
===================================================== */
router.get("/:id/detail", async (req, res) => {
  try {
    const carId = Number(req.params.id);

    const car = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        reservations: {
          where: {
            deletedAt: null,
            OR: [
              { status: "CONFIRMED" },
              { status: "WAITING_PAYMENT" },
              {
                AND: [
                  { status: "PENDING" },
                  { lockExpiresAt: { gt: new Date() } }
                ]
              }
            ]
          },
          select: {
            startDate: true,
            endDate: true
          }
        },
        reviews: true, 
      },
    });

    console.log("CAR ID:", carId);
console.log("RESERVATIONS FOUND:", car?.reservations);

    if (!car)
      return res.status(404).json({ message: "Car not found" });

    res.json(car);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch car detail",
    });
  }
});




/* =====================================================
   CHECK SINGLE CAR AVAILABILITY
===================================================== */
router.post("/:id/check", async (req, res) => {
  try {
    const carId = Number(req.params.id);
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate)
      return res.status(400).json({ message: "Missing dates" });

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid date format" });

    if (start >= end)
      return res.status(400).json({ message: "Invalid date range" });

    const car = await prisma.car.findFirst({
      where: {
        id: carId,
        deletedAt: null
      }
    });

    if (!car)
      return res.status(404).json({ message: "Car not found" });

    const overlapping = await prisma.reservation.findFirst({
      where: {
        carId,
        deletedAt: null,
        status: {
          in: ["PENDING", "CONFIRMED"]
        },
        AND: [
          { startDate: { lt: end } },
          { endDate: { gt: start } }
        ]
      }
    });

    if (overlapping) {
      return res.json({
        available: false,
        message: "Car already booked"
      });
    }

    return res.json({
      available: true,
      pricePerDay: car.pricePerDay
    });

  } catch (err) {
    console.error("CHECK ERROR:", err);
    return res.status(500).json({ message: "Check failed" });
  }
});


/* =====================================================
   CREATE CAR
===================================================== */
router.post("/", async (req, res) => {
  try {
    const d = req.body;

    const car = await prisma.car.create({
      data: {
        name: d.name,
        brand: d.brand,
        model: d.model,
        year: Number(d.year),
        color: d.color || null,
        transmission: d.transmission,
        seats: Number(d.seats),
        category: d.category,
        fuelType: d.fuelType,
        mileage: d.mileage ? Number(d.mileage) : null,
        pricePerDay: Number(d.pricePerDay),
        deposit: d.deposit ? Number(d.deposit) : null,
        image: d.image || null,
        images: d.images || [],
        description: d.description || null,
        features: d.features || [],
        location: d.location || null,
        status: d.status || "AVAILABLE",
      },
    });

    res.status(201).json(car);
  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: "Failed to create car",
    });
  }
});

/* =====================================================
   UPDATE CAR
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const d = req.body;

    const car = await prisma.car.update({
      where: { id },
      data: {
        name: d.name,
        brand: d.brand,
        model: d.model,
        year: Number(d.year),
        color: d.color || null,
        transmission: d.transmission,
        seats: Number(d.seats),
        category: d.category,
        fuelType: d.fuelType,
        mileage: d.mileage ? Number(d.mileage) : null,
        pricePerDay: Number(d.pricePerDay),
        deposit: d.deposit ? Number(d.deposit) : null,
        image: d.image || null,
        images: d.images || [],
        description: d.description || null,
        features: d.features || [],
        location: d.location || null,
        status: d.status,
      },
    });

    res.json(car);
  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: "Failed to update car",
    });
  }
});

/* =====================================================
   SOFT DELETE CAR
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    await prisma.car.update({
      where: { id: Number(req.params.id) },
      data: { deletedAt: new Date() },
    });

    res.json({ message: "Car deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: "Failed to delete car",
    });
  }
});

/* =====================================================
   GET SINGLE CAR (MUST BE LAST)
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const car = await prisma.car.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
      },
    });

    if (!car)
      return res.status(404).json({ message: "Car not found" });

    res.json(car);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch car",
    });
  }
});

export default router;
