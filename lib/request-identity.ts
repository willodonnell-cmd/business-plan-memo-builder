const adminEmail = "wodonnell@prologis.com";
const openAccessEmail = "open-access@prologis.local";

export type RequestIdentity = {
  email: string;
  displayName: string;
};

export function resolveActorIdentityFromRequest(request: Request): RequestIdentity {
  const headerEmail =
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("cf-access-authenticated-user-email") ??
    request.headers.get("x-authenticated-user-email");
  const email = normalizeEmail(headerEmail);
  if (!email) {
    const fallbackEmail = isLocalRequest(request) ? adminEmail : openAccessEmail;
    return {
      email: fallbackEmail,
      displayName: displayNameFromEmail(fallbackEmail),
    };
  }

  const fullName = displayNameFromAuthHeaders(request.headers);
  return {
    email,
    displayName: fullName ?? displayNameFromEmail(email),
  };
}

export function displayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;
}

export function cleanDisplayName(value?: string | null) {
  const displayName = value?.replace(/\s+/g, " ").trim();
  return displayName || null;
}

export function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }
  return email;
}

function displayNameFromAuthHeaders(headers: Headers) {
  const encodedName = headers.get("oai-authenticated-user-full-name");
  if (
    !encodedName ||
    headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8"
  ) {
    return null;
  }

  try {
    return cleanDisplayName(decodeURIComponent(encodedName));
  } catch {
    return null;
  }
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.endsWith(".local");
}
