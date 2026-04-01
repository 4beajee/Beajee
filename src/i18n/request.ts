import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/** Pick the best locale from the Accept-Language header. */
function detectFromHeader(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  // Parse "en-US,en;q=0.9,zh-CN;q=0.8,hi;q=0.7" → sorted candidates
  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of candidates) {
    // Exact match (e.g. "en", "zh", "hi")
    if (locales.includes(lang as Locale)) return lang as Locale;
    // Prefix match (e.g. "en-us" → "en", "zh-cn" → "zh")
    const prefix = lang.split("-")[0];
    if (locales.includes(prefix as Locale)) return prefix as Locale;
  }
  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value;

  let locale: Locale;

  if (raw && locales.includes(raw as Locale)) {
    // Explicit user choice — respect it
    locale = raw as Locale;
  } else {
    // Auto-detect from browser
    const headerStore = await headers();
    const acceptLang = headerStore.get("accept-language");
    locale = detectFromHeader(acceptLang) ?? defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
