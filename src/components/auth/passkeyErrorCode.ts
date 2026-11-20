// O cliente de passkey repassa o código do @simplewebauthn/browser quando a
// cerimônia falha no navegador: fechar o diálogo (NotAllowedError) vira
// ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY e AbortSignal vira ERROR_CEREMONY_ABORTED.
// Traduzimos aqui para os códigos do mapa de mensagens (T14).
export function passkeyErrorCode(
  code: string | null,
  ceremony: "register" | "authenticate",
): string | null {
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "PREVIOUSLY_REGISTERED";
  }
  if (
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" ||
    code === "ERROR_CEREMONY_ABORTED"
  ) {
    return ceremony === "register"
      ? "REGISTRATION_CANCELLED"
      : "AUTH_CANCELLED";
  }
  return code;
}
