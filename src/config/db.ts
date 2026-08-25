// @ts-ignore - Property '@prisma/client' does not exist until Prisma is generated
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
});

export { prisma };
