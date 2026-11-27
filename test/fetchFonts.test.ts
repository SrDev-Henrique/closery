import { describe, expect, it, vi } from "vitest";

import { ensureSatoshi } from "../scripts/fetchFonts.mjs";
import { FONTSHARE_CSS_URL, sha256Hex } from "../scripts/fontsCheck.mjs";
import {
  FONT_WEIGHTS,
  fakeFontBytes,
  fixtureUrl,
  fontshareCss,
} from "./fontsFixtures";

// Orquestração do download (scripts/fetchFonts.mjs) com fetch e disco falsos: nada de rede, nada de
// escrita no repositório.

const EXPECTED = {
  500: sha256Hex(fakeFontBytes(500)),
  700: sha256Hex(fakeFontBytes(700)),
  900: sha256Hex(fakeFontBytes(900)),
};

function memoryIo(initial: Record<number, Uint8Array> = {}) {
  const files = new Map<number, Uint8Array>(
    Object.entries(initial).map(([weight, bytes]) => [Number(weight), bytes]),
  );
  const writes: number[] = [];
  return {
    files,
    writes,
    io: {
      read: async (weight: number) => files.get(weight) ?? null,
      write: async (weight: number, bytes: Uint8Array) => {
        writes.push(weight);
        files.set(weight, bytes);
      },
    },
  };
}

/** Um fetch falso: o CSS na URL da Fontshare e os bytes de mentira nas URLs da CDN. */
function fakeFetch(
  options: { css?: string; cssStatus?: number; hostile?: number } = {},
) {
  return vi.fn(async (url: string | URL) => {
    const text = String(url);
    if (text === FONTSHARE_CSS_URL) {
      return new Response(options.css ?? fontshareCss(), {
        status: options.cssStatus ?? 200,
      });
    }
    for (const weight of FONT_WEIGHTS) {
      if (text === `https:${fixtureUrl(weight)}`) {
        const bytes =
          options.hostile === weight
            ? Uint8Array.from([9, 9, 9])
            : fakeFontBytes(weight);
        return new Response(bytes as unknown as BodyInit);
      }
    }
    return new Response("não achei", { status: 404 });
  });
}

const run = (
  fetchImpl: ReturnType<typeof fakeFetch>,
  io: ReturnType<typeof memoryIo>["io"],
) =>
  ensureSatoshi({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    io,
    expected: EXPECTED,
    log: () => {},
  });

describe("ensureSatoshi", () => {
  it("sem nenhum arquivo: baixa os três, confere e grava", async () => {
    const disk = memoryIo();
    const fetchImpl = fakeFetch();

    const downloaded = await run(fetchImpl, disk.io);

    expect(downloaded).toEqual([500, 700, 900]);
    expect(disk.writes).toEqual([500, 700, 900]);
    expect(disk.files.get(700)).toEqual(fakeFontBytes(700));
    // 1 CSS + 3 woff2
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("com os três já certos: pula e não faz nenhuma requisição", async () => {
    const disk = memoryIo({
      500: fakeFontBytes(500),
      700: fakeFontBytes(700),
      900: fakeFontBytes(900),
    });
    const fetchImpl = fakeFetch();

    expect(await run(fetchImpl, disk.io)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(disk.writes).toEqual([]);
  });

  it("arquivo corrompido ou de outro peso é baixado de novo; os certos ficam", async () => {
    const disk = memoryIo({
      500: Uint8Array.from([0, 0, 0]),
      700: fakeFontBytes(700),
      900: fakeFontBytes(900),
    });
    const fetchImpl = fakeFetch();

    expect(await run(fetchImpl, disk.io)).toEqual([500]);
    expect(disk.writes).toEqual([500]);
    expect(disk.files.get(500)).toEqual(fakeFontBytes(500));
    // 1 CSS + 1 woff2
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("hash diferente: lança com o hash recebido e NÃO grava nada, nem os pesos que bateram", async () => {
    const disk = memoryIo();
    await expect(run(fakeFetch({ hostile: 900 }), disk.io)).rejects.toThrow(
      /peso 900 veio com SHA-256 [0-9a-f]{64}/,
    );
    expect(disk.writes).toEqual([]);
    expect(disk.files.size).toBe(0);
  });

  it("a Fontshare responde erro no CSS: lança com o status", async () => {
    const disk = memoryIo();
    await expect(run(fakeFetch({ cssStatus: 503 }), disk.io)).rejects.toThrow(
      "respondeu 503",
    );
    expect(disk.writes).toEqual([]);
  });

  it("sem rede (fetch lança): lança dizendo que não houve resposta", async () => {
    const disk = memoryIo();
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      ensureSatoshi({
        fetchImpl: offline as unknown as typeof fetch,
        io: disk.io,
        expected: EXPECTED,
        log: () => {},
      }),
    ).rejects.toThrow("sem resposta de");
    expect(disk.writes).toEqual([]);
  });

  it("o CSS não traz um dos pesos: lança e não grava", async () => {
    const disk = memoryIo();
    await expect(
      run(fakeFetch({ css: fontshareCss([500, 700]) }), disk.io),
    ).rejects.toThrow("não devolveu o peso 900");
    expect(disk.writes).toEqual([]);
  });

  it("um woff2 responde 404: lança e não grava", async () => {
    const disk = memoryIo();
    const css = fontshareCss().replace(
      fixtureUrl(700),
      "//cdn.fontshare.com/wf/Z/Z/Z.woff2",
    );
    await expect(run(fakeFetch({ css }), disk.io)).rejects.toThrow(
      "respondeu 404",
    );
    expect(disk.writes).toEqual([]);
  });
});
