import "server-only";

import { cookies } from "next/headers";

import { SECTOR_COOKIE, SECTOR_COOKIE_MAX_AGE_SECONDS } from "./limits";

/** Setor lembrado do admin. Chame dentro de <Suspense> (lê `cookies()`). */
export async function readRememberedSector(): Promise<string | undefined> {
  return (await cookies()).get(SECTOR_COOKIE)?.value;
}

/** Só dentro de Server Action ou Route Handler: `.set` não vale em render. */
export async function rememberSector(sectorId: string): Promise<void> {
  (await cookies()).set(SECTOR_COOKIE, sectorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SECTOR_COOKIE_MAX_AGE_SECONDS,
  });
}
