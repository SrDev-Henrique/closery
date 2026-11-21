export const INVITE_COOKIE = "closery_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 3600;

// SameSite=Lax (nunca Strict): o cookie precisa voltar no redirect de retorno
// do Google/Facebook, que é uma navegação top-level GET.
export function inviteCookieOptions(isProduction: boolean): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  };
}
