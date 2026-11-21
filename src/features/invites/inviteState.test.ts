import { describe, expect, it } from "vitest";

import { INVITE_TTL_MS, inviteState } from "./inviteState";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 1);
const PAST = new Date(NOW.getTime() - 1);

describe("INVITE_TTL_MS", () => {
  it("é de 7 dias", () => {
    expect(INVITE_TTL_MS).toBe(604_800_000);
  });
});

describe("inviteState", () => {
  it("valid: no futuro, sem uso e sem cancelamento", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("valid");
  });

  it("expired: no passado", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("expired");
  });

  it("expired: expiresAt exatamente igual a now", () => {
    expect(
      inviteState({ expiresAt: NOW, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("expired");
  });

  it("used: usedAt preenchido", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: PAST, cancelledAt: null }, NOW),
    ).toBe("used");
  });

  it("cancelled: cancelledAt preenchido", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: null, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
  });

  it("used vence expired", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: PAST, cancelledAt: null }, NOW),
    ).toBe("used");
  });

  it("cancelled vence used e expired", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: PAST, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: PAST, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
  });
});
