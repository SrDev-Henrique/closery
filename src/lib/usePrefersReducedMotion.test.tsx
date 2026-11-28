import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Listener = EventListenerOrEventListenerObject;

function mockMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const state = { matches: initial };
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    get matches() {
      return state.matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  return {
    listeners,
    change(matches: boolean) {
      state.matches = matches;
      const event = new Event("change");
      for (const listener of listeners) {
        if (typeof listener === "function") {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePrefersReducedMotion", () => {
  it("false quando a pessoa não pediu menos movimento", () => {
    mockMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("true quando pediu", () => {
    mockMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("acompanha a mudança sem recarregar e solta o ouvinte ao desmontar", () => {
    const media = mockMedia(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(media.listeners.size).toBe(1);
    act(() => media.change(true));
    expect(result.current).toBe(true);
    act(() => media.change(false));
    expect(result.current).toBe(false);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
