"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { Auth } from "./createAuth";

// Mesma origem do app: sem baseURL, o cliente usa a origem da página.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), passkeyClient()],
});
