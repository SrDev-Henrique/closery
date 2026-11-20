import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { shouldRedirectToSignIn } from "@/features/authz/proxyRules";

// Barreira OTIMISTA: só olha se existe um cookie de sessão, sem consultar o
// banco nem validar a assinatura. Serve para mandar quem claramente não entrou
// para /entrar sem renderizar nada. A autorização de verdade (sessão válida,
// papel, setor) acontece em cada página e Server Action, via session.ts.
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (shouldRedirectToSignIn(request.nextUrl.pathname, hasSessionCookie)) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

// Fica de fora: /api (cada rota se autentica), arquivos do Next, favicon e
// qualquer arquivo com extensão (public/). `api(?:/|$)` não pega "/apiary".
export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)",
  ],
};
