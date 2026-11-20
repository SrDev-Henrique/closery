import type { BrowserContext, CDPSession, Page } from "@playwright/test";

export type VirtualAuthenticator = {
  cdp: CDPSession;
  authenticatorId: string;
  credentials: () => Promise<unknown[]>;
  setUserVerified: (isUserVerified: boolean) => Promise<void>;
  remove: () => Promise<void>;
};

/** Só Chromium. Chamar ANTES de a página disparar navigator.credentials.*. */
export async function addVirtualAuthenticator(
  context: BrowserContext,
  page: Page,
): Promise<VirtualAuthenticator> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return {
    cdp,
    authenticatorId,
    credentials: async () =>
      (await cdp.send("WebAuthn.getCredentials", { authenticatorId }))
        .credentials,
    setUserVerified: async (isUserVerified) => {
      await cdp.send("WebAuthn.setUserVerified", {
        authenticatorId,
        isUserVerified,
      });
    },
    remove: async () => {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
      await cdp.send("WebAuthn.disable");
    },
  };
}
