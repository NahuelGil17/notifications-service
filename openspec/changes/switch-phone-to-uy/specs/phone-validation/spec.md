# Delta for Phone Validation

## MODIFIED Requirements

### Requirement: Default Validation Country

PhoneUtil.normalize() and isValid() MUST use Uruguay (UY) as the default country for phone number parsing and validation. When a local-format number (without `+` prefix) is passed, it MUST be interpreted as Uruguayan.

(Previously: default country was Argentina (AR). Argentine numbers without prefix (e.g., `11 1234-5678`) were parsed as valid AR. Uruguayan numbers were rejected.)

#### Scenario: Normalize Uruguayan number with +598 prefix

- GIVEN phone = `'+598 95 264 292'`
- WHEN `normalize` is called
- THEN return `'+59895264292'`

#### Scenario: Normalize Uruguayan local number (no prefix)

- GIVEN phone = `'095264292'`
- WHEN `normalize` is called
- THEN return `'+59895264292'`

#### Scenario: Normalize throws on invalid number

- GIVEN phone = `'not-a-phone'`
- WHEN `normalize` is called
- THEN throw `Error('Invalid phone number: not-a-phone')`

#### Scenario: Validate Uruguayan E.164 number

- GIVEN phone = `'+59895264292'`
- WHEN `isValid` is called
- THEN return `true`

#### Scenario: Validate Uruguayan local-format mobile (09X)

- GIVEN phone = `'095264292'`
- WHEN `isValid` is called
- THEN return `true`

#### Scenario: Validate rejects Argentine number

- GIVEN phone = `'+54 11 1234-5678'`
- WHEN `isValid` is called
- THEN return `false`

#### Scenario: Validate rejects invalid, empty, or null input

- GIVEN phone = `'invalid'` | `''` | `null` | `undefined`
- WHEN `isValid` is called
- THEN return `false`

### Requirement: Phone Number Masking (unchanged logic)

PhoneUtil.mask() MUST replace all characters except the last 4 with asterisks. The algorithm is country-agnostic — only the expected mask length changes because Uruguayan E.164 numbers are 12 characters vs Argentine's 14.

(Previously: same behavior; Uruguayan numbers produce `'********6292'` vs Argentine's `'**********5678'`.)

#### Scenario: Mask Uruguayan E.164 number

- GIVEN phone = `'+59895264292'`
- WHEN `mask` is called
- THEN return `'********6292'`

#### Scenario: Mask short string unchanged

- GIVEN phone = `'123'`
- WHEN `mask` is called
- THEN return `'123'`

#### Scenario: Mask empty string returns empty

- GIVEN phone = `''`
- WHEN `mask` is called
- THEN return `''`

## Acceptance Criteria

| # | Criterion | Expected |
|---|-----------|----------|
| 1 | `normalize('095264292')` | `'+59895264292'` |
| 2 | `normalize('+598 95 264 292')` | `'+59895264292'` |
| 3 | `normalize('not-a-phone')` | throws `Error` |
| 4 | `isValid('+59895264292')` | `true` |
| 5 | `isValid('095264292')` | `true` |
| 6 | `isValid('+541112345678')` | `false` |
| 7 | `isValid('invalid')` | `false` |
| 8 | `isValid('')` | `false` |
| 9 | `isValid(null)` | `false` |
| 10 | `mask('+59895264292')` | `'********6292'` |
| 11 | `mask('123')` | `'123'` |
| 12 | `npm test` with UY fixtures | all pass |
| 13 | `npm run test:e2e` with UY recipient | all pass |
| 14 | `send.dto.ts` example | shows `+598` number |
| 15 | `README.md` examples | use Uruguayan numbers |
| 16 | `test-bulk.csv` | already uses UY numbers (no change needed) |
