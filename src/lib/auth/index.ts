import "server-only";

import { db } from "@/db";

import { createAuth } from "./createAuth";
import { parseAuthEnv } from "./env";

export const authEnv = parseAuthEnv(process.env);
export const auth = createAuth(db, authEnv);
