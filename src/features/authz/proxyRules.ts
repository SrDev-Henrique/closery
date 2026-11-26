export const PUBLIC_PATH_PREFIXES: readonly string[] = [
  "/entrar",
  "/convite",
  "/redefinir-senha",
  "/privacidade",
];

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// Casa o prefixo por segmento inteiro: "/entrar" e "/entrar/x" são públicos,
// "/entrarx" não é.
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Decisão otimista do proxy: só olha se existe cookie de sessão, não se ele é
// válido. `/api/*` nunca redireciona (cada rota de API se autentica sozinha e
// o Better Auth precisa responder a quem ainda não tem sessão).
export function shouldRedirectToSignIn(
  pathname: string,
  hasSessionCookie: boolean,
): boolean {
  if (hasSessionCookie) return false;
  if (isApiPath(pathname)) return false;
  return !isPublicPath(pathname);
}
