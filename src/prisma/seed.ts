import bcrypt from "bcryptjs";
import { prisma } from "../config/db";

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing users (optional for clean seeds)
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Standard Credentials User
  const standardUser = await prisma.user.create({
    data: {
      email: "john.doe@example.com",
      username: "johndoe",
      password: hashedPassword,
      firstName: "John",
      lastName: "Doe",
      gender: "male",
      image: "https://dummyjson.com/icon/johndoe/128",
    },
  });

  // 2. Google OAuth User (password is null)
  const googleUser = await prisma.user.create({
    data: {
      email: "jane.smith@gmail.com",
      username: "janesmith",
      password: null,
      firstName: "Jane",
      lastName: "Smith",
      gender: "female",
      image: "https://lh3.googleusercontent.com/a/default-user",
      googleId: "109876543210987654321",
    },
  });

  console.log("✅ Database seeded successfully!");
  console.log({ standardUser, googleUser });
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
