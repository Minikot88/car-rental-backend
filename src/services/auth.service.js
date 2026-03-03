import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";

export const register = async (data) => {
  const { username, password, name, surname, phone, address } = data;

  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) throw new Error("Username already exists");

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name,
      surname,
      phone,
      address,
      role: "USER",
    },
  });

  return { message: "User registered successfully" };
};

export const login = async ({ username, password }) => {
  const user = await prisma.user.findFirst({
    where: { username, deletedAt: null },
  });

  if (!user) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
};

export const refresh = async (token) => {
  if (!token) throw new Error("No refresh token");

  const stored = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!stored) throw new Error("Invalid refresh token");

  const payload = jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET
  );

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
  });

  if (
    !user ||
    user.tokenVersion !== payload.tokenVersion
  ) {
    throw new Error("Invalid token");
  }

  await prisma.refreshToken.delete({
    where: { token },
  });

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (token) => {
  if (!token) return;

  await prisma.refreshToken.deleteMany({
    where: { token },
  });
};