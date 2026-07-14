const godAccessEmails = new Set([
  "wodonnell@prologis.com",
  "jdevre@prologis.com",
  "sbarrios@prologis.com",
]);

export function hasGodAccess(email: string) {
  return godAccessEmails.has(email.trim().toLowerCase());
}
