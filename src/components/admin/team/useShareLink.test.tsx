import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShareLink } from "./useShareLink";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OF_LINK = "https://closery.example.test/convite/token-de-teste";
const INPUT = {
  url: URL_OF_LINK,
  shareTitle: "Título de teste",
  shareText: "Texto de teste.",
};

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("useShareLink: copiar", () => {
  it("copia o link e avisa", async () => {
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("copiar recusado pelo navegador avisa como copiar à mão", async () => {
    mocks.writeText.mockRejectedValue(
      new DOMException("negado", "NotAllowedError"),
    );
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível copiar. Selecione o link e copie.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("sem navigator.clipboard (contexto inseguro) avisa sem lançar", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível copiar. Selecione o link e copie.",
    );
  });

  it("copia o link novo quando a url muda", async () => {
    const { result, rerender } = renderHook(
      (props: typeof INPUT) => useShareLink(props),
      { initialProps: INPUT },
    );

    rerender({ ...INPUT, url: "https://closery.example.test/outro" });
    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(
      "https://closery.example.test/outro",
    );
  });
});

describe("useShareLink: canShare", () => {
  it("é falso sem navigator.share", () => {
    const { result } = renderHook(() => useShareLink(INPUT));
    expect(result.current.canShare).toBe(false);
  });

  it("é verdadeiro com navigator.share, só depois de montar", async () => {
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await waitFor(() => expect(result.current.canShare).toBe(true));
  });

  it("no servidor (renderToString) é falso mesmo com navigator.share", () => {
    defineNavigator("share", mocks.share);
    function Probe() {
      const { canShare } = useShareLink(INPUT);
      return <span>{canShare ? "pode" : "nao-pode"}</span>;
    }

    expect(renderToString(<Probe />)).toContain("nao-pode");
  });
});

describe("useShareLink: compartilhar", () => {
  it("envia título, texto e link", async () => {
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.share).toHaveBeenCalledWith({
      title: "Título de teste",
      text: "Texto de teste.",
      url: URL_OF_LINK,
    });
    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("fechar a folha de compartilhamento (AbortError) é silencioso", async () => {
    mocks.share.mockRejectedValue(new DOMException("fechou", "AbortError"));
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha real ao compartilhar cai para copiar o link", async () => {
    mocks.share.mockRejectedValue(
      new DOMException("sem app", "NotAllowedError"),
    );
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("falha que não é DOMException também cai para copiar", async () => {
    mocks.share.mockRejectedValue(new TypeError("estranho"));
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
  });
});
