import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "Unauthorized" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (
      !user ||
      user.deletedAt ||
      user.tokenVersion !== decoded.tokenVersion
    ) {
      return res.status(401).json({ message: "Token invalid" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      tenantId: decoded.tenantId,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};