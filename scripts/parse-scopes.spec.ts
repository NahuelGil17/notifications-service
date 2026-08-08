import { describe, it, expect } from 'vitest';
import { parseScopes } from './parse-scopes';

/**
 * PowerShell parses `send,bulk,admin` as an array and joins it with spaces
 * before handing it to a native command, so the seed script receives
 * "send bulk admin". Splitting on commas alone stored that as a single bogus
 * scope, which silently failed every `scopes.includes('admin')` check.
 */
describe('parseScopes', () => {
  it('splits a comma-separated list', () => {
    expect(parseScopes('send,bulk,admin')).toEqual(['send', 'bulk', 'admin']);
  });

  it('splits a space-separated list (PowerShell array flattening)', () => {
    expect(parseScopes('send bulk admin')).toEqual(['send', 'bulk', 'admin']);
  });

  it('handles mixed separators and stray whitespace', () => {
    expect(parseScopes(' send, bulk   admin ')).toEqual(['send', 'bulk', 'admin']);
  });

  it('returns an empty list for undefined or blank input', () => {
    expect(parseScopes(undefined)).toEqual([]);
    expect(parseScopes('   ')).toEqual([]);
  });

  it('coerces a real array, since minimist repeats --scopes flags', () => {
    expect(parseScopes(['send,bulk', 'admin'])).toEqual(['send', 'bulk', 'admin']);
  });

  it('drops duplicates so keys do not accumulate redundant scopes', () => {
    expect(parseScopes('admin,admin,send')).toEqual(['admin', 'send']);
  });
});
