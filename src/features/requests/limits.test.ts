import { describe, expect, it } from "vitest";

import { MAX_QUANTITY } from "@/features/handovers/limits";

import * as limits from "./limits";

describe("limites das solicitações", () => {
  it("são os valores do contrato", () => {
    expect({ ...limits }).toEqual({
      STALE_AFTER_DAYS: 3,
      DAY_MS: 86_400_000,
      STALE_AFTER_MS: 259_200_000,
      BOARD_PAGE_SIZE: 20,
      BOARD_MAX_LIMIT: 200,
      CLOSED_WINDOW_DAYS: 30,
      DESCRIPTION_MAX_LENGTH: 500,
      DESTINATION_OTHER_MAX_LENGTH: 80,
      COMMENT_MAX_LENGTH: 2000,
      CANCEL_REASON_MAX_LENGTH: 500,
      REQUEST_ITEMS_MAX: 50,
      REQUEST_ITEM_MIN_QUANTITY: 1,
      SEARCH_MAX_LENGTH: 80,
      HOME_STALE_LIMIT: 5,
      HANDOVER_OPEN_LIMIT: 20,
      COMMENTS_PAGE_SIZE: 50,
      COMMENTS_MAX_LIMIT: 500,
      TIMELINE_LIMIT: 200,
      PREVIEW_LENGTH: 60,
      DESTINATION_OTHER: "outro",
    });
  });

  it("'parada' são 72 h exatas, sem fuso", () => {
    expect(limits.STALE_AFTER_MS).toBe(72 * 60 * 60 * 1000);
  });

  it("os tetos são múltiplos do passo e o mínimo cabe no teto de quantidade", () => {
    expect(limits.BOARD_MAX_LIMIT % limits.BOARD_PAGE_SIZE).toBe(0);
    expect(limits.COMMENTS_MAX_LIMIT % limits.COMMENTS_PAGE_SIZE).toBe(0);
    expect(limits.REQUEST_ITEM_MIN_QUANTITY).toBeGreaterThan(0);
    expect(limits.REQUEST_ITEM_MIN_QUANTITY).toBeLessThanOrEqual(MAX_QUANTITY);
  });

  it("o valor de 'Outro' não colide com um uuid nem com 'todos'", () => {
    expect(limits.DESTINATION_OTHER).toMatch(/^[a-z]+$/);
    expect(limits.DESTINATION_OTHER).not.toBe("todos");
  });
});
