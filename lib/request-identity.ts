const openAccessEmail = "open-access@prologis.local";
const localBusinessTeamEmail = "local-business-team@prologis.local";

export type RequestIdentity = {
  email: string;
  displayName: string;
  isAuthenticated: boolean;
};

export function resolveActorIdentityFromRequest(request: Request): RequestIdentity {
  const headerEmail =
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("cf-access-authenticated-user-email") ??
    request.headers.get("x-authenticated-user-email");
  const email = normalizeEmail(headerEmail);
  if (!email) {
    if (isLocalDevelopmentRequest(request)) {
      return {
        email: localBusinessTeamEmail,
        displayName: "Local Business Team",
        isAuthenticated: true,
      };
    }
    return {
      // Never assign an authenticated user's identity when the platform did not
      // provide one. In particular, local development must not impersonate an
      // administrator because that would grant their permissions to every user.
      email: openAccessEmail,
      displayName: displayNameFromEmail(openAccessEmail),
      isAuthenticated: false,
    };
  }

  const fullName = displayNameFromAuthHeaders(request.headers);
  return {
    email,
    displayName: fullName ?? displayNameFromEmail(email),
    isAuthenticated: true,
  };
}

function isLocalDevelopmentRequest(request: Request) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(request.url).hostname);
  } catch {
    return false;
  }
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
