import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";

export const registerUser = async (data) => {
  const { username, password, name, surname, phone, address } = data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { phone }] },
  });

  if (existing) throw new Error("User exists");

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      password: hashed,
      name,
      surname,
      phone,
      address,
    },
  });

  return { message: "Registered" };
};

export const loginUser = async (data) => {
  const { username, password } = data;

  const user = await prisma.user.findFirst({
    where: {
      username: username.toLowerCase(),
      deletedAt: null,
      status: "active",
    },
  });

  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken(user);
  const { token: refreshToken, jti } =
    generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: jti,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

export const refreshAccessToken = async (refreshToken) => {
  const decoded = jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET
  );

  const stored = await prisma.refreshToken.findUnique({
    where: { token: decoded.jti },
  });

  if (!stored) throw new Error("Invalid refresh token");

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({
      where: { id: stored.id },
    });
    throw new Error("Expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
  });

  if (!user) throw new Error("User not found");

  if (decoded.tokenVersion !== user.tokenVersion)
    throw new Error("Token invalidated");

  // rotate
  await prisma.refreshToken.delete({
    where: { id: stored.id },
  });

  const accessToken = generateAccessToken(user);
  const { token: newRefreshToken, jti } =
    generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: jti,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, newRefreshToken };
};

export const logoutUser = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: { increment: 1 },
    },
  });

  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};