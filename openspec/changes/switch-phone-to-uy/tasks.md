# Tasks: Switch Phone Validation to Uruguay (UY)

## Phase 1: Core — PhoneUtil

- [x] 1.1 Replace `'AR'`→`'UY'` in `phone.util.ts` lines 10 (`parsePhoneNumberWithError`) and 23 (`isValidPhoneNumber`), update JSDoc comment on line 18 (`default country AR`→`UY`), JSDoc example on line 28 (`+5491112345678`→`+59891234567`), and inline comment on line 11
- [x] 1.2 Replace all +54 AR fixtures→+598 UY in `phone.util.spec.ts`:
  - `normalize('+54 9 11 1234-5678')`→`normalize('+598 91 234 567')`, expected `'+5491112345678'`→`'+59891234567'`
  - `mask('+5491112345678')`→`mask('+59891234567')`, expected `'**********5678'`→`'********4567'`
  - `isValid('+54 9 11 1234-5678')`→`isValid('+598 91 234 567')`
  - `isValid('11 1234-5678')`→`isValid('091234567')`
  - `isValid('+54 9 11')`→`isValid('+598 9')`
  - `isValid('+5491112345678')`→`isValid('+59891234567')`
  - Keep `isValid('+1 555 123 4567')` unchanged (wrong-country rejection test)

## Phase 2: Consumers — DTO & Service Tests

- [x] 2.1 Update `send.dto.ts` line 14: Swagger example `'+5491112345678'`→`'+59891234567'`, line 19 error message `+549`→`+598`
- [x] 2.2 Replace 5× `'+5491112345678'`→`'+59891234567'` in `notifications.service.spec.ts` (lines 86, 102, 109, 131, 138)
- [x] 2.3 Replace all +54 numbers in `csv-parser.service.spec.ts`: `+5491112345678`→`+59891234567` (5 occurrences), `+5491112345679`→`+59891234568` (1 occurrence)

## Phase 3: E2E & Docs

- [x] 3.1 Replace `'+5491112345678'`→`'+59891234567'` in `test/app.e2e-spec.ts` line 47
- [x] 3.2 Replace AR example numbers in `README.md`: lines 88 (`+5491112345678`→`+59891234567`), 106 (`+5491112345678`→`+59891234567`), 107 (`+5491112345679`→`+59891234568`)

## Phase 4: Verification

- [x] 4.1 Run `npm test` — all unit + integration tests pass with UY numbers
- [x] 4.2 Run `npm run test:e2e` — E2E tests pass with UY recipient
- [x] 4.3 Run `nest build` — builds successfully. 3 pre-existing TS2532 errors in `notifications.service.ts` lines 116/117/123 (`auditLogModel.db.db` possibly undefined) — unrelated to this change.
