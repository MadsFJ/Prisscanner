import { accounts, sessions, users, verifications } from "./schema/auth";

/** Maps Better Auth's model names to our tables. Pass as `drizzleAdapter(db, { schema })`. */
export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
};

/** Extra user fields Better Auth must accept on sign-up. Pass as `user.additionalFields`. */
export const authUserAdditionalFields = {
  postalCode: { type: "string", required: true, input: true },
} as const;
