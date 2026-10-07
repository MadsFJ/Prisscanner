import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { authSchema, authUserAdditionalFields } from "../src/auth";
import { accounts, sessions, users } from "../src/schema";
import { connectTestDb } from "./helpers";

// Proves the auth tables work with Better Auth's Drizzle adapter before the web app wires it up.

const db = connectTestDb();

const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: "test-only-secret-that-is-at-least-32-characters",
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  user: { additionalFields: authUserAdditionalFields },
  telemetry: { enabled: false },
});

afterAll(async () => {
  await db.$client.end();
});

const password = "korrekt-hest-batteri-hæfteklamme";

describe("Better Auth with the Drizzle schema", () => {
  it("signs up a user with a postal code and stores only a password hash", async () => {
    const result = await auth.api.signUpEmail({
      body: { name: "Mads", email: "Signup@Example.dk", password, postalCode: "8000" },
    });

    const [user] = await db.select().from(users).where(eq(users.id, result.user.id));
    expect(user).toMatchObject({ email: "signup@example.dk", postalCode: "8000" });

    const [account] = await db.select().from(accounts).where(eq(accounts.userId, result.user.id));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(password);
  });

  it("signs in with the right password and creates a session", async () => {
    await auth.api.signUpEmail({
      body: { name: "Mads", email: "signin@example.dk", password, postalCode: "2100" },
    });

    const result = await auth.api.signInEmail({
      body: { email: "SignIn@Example.dk", password },
    });

    expect(result.token).toBeTruthy();
    const [session] = await db.select().from(sessions).where(eq(sessions.token, result.token));
    expect(session?.userId).toBe(result.user.id);
  });

  it("rejects a wrong password", async () => {
    await auth.api.signUpEmail({
      body: { name: "Mads", email: "wrong@example.dk", password, postalCode: "5000" },
    });

    await expect(
      auth.api.signInEmail({ body: { email: "wrong@example.dk", password: "not-the-password" } }),
    ).rejects.toThrow();
  });

  it("rejects a sign-up without a postal code", async () => {
    await expect(
      auth.api.signUpEmail({
        // @ts-expect-error postalCode is deliberately missing
        body: { name: "Mads", email: "nopostal@example.dk", password },
      }),
    ).rejects.toThrow();
  });
});
