import { describe, expectTypeOf, it } from "vitest";

import type { authClient } from "./client";

// Prova em tempo de tipo (rodado por `bun run check-types`) que o cliente
// enxerga os campos extras do usuário.
describe("tipos do authClient", () => {
  it("useSession traz role, sectorId e deactivatedAt tipados", () => {
    type SessionUser = NonNullable<
      ReturnType<typeof authClient.useSession>["data"]
    >["user"];
    expectTypeOf<SessionUser["role"]>().toEqualTypeOf<"admin" | "operator">();
    expectTypeOf<SessionUser["sectorId"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });
});
