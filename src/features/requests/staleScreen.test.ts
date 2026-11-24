import { describe, expect, it } from "vitest";

import type { AdminErrorCode } from "@/features/admin/result";
import { isStaleScreenCode } from "./staleScreen";

describe("isStaleScreenCode", () => {
  it.each([
    "STATUS_CONFLICT",
    "NO_CHANGES",
    "NOT_FOUND",
  ] as const)("%s deixa a tela velha: atualizar", (code) => {
    expect(isStaleScreenCode(code)).toBe(true);
  });

  it.each([
    "INVALID_INPUT",
    "SECTOR_INACTIVE",
    "DESTINATION_INACTIVE",
    "FORBIDDEN",
    "HANDOVER_LOCKED",
    "INTERNAL",
  ] as const satisfies readonly AdminErrorCode[])("%s não atualiza a tela", (code) => {
    expect(isStaleScreenCode(code)).toBe(false);
  });
});
