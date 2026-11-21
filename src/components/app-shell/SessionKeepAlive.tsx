"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth/client";

// Única renovação da sessão. O servidor lê a sessão sem renovar
// (`getAuthz` passa `disableRefresh`), porque Server Component não grava
// cookie. Esta chamada HTTP a /api/auth/get-session, passado o `updateAge`,
// estende `expiresAt` no banco e regrava o cookie juntos. Sem ela o cookie
// morreria 7 dias após o login. Uma vez por montagem; erros ficam em silêncio
// (a página já está protegida no servidor, isto é só renovação).
export function SessionKeepAlive() {
  useEffect(() => {
    void Promise.resolve(authClient.getSession()).catch(() => {});
  }, []);
  return null;
}
