// @ts-ignore - Property '@prisma/client' does not exist until Prisma is generated
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL || "");

const prisma = new PrismaClient({ adapter });

export { prisma };
