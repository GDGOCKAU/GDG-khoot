import "dotenv/config";
import { z } from "zod";
import { MIN_ADMIN_PASSWORD } from "./admin.js";

/* the placeholder in .env.example: copying the example file as-is must not give a working password */
const EXAMPLE_PASSWORD = "example-only-change-me";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16).default("development-secret-change-me"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  UPLOAD_DIR: z.string().default("uploads"),
  // the admin signs in with this password (the email is fixed); the server syncs it into the database on start
  ADMIN_EMAIL: z.string().email().default("admin@gdg-kauhoot.local"),
  ADMIN_PASSWORD: z.string().refine((value) => value.trim().length >= MIN_ADMIN_PASSWORD, "too short")
    .refine((value) => value !== EXAMPLE_PASSWORD, "still the example value"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => {
    const name = issue.path.join(".");
    if (name === "ADMIN_PASSWORD") {
      const value = process.env.ADMIN_PASSWORD;
      const why = !value ? "missing or empty" : value === EXAMPLE_PASSWORD ? "still the example value from .env.example" : `too short (${value.trim().length} characters)`;
      return `ADMIN_PASSWORD in backend/.env is ${why}. ` +
        `Set it to at least ${MIN_ADMIN_PASSWORD} characters, e.g. ADMIN_PASSWORD="your-strong-password", then start again.`;
    }
    return `${name}: ${issue.message}`;
  });
  console.error(`\nKAUHOOT server will not start:\n  - ${lines.join("\n  - ")}\n`);
  process.exit(1);
}
export const config = parsed.data;
