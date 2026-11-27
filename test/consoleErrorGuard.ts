import { vi } from "vitest";

// Todo `console.error` é repassado ao original e guardado em `unexpected`, para o teste afirmar que não
// houve nenhum (hidratação divergente, warning do React etc.).
export function guardConsoleError() {
  const original = console.error;
  const unexpected: unknown[][] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    unexpected.push(args);
    original(...args);
  });
  return { unexpected, restore: () => spy.mockRestore() };
}
