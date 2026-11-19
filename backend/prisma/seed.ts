import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // The admin login page signs in as this email; only the password is typed.
  const email = process.env.ADMIN_EMAIL ?? "admin@gdg-kauhoot.local";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) console.warn("ADMIN_PASSWORD is not set; using the development password 'change-me'.");
  const passwordHash = await bcrypt.hash(password ?? "change-me", 12);
  await prisma.admin.upsert({
    where: { email },
    // setting ADMIN_PASSWORD and re-running the seed rotates the password
    update: password ? { passwordHash } : {},
    create: { email, passwordHash },
  });
  console.log(`admin ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
