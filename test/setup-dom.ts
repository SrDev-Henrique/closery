import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem `globals: true` o Testing Library não registra o cleanup sozinho.
afterEach(() => {
  cleanup();
});

// jsdom não implementa window.matchMedia; o useIsMobile do shadcn (SidebarProvider)
// chama no efeito. Desktop por padrão (matches: false).
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
