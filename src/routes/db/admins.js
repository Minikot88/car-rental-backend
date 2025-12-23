import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authAdmin } from "./middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// สร้าง admin
router.post("/", authAdmin, async(req,res)=>{
  const {username,password,two_factor_enabled=false} = req.body;
  const hash = await bcrypt.hash(password,10);
  const admin = await prisma.admins.create({data:{username,password_hash:hash,two_factor_enabled}});
  res.json(admin);
});

// Login admin
router.post("/login", async(req,res)=>{
  const {username,password} = req.body;
  const admin = await prisma.admins.findUnique({where:{username}});
  if(!admin) return res.status(400).json({error:"Invalid credentials"});
  const valid = await bcrypt.compare(password, admin.password_hash);
  if(!valid) return res.status(400).json({error:"Invalid credentials"});
  const token = jwt.sign({adminId:admin.admin_id},process.env.JWT_SECRET,{expiresIn:"1h"});
  res.json({token});
});

// List admins
router.get("/", authAdmin, async(req,res)=>{
  const admins = await prisma.admins.findMany();
  res.json(admins);
});

// Update admin
router.put("/:id", authAdmin, async(req,res)=>{
  const {username,password,two_factor_enabled} = req.body;
  const data = {username,two_factor_enabled};
  if(password) data.password_hash = await bcrypt.hash(password,10);
  const admin = await prisma.admins.update({where:{admin_id:req.params.id}, data});
  res.json(admin);
});

// Delete admin
router.delete("/:id", authAdmin, async(req,res)=>{
  await prisma.admins.delete({where:{admin_id:req.params.id}});
  res.json({message:"Deleted"});
});

export default router;
