/* The admin password lives in backend/.env (ADMIN_PASSWORD). On every start the server makes the
   stored hash match it: change the value, restart, and the new password works (the old one stops). */
import bcrypt from "bcryptjs";
import type { Repository } from "./domain.js";

export const MIN_ADMIN_PASSWORD = 8;

export async function syncAdminPassword(
  repository: Pick<Repository, "findAdminByEmail" | "createAdmin" | "setAdminPassword">,
  email: string,
  password: string,
  rounds = 12,
): Promise<"created" | "updated" | "unchanged"> {
  if (password.trim().length < MIN_ADMIN_PASSWORD) throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters`);
  const admin = await repository.findAdminByEmail(email);
  if (!admin) {
    await repository.createAdmin(email, await bcrypt.hash(password, rounds));
    return "created";
  }
  if (await bcrypt.compare(password, admin.passwordHash)) return "unchanged";
  await repository.setAdminPassword(admin.id, await bcrypt.hash(password, rounds));
  return "updated";
}
