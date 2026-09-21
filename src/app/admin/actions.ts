"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { ADMIN_COOKIE, ADMIN_TTL_S, adminToken, checkAdminPassword } from "@/lib/admin";
import type { FormResult } from "@/lib/forms";

export async function unlockAdmin(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length > 200 || !checkAdminPassword(password)) return { ok: false, error: "Wrong password." };
  (await cookies()).set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_TTL_S,
  });
  refresh();
  return { ok: true };
}

export async function lockAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
  refresh();
}
