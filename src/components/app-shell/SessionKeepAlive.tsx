"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth/client";

// O servidor lê a sessão em Server Components, que não gravam cookie: o
// Better Auth estende `expiresAt` no banco, mas o cookie do navegador
// continuaria com o Max-Age do login. Uma chamada HTTP a /api/auth/get-session
// devolve o cookie renovado. Uma vez por montagem; erros ficam em silêncio
// (a página já está protegida no servidor, isto é só renovação).
export function SessionKeepAlive() {
  useEffect(() => {
    void Promise.resolve(authClient.getSession()).catch(() => {});
  }, []);
  return null;
}
