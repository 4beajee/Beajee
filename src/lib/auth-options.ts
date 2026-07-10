import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/email";
import {
  clearLoginFailures,
  isLoginBlocked,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/login-throttle";

// Cookie domain for cross-subdomain session sharing (e.g. ".beajee.com")
// Strip surrounding quotes to be safe across different env-file parsers
const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN?.replace(/^["']|["']$/g, "") || undefined;
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

type TelegramProfile = {
  sub?: string;
  id?: string | number;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

function telegramDisplayName(profile: TelegramProfile) {
  return profile.name || profile.preferred_username || "Telegram user";
}

function telegramProvider(): OAuthConfig<TelegramProfile> {
  return {
    id: "telegram",
    name: "Telegram",
    type: "oauth",
    wellKnown: "https://oauth.telegram.org/.well-known/openid-configuration",
    clientId: process.env.TELEGRAM_LOGIN_CLIENT_ID,
    clientSecret: process.env.TELEGRAM_LOGIN_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile" } },
    idToken: true,
    // Telegram supports the OIDC authorization-code flow. These checks prevent
    // login CSRF, code interception, and replay of an ID token.
    checks: ["pkce", "state", "nonce"],
    profile(profile) {
      const telegramId = String(profile.id ?? profile.sub ?? "");
      if (!telegramId) throw new Error("Telegram profile did not include an identifier");

      return {
        id: telegramId,
        email: `telegram-${telegramId}@telegram.beajee.local`,
        name: telegramDisplayName(profile),
        image: profile.picture ?? null,
        onboarded: false,
      };
    },
  };
}

const telegramLoginConfigured = Boolean(
  process.env.TELEGRAM_LOGIN_CLIENT_ID && process.env.TELEGRAM_LOGIN_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  cookies: cookieDomain
    ? {
        sessionToken: {
          name: useSecureCookies
            ? "__Secure-next-auth.session-token"
            : "next-auth.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies,
            domain: cookieDomain,
          },
        },
        callbackUrl: {
          name: useSecureCookies
            ? "__Secure-next-auth.callback-url"
            : "next-auth.callback-url",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies,
            domain: cookieDomain,
          },
        },
        csrfToken: {
          name: useSecureCookies
            ? "__Host-next-auth.csrf-token"
            : "next-auth.csrf-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies,
          },
        },
      }
    : undefined,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      client: {
        clockTolerance: 100000,
      },
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),

    ...(telegramLoginConfigured ? [telegramProvider()] : []),

    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email);
        const forwarded = request.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ??
          request.headers?.["x-real-ip"] ?? "unknown";
        const throttleKey = loginThrottleKey(email, ip);
        if (await isLoginBlocked(throttleKey)) return null;

        const owner = await prisma.owner.findUnique({
          where: { email },
        });

        if (!owner || !owner.passwordHash) {
          await recordLoginFailure(throttleKey, owner?.id ?? null);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, owner.passwordHash);
        if (!valid) {
          await recordLoginFailure(throttleKey, owner.id);
          return null;
        }
        await clearLoginFailures(throttleKey);

        return {
          id: owner.id,
          email: owner.email,
          name: owner.name,
          image: owner.image,
          onboarded: owner.onboarded,
        };
      },
    }),
  ],

  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch { /* invalid URL, fall through */ }
      console.log(`[auth] redirect: fallback to baseUrl "${baseUrl}" (url was "${url}")`);
      return baseUrl;
    },

    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          if (!user.email) return false;
          const normalizedEmail = normalizeEmail(user.email);
          // Link Google account to existing or new Owner
          const existing = await prisma.owner.findUnique({
            where: { email: normalizedEmail },
          });

          if (existing) {
            // Update image/name if not set
            await prisma.owner.update({
              where: { id: existing.id },
              data: {
                emailVerified: new Date(),
                image: existing.image ?? user.image,
                name: existing.name ?? user.name,
              },
            });

            // Link Google account if not already linked
            const linked = await prisma.account.findFirst({
              where: {
                userId: existing.id,
                provider: "google",
              },
            });

            if (!linked) {
              await prisma.account.create({
                data: {
                  userId: existing.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token as string | undefined,
                  refresh_token: account.refresh_token as string | undefined,
                  expires_at: account.expires_at as number | undefined,
                  token_type: account.token_type as string | undefined,
                  scope: account.scope as string | undefined,
                  id_token: account.id_token as string | undefined,
                },
              });
            }

            user.id = existing.id;
            user.onboarded = existing.onboarded;
          } else {
            // Create new Owner from Google profile
            const newOwner = await prisma.owner.create({
              data: {
                email: normalizedEmail,
                name: user.name,
                image: user.image,
                emailVerified: new Date(),
                onboarded: false,
              },
            });

            await prisma.account.create({
              data: {
                userId: newOwner.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token as string | undefined,
                refresh_token: account.refresh_token as string | undefined,
                expires_at: account.expires_at as number | undefined,
                token_type: account.token_type as string | undefined,
                scope: account.scope as string | undefined,
                id_token: account.id_token as string | undefined,
              },
            });

            user.id = newOwner.id;
            user.onboarded = false;
          }

        } catch (err) {
          console.error("[auth] Google signIn callback error:", err);
          return false;
        }
      }

      if (account?.provider === "telegram") {
        try {
          const telegramId = account.providerAccountId;
          if (!telegramId) return false;

          // The Telegram ID is the stable identity shared by the Mini App and
          // browser login. It lets an owner who started in Telegram continue on
          // the web without an email, password, or account-merging step.
          const owner = await prisma.owner.upsert({
            where: { telegramId },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
            create: {
              telegramId,
              email: `telegram-${telegramId}@telegram.beajee.local`,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              onboarded: false,
            },
          });

          const linkedAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "telegram",
                providerAccountId: telegramId,
              },
            },
          });
          if (linkedAccount && linkedAccount.userId !== owner.id) {
            console.error("[auth] Telegram identity is linked to a different owner");
            return false;
          }
          if (!linkedAccount) {
            await prisma.account.create({
              data: {
                userId: owner.id,
                type: account.type,
                provider: "telegram",
                providerAccountId: telegramId,
                access_token: account.access_token as string | undefined,
                refresh_token: account.refresh_token as string | undefined,
                expires_at: account.expires_at as number | undefined,
                token_type: account.token_type as string | undefined,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          user.id = owner.id;
          user.email = owner.email;
          user.name = owner.name;
          user.image = owner.image;
          user.onboarded = owner.onboarded;
        } catch (err) {
          console.error("[auth] Telegram signIn callback error:", err);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.onboarded = user.onboarded;
        const owner = await prisma.owner.findUnique({
          where: { id: user.id },
          select: { sessionVersion: true },
        });
        token.sessionVersion = owner?.sessionVersion ?? 0;
      }

      // Allow session update to refresh onboarded status
      if (trigger === "update" && session?.onboarded !== undefined) {
        token.onboarded = session.onboarded;
      }

      // Check the credential version on every refresh so password changes revoke old JWTs.
      if (token.id) {
        try {
          const owner = await prisma.owner.findUnique({
            where: { id: token.id as string },
            select: { onboarded: true, sessionVersion: true },
          });
          if (!owner || owner.sessionVersion !== token.sessionVersion) {
            token.revoked = true;
            token.id = "";
          } else {
            token.onboarded = owner.onboarded;
          }
        } catch {
          // Ignore — next request will retry
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      session.user.onboarded = token.onboarded;
      session.revoked = token.revoked === true;
      return session;
    },
  },
};
