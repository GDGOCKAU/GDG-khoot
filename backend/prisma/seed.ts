import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("change-me", 12);
  await prisma.admin.upsert({
    where: { email: "admin@gdg-kauhoot.local" },
    update: {},
    create: { email: "admin@gdg-kauhoot.local", passwordHash },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
