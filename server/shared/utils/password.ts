import bcrypt from "bcryptjs";
import { env } from "../../config/env";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** At least 8 characters with a letter and a number. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

let dummy: string | null = null;
/** A real bcrypt hash to compare against when an email is unknown, so timing doesn't reveal which emails exist. */
export function dummyHash(): string {
  if (!dummy) dummy = bcrypt.hashSync("not-a-real-password-0", env.bcryptRounds);
  return dummy;
}
