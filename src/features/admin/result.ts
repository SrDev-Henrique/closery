export type AdminErrorCode =
  | "INVALID_INPUT"
  | "NAME_TAKEN"
  | "NOT_FOUND"
  | "SECTOR_REQUIRED"
  | "SECTOR_INACTIVE"
  | "SECTOR_IN_USE"
  | "SELF_CHANGE"
  | "LAST_ADMIN"
  | "INVITE_NOT_PENDING"
  | "SHIFT_INACTIVE"
  | "DATE_OUT_OF_RANGE"
  | "FORBIDDEN"
  | "HANDOVER_LOCKED"
  | "ALREADY_DELIVERED"
  | "NOT_DELIVERED"
  | "ALREADY_CONFIRMED"
  | "OWN_HANDOVER"
  | "NOT_CONFIRMED"
  | "NO_CHANGES"
  | "STATUS_CONFLICT"
  | "DESTINATION_INACTIVE"
  | "INTERNAL";

/** Chave = nome do campo do formulário; valor = mensagem pt-BR do campo. */
export type FieldErrors = Partial<Record<string, string>>;

export type AdminFailure = {
  ok: false;
  code: AdminErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

export type AdminResult<T extends object = object> =
  | ({ ok: true } & T)
  | AdminFailure;

export const INTERNAL_ERROR_MESSAGE =
  "Não foi possível concluir. Tente de novo.";
export const INVALID_INPUT_MESSAGE = "Confira os campos e tente de novo.";

export function ok(): { ok: true };
export function ok<T extends object>(data: T): { ok: true } & T;
export function ok(data?: object): { ok: true } {
  return { ...data, ok: true };
}

export function fail(
  code: AdminErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): AdminFailure {
  return fieldErrors === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, fieldErrors };
}
