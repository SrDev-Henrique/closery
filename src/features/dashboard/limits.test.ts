import { describe, expect, it } from "vitest";

import { HISTORY_MAX_DAYS } from "@/features/handovers/limits";

import * as limits from "./limits";

describe("limites do dashboard", () => {
  it("valores combinados (o teto vale só no domínio; mudar não exige migração)", () => {
    expect({ ...limits }).toEqual({
      DASHBOARD_PATH: "/dashboard",
      DASHBOARD_EXPORT_PATH: "/api/dashboard/export",
      SEGMENT_SLOTS: 4,
      DASHBOARD_ITEM_LIMIT: 30,
      DESTINATION_BAR_LIMIT: 8,
      REQUESTED_ITEM_LIMIT: 12,
      CSV_MAX_ROWS: 10_000,
      CSV_FILENAME_SLUG_MAX: 48,
      MIN_BAR_PERCENT: 2,
    });
  });

  it("o período do dashboard usa o mesmo teto do histórico (93 dias)", () => {
    expect(HISTORY_MAX_DAYS).toBe(93);
  });
});
