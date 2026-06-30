import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

export function isPublicIp(address: string) {
  const normalized = stripIpv6Brackets(address);
  const version = isIP(normalized);
  if (version === 4) {
    const [a, b, c] = normalized.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (version === 6) {
    if (normalized.startsWith("::ffff:")) {
      return isPublicIp(normalized.slice("::ffff:".length));
    }
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return false;
}

export function validateExternalHttpsUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("External URL must use HTTPS");
  if (url.username || url.password) throw new Error("External URL must not contain credentials");
  const hostname = stripIpv6Brackets(url.hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("External URL must use a public host");
  }
  if (isIP(hostname) && !isPublicIp(hostname)) {
    throw new Error("External URL resolves to a non-public address");
  }
  return url;
}

async function resolvePublicAddress(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error("External URL resolves to a non-public address");
  }
  return addresses[0];
}

async function requestText(url: URL, headers: Record<string, string>) {
  const resolved = await resolvePublicAddress(url.hostname);
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          method: "GET",
          headers,
          servername: url.hostname,
          lookup: (_hostname, _options, callback) =>
            callback(null, resolved.address, resolved.family),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_RESPONSE_BYTES) {
              req.destroy(new Error("External response exceeded size limit"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            })
          );
        }
      );
      req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error("External request timed out")));
      req.on("error", reject);
      req.end();
    }
  );
}

export async function safeFetchText(
  rawUrl: string,
  options?: { headers?: Record<string, string> }
) {
  let url = validateExternalHttpsUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await requestText(url, options?.headers ?? {});
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || Array.isArray(location)) throw new Error("Invalid external redirect");
      if (redirect === MAX_REDIRECTS) throw new Error("Too many external redirects");
      url = validateExternalHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`External fetch failed: ${response.status}`);
    }
    return response.body;
  }
  throw new Error("Too many external redirects");
}
