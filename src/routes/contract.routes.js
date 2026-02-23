import express from "express";
import prisma from "../prismaClient.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// fix dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/:reservationId", async (req, res) => {
  try {
    const id = Number(req.params.reservationId);

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: true,
        car: true,
      },
    });

    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });

    const uploadsDir = path.join(__dirname, "../uploads/contracts");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(
      uploadsDir,
      `contract-${id}.pdf`
    );

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    /* ================= HEADER ================= */
    doc.fontSize(20).text("CAR RENTAL AGREEMENT", {
      align: "center",
    });

    doc.moveDown();

    /* ================= CUSTOMER INFO ================= */
    doc.fontSize(14).text("Customer Information");
    doc.fontSize(12).text(
      `Name: ${reservation.user.name} ${reservation.user.surname}`
    );
    doc.text(`Phone: ${reservation.user.phone}`);
    doc.moveDown();

    /* ================= CAR INFO ================= */
    doc.fontSize(14).text("Car Information");
    doc.fontSize(12).text(`Car: ${reservation.car.name}`);
    doc.text(`Plate: ${reservation.car.plateNumber || "-"}`);
    doc.moveDown();

    /* ================= RENTAL INFO ================= */
    doc.fontSize(14).text("Rental Period");
    doc.fontSize(12).text(
      `Start Date: ${reservation.startDate.toDateString()}`
    );
    doc.text(
      `End Date: ${reservation.endDate.toDateString()}`
    );
    doc.text(`Total Price: ฿${reservation.totalPrice}`);
    doc.moveDown();

    /* ================= TERMS ================= */
    doc.fontSize(14).text("Terms & Conditions");
    doc.fontSize(11).text(
      "1. The renter agrees to return the vehicle in good condition."
    );
    doc.text(
      "2. Late return will be charged extra per day."
    );
    doc.text(
      "3. Any damage will be evaluated upon return."
    );
    doc.moveDown(2);

    /* ================= SIGNATURE ================= */
    doc.text("Customer Signature: _____________________");
    doc.moveDown();
    doc.text("Company Signature: _____________________");

    doc.end();

    stream.on("finish", () => {
      res.download(filePath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate contract" });
  }
});

export default router;
