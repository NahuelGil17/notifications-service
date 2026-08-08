/**
 * Normalizes the --scopes CLI argument into a scope list.
 *
 * Accepts commas, whitespace, or both as separators: PowerShell parses
 * `send,bulk,admin` as an array and joins it with spaces before the script
 * ever sees it, so a comma-only split would store one bogus "send bulk admin"
 * scope and quietly fail every authorization check.
 */
export function parseScopes(input: string | string[] | undefined): string[] {
  if (input === undefined) return [];

  const raw = Array.isArray(input) ? input.join(',') : input;

  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}
