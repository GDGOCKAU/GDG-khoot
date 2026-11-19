import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16).default("development-secret-change-me"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  UPLOAD_DIR: z.string().default("uploads"),
});

export const config = envSchema.parse(process.env);
