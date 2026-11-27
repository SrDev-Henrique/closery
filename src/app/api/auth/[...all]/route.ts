import { toNextJsHandler } from "better-auth/next-js";
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { logServerError } from "@/lib/logServerError";

const handlers = toNextJsHandler(auth);

// `onAPIError.throw` (createAuth.ts) faz o erro inesperado chegar aqui em vez
// de o roteador do better-call imprimi-lo cru. O APIError dos endpoints já
// virou Response lá dentro e não passa por este catch.
function guarded(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      unstable_rethrow(error);
      logServerError(error, "better-auth");
      return new Response(null, { status: 500 });
    }
  };
}

export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);
