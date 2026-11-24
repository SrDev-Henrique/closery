import { describe, expect, it } from "vitest";

import { COMMENTS_MAX_LIMIT, COMMENTS_PAGE_SIZE } from "./limits";
import {
  parseCommentsLimit,
  REQUESTS_PATH,
  requestHref,
  requestsHref,
} from "./urls";

const ID = "11111111-1111-4111-8111-111111111111";

describe("requestHref", () => {
  it("o link do detalhe", () => {
    expect(REQUESTS_PATH).toBe("/solicitacoes");
    expect(requestHref(ID)).toBe(`/solicitacoes/${ID}`);
  });

  it("?comentarios= só quando passa da primeira página", () => {
    expect(requestHref(ID, { comments: undefined })).toBe(
      `/solicitacoes/${ID}`,
    );
    expect(requestHref(ID, { comments: COMMENTS_PAGE_SIZE })).toBe(
      `/solicitacoes/${ID}`,
    );
    expect(requestHref(ID, { comments: 0 })).toBe(`/solicitacoes/${ID}`);
    expect(requestHref(ID, { comments: 100 })).toBe(
      `/solicitacoes/${ID}?comentarios=100`,
    );
    expect(requestHref(ID, { comments: COMMENTS_MAX_LIMIT })).toBe(
      `/solicitacoes/${ID}?comentarios=500`,
    );
  });
});

describe("requestsHref", () => {
  it("sem setor, a lista; com setor, leva ?setor=", () => {
    expect(requestsHref()).toBe("/solicitacoes");
    expect(requestsHref(null)).toBe("/solicitacoes");
    expect(requestsHref("")).toBe("/solicitacoes");
    expect(requestsHref(ID)).toBe(`/solicitacoes?setor=${ID}`);
    expect(requestsHref("todos")).toBe("/solicitacoes?setor=todos");
  });
});

describe("parseCommentsLimit", () => {
  it.each([
    [undefined, 50],
    ["", 50],
    ["abc", 50],
    ["-50", 50],
    ["1.5", 50],
    ["0", 50],
    ["49", 50],
    ["50", 50],
    ["99", 50],
    ["100", 100],
    ["120", 100],
    ["500", 500],
    ["550", 500],
    ["600", 500],
    ["99999999999999999999", 500],
  ])("%j → %i", (raw, expected) => {
    expect(parseCommentsLimit(raw)).toBe(expected);
  });

  it("parâmetro repetido vale o primeiro", () => {
    expect(parseCommentsLimit(["150", "300"])).toBe(150);
    expect(parseCommentsLimit([])).toBe(50);
  });
});
