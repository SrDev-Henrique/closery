import { describe, expect, it } from "vitest";

import * as limits from "./limits";

describe("limites da passagem", () => {
  it("valores combinados (o teto vale só no domínio; mudar não exige migração)", () => {
    expect({ ...limits }).toEqual({
      MAX_QUANTITY: 99_999,
      TEXT_MAX_LENGTH: 2000,
      ITEM_NOTE_MAX_LENGTH: 200,
      CONFIRMATION_NOTE_MAX_LENGTH: 500,
      REASON_MAX_LENGTH: 500,
      MAX_DAYS_BACK: 31,
      HISTORY_MAX_DAYS: 93,
      HISTORY_DEFAULT_DAYS: 7,
      AUTOSAVE_DEBOUNCE_MS: 800,
      SECTOR_COOKIE: "closery_setor",
      SECTOR_COOKIE_MAX_AGE_SECONDS: 31_536_000,
      ALL_SECTORS: "todos",
      NEXT_SHIFT_PREVIEW_LENGTH: 200,
      CHOOSE_SECTOR_QUERY_MAX: 2000,
    });
  });

  it("o cookie dura um ano", () => {
    expect(limits.SECTOR_COOKIE_MAX_AGE_SECONDS).toBe(365 * 24 * 60 * 60);
  });
});
