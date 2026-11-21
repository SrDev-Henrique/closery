import { describe, expect, it } from "vitest";

import { passkeyErrorCode } from "./passkeyErrorCode";

describe("passkeyErrorCode", () => {
  it.each([
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "authenticate", "AUTH_CANCELLED"],
    [
      "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      "register",
      "REGISTRATION_CANCELLED",
    ],
    ["ERROR_CEREMONY_ABORTED", "authenticate", "AUTH_CANCELLED"],
    ["ERROR_CEREMONY_ABORTED", "register", "REGISTRATION_CANCELLED"],
    [
      "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      "register",
      "PREVIOUSLY_REGISTERED",
    ],
    [
      "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      "authenticate",
      "PREVIOUSLY_REGISTERED",
    ],
  ] as const)("%s em %s vira %s", (code, ceremony, expected) => {
    expect(passkeyErrorCode(code, ceremony)).toBe(expected);
  });

  it("códigos do Better Auth passam sem mudança", () => {
    expect(passkeyErrorCode("SESSION_NOT_FRESH", "register")).toBe(
      "SESSION_NOT_FRESH",
    );
    expect(passkeyErrorCode("AUTH_CANCELLED", "authenticate")).toBe(
      "AUTH_CANCELLED",
    );
  });

  it("null continua null (o fallback é de authFormError)", () => {
    expect(passkeyErrorCode(null, "authenticate")).toBeNull();
    expect(passkeyErrorCode(null, "register")).toBeNull();
  });
});
