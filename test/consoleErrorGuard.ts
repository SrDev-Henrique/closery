import { vi } from "vitest";

// O React 19 avisa quando o `<script>` anti-flash do next-themes é renderizado no cliente; no app real ele
// vem do HTML do servidor. Só esse aviso é engolido; qualquer outro `console.error` é repassado ao original
// e guardado em `unexpected`, para o teste afirmar que não houve mais nada.
const KNOWN = /Encountered a script tag while rendering React component/;

export function guardConsoleError() {
  const original = console.error;
  const unexpected: unknown[][] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    if (typeof args[0] === "string" && KNOWN.test(args[0])) return;
    unexpected.push(args);
    original(...args);
  });
  return { unexpected, restore: () => spy.mockRestore() };
}
