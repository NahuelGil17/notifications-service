# Design: Switch Phone Validation to Uruguay (UY)

## Technical Approach

Replace the hardcoded default country `'AR'` with `'UY'` in `PhoneUtil` and replace all Argentine test phone numbers (+54 prefix) with equivalent Uruguayan numbers (+598 prefix). No structural changes, no new dependencies, no logic modifications — `libphonenumber-js` already supports Uruguay. The E.164 regex in `send.dto.ts` (`^\+[1-9]\d{1,14}$`) already matches +598 numbers unchanged.

## Architecture Decisions

### Decision: Hardcode `'UY'` vs Parameterized Country

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hardcode `'UY'` | Simple, zero-config; tied to single country | **Chosen** |
| Env var `PHONE_DEFAULT_COUNTRY` | Flexible, multi-country; adds config surface and complexity | Rejected |

**Rationale**: This service operates a single WhatsApp session linked to a single phone number. Multi-country support adds configuration complexity with zero current benefit. If multi-country is needed in the future, extracting the default country to an env var is a trivial follow-up change — `libphonenumber-js`'s country parameter already accepts any ISO 3166-1 alpha-2 code. The hardcoded `'UY'` is intentionally a configuration constant, not a structural coupling.

Uruguayan phone format: country code `+598`, 8 subscriber digits, no area codes. Mobile numbers start with `9`. Valid example: `+59891234567`.

## File Changes

| # | File | Before | After |
|---|------|--------|-------|
| 1 | `src/shared/utils/phone.util.ts` | `parsePhoneNumberWithError(phone, 'AR')` | `'AR'` → `'UY'` |
|   |  | `isValidPhoneNumber(phone, 'AR')` | `'AR'` → `'UY'` |
|   |  | JSDoc: "default country AR" | "default country UY" |
|   |  | JSDoc example: `+5491112345678` | `+59891234567` |
| 2 | `src/shared/utils/phone.util.spec.ts` | `normalize('+54 9 11 1234-5678')` → `'+5491112345678'` | `normalize('+598 91 234 567')` → `'+59891234567'` |
|   |  | `mask('+5491112345678')` → `'**********5678'` | `mask('+59891234567')` → `'********4567'` |
|   |  | `isValid('+54 9 11 1234-5678')` → `true` | `isValid('+598 91 234 567')` → `true` |
|   |  | `isValid('11 1234-5678')` (AR area code) | `isValid('091234567')` (UY local) |
|   |  | `isValid('+54 9 11')` (incomplete AR) | `isValid('+598 9')` (incomplete UY) |
|   |  | `isValid('+5491112345678')` (E.164 AR) | `isValid('+59891234567')` (E.164 UY) |
|   |  | `isValid('+1 555 123 4567')` | _unchanged_ — tests wrong-country rejection |
| 3 | `src/contexts/notifications/dtos/send.dto.ts` | `example: '+5491112345678'` | `'+59891234567'` |
|   |  | message: `e.g., +549...` | `e.g., +598...` |
| 4 | `src/contexts/notifications/notifications.service.spec.ts` | 5× `to: '+5491112345678'` | `to: '+59891234567'` |
| 5 | `src/contexts/notifications/csv-parser.service.spec.ts` | `'+5491112345678'`, `'+5491112345679'` | `'+59891234567'`, `'+59891234568'` |
| 6 | `test/app.e2e-spec.ts` | `to: '+5491112345678'` | `to: '+59891234567'` |
| 7 | `README.md` | 3× `+54...` example numbers | `+598...` equivalents |
| — | `test-bulk.csv` | _already uses +598 numbers_ | no change |

**Total: 7 files modified, ~28 string replacements. 0 files created, 0 files deleted.**

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `PhoneUtil.normalize()` with UY numbers | Replace all +54 fixtures with +598; verify E.164 output |
| Unit | `PhoneUtil.isValid()` with UY numbers | Valid UY → `true`, invalid/AR → `false` |
| Unit | `PhoneUtil.mask()` with UY-length numbers | 12-char UY → 8 asterisks + last 4 |
| Integration | `NotificationsService` with UY recipients | Existing integration tests reuse the same fixture constant |
| Integration | `CsvParserService` with UY CSV content | Replace +54 csv strings with +598 |
| E2E | POST `/notifications/send` with UY recipient | Replace +54 payload; still expects 401 (unauth) |

All existing test logic remains identical. Only string values change. `npm test` passing confirms zero regressions. Uruguayan numbers chosen: `+598 91 234 567` (mobile, valid per libphonenumber-js with `'UY'`).

## Open Questions

None. Every replaced number is a valid Uruguayan mobile number. `libphonenumber-js` supports `UY` natively. No ambiguous replacements.
