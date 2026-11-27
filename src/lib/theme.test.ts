// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readTheme,
  setTheme,
  subscribeTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

const html = document.documentElement;

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)();
}

beforeEach(() => {
  localStorage.clear();
  html.className = "";
  html.removeAttribute("style");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("THEME_STORAGE_KEY", () => {
  it("é a chave de sempre, para não perder a escolha de quem já usa", () => {
    expect(THEME_STORAGE_KEY).toBe("closery-tema");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("sem nada guardado, o escuro é o padrão", () => {
    runInitScript();
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.style.colorScheme).toBe("dark");
  });

  it("com 'light' guardado, tira a classe dark e declara o esquema claro", () => {
    html.classList.add("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript();
    expect(html.classList.contains("dark")).toBe(false);
    expect(html.style.colorScheme).toBe("light");
  });

  it("com 'dark' guardado, fica escuro", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript();
    expect(html.classList.contains("dark")).toBe(true);
  });

  it("com lixo guardado, cai no escuro", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    runInitScript();
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.style.colorScheme).toBe("dark");
  });

  it("com o localStorage lançando, cai no escuro sem estourar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => runInitScript()).not.toThrow();
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.style.colorScheme).toBe("dark");
  });
});

describe("readTheme", () => {
  it("reflete a classe dark do <html>", () => {
    expect(readTheme()).toBe("light");
    html.classList.add("dark");
    expect(readTheme()).toBe("dark");
  });
});

describe("setTheme", () => {
  it("aplica a classe e o colorScheme e grava a chave", () => {
    setTheme("light");
    expect(html.classList.contains("dark")).toBe(false);
    expect(html.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    setTheme("dark");
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("avisa os inscritos, e quem cancelou não é mais avisado", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeTheme(cb);
    setTheme("light");
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    setTheme("dark");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("com o localStorage lançando, ainda aplica o tema na página", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cheio");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(html.classList.contains("dark")).toBe(false);
  });
});

describe("subscribeTheme", () => {
  it("o evento storage da chave avisa (sincroniza abas)", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeTheme(cb);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
      }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("o evento storage de outra chave é ignorado", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeTheme(cb);
    window.dispatchEvent(new StorageEvent("storage", { key: "outra" }));
    expect(cb).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("uma troca vinda de outra aba aplica o tema aqui", () => {
    const unsubscribe = subscribeTheme(() => {});
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
      }),
    );
    expect(html.classList.contains("dark")).toBe(false);
    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
    );
    expect(html.classList.contains("dark")).toBe(true);
    unsubscribe();
  });
});
