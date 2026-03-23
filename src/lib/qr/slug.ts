import { randomBytes } from "node:crypto";

export function createSlug() {
  return randomBytes(5).toString("base64url").replace(/[_-]/g, "").slice(0, 8).toLowerCase();
}

