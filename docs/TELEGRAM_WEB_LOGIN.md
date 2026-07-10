# Telegram login for the web

Beajee supports browser login through Telegram OpenID Connect. A person who
already started in the Beajee Telegram Mini App is resolved by the same,
unique `Owner.telegramId`; no separate account or manual linking is required.

## Production setup

1. Open the Beajee bot in **@BotFather** → **Bot Settings** → **Web Login**.
2. Add the production app origin to Allowed URLs and register this exact
   redirect URL: `https://app.beajee.com/api/auth/callback/telegram`.
   Register the appropriate local URL too when testing locally.
3. Copy the Web Login Client ID and Client Secret into the deployment
   environment as `TELEGRAM_LOGIN_CLIENT_ID` and
   `TELEGRAM_LOGIN_CLIENT_SECRET`.
4. Set `NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED=true`, then redeploy.

The implementation uses the OIDC authorization-code flow with PKCE, state,
and nonce validation. The client secret stays server-side. Do not reuse the
Telegram bot token as the OIDC client secret.

When a person has no Beajee owner record yet, web login creates an account
with their Telegram identity. Their synthetic `@telegram.beajee.local` email
is an internal identifier, not a deliverable email address.
