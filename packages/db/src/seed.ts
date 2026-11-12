import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed-data";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed fictional data with NODE_ENV=production.");
  }
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma);
    console.log("Seed complete (fictional data).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
