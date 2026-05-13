# Proposal: Switch Phone Validation to Uruguay (UY)

## Intent

Phone validation currently hardcodes Argentina (`'AR'`) as the default country in `PhoneUtil.normalize()` and `PhoneUtil.isValid()`. All test fixtures use Argentine numbers (+54). The service must validate Uruguayan numbers (+598) because the single WhatsApp session will be linked to a Uruguayan phone number. This is a country switch, not a new feature — libphonenumber-js already supports Uruguay fully.

## Scope

### In Scope
- Change default country from `'AR'` → `'UY'` in `phone.util.ts` (2 occurrences + JSDoc)
- Update all test phone numbers from +54 (Argentina) to +598 (Uruguay) across 5 test files
- Update `send.dto.ts` example value and error message
- Update `README.md` example phone numbers
- Verify `mask()` test assertions align with Uruguayan number lengths

### Out of Scope
- Multi-country support (dynamic country code detection)
- Adding new phone features beyond the country switch
- Changing validation rules (E.164 regex, length checks remain identical)

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (configuration change — no spec-level behavior changes; phone validation is part of `notifications-dispatch` and `notifications-bulk` which keep the same contract).

## Approach

Replace all `'AR'` string literals with `'UY'` in production code. Replace all Argentine test numbers (+54...) with equivalent Uruguayan numbers (+598...) in test fixtures. Uruguayan format: country code +598, no area codes, mobile numbers start with 9, 8 subscriber digits total. The existing E.164 regex (`^\+[1-9]\d{1,14}$`) in `send.dto.ts` already matches +598 numbers — no DTO logic changes needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/shared/utils/phone.util.ts` | Modified | 2x `'AR'` → `'UY'`, JSDoc comments updated |
| `src/shared/utils/phone.util.spec.ts` | Modified | 6x +54 numbers → +598; mask assertion updated |
| `src/contexts/notifications/dtos/send.dto.ts` | Modified | Example number + error message text |
| `src/contexts/notifications/notifications.service.spec.ts` | Modified | 5x +54 numbers → +598 |
| `src/contexts/notifications/csv-parser.service.spec.ts` | Modified | 7x +54 numbers → +598 |
| `test/app.e2e-spec.ts` | Modified | 1x +54 number → +598 |
| `README.md` | Modified | 3x example phone numbers |
| `test-bulk.csv` | No change | Already uses Uruguayan numbers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invalid UY test numbers fail validation | Low | libphonenumber-js fully supports +598; verify each replacement number passes `isValid` |
| Mask test breaks on different length | Low | Update expected mask output to match 12-char UY numbers |
| Regression on E.164 regex | None | Regex unchanged; `+59899...` already matches `^\+[1-9]\d{1,14}$` |

## Rollback Plan

Revert the commit. Every change is a string replacement — no schema migrations, no database changes, no structural refactors. `git revert` restores full Argentine validation.

## Dependencies

None external. `libphonenumber-js` already in `package.json` and supports Uruguay.

## Success Criteria

- [ ] `PhoneUtil.normalize('+598 99 123 456')` returns `'+59899123456'`
- [ ] `PhoneUtil.isValid('+59899123456')` returns `true`
- [ ] `PhoneUtil.isValid('+541112345678')` returns `false` (Argentine numbers rejected)
- [ ] All existing tests pass (`npm test`) with Uruguayan numbers
- [ ] E2E test uses valid Uruguayan recipient
- [ ] `PhoneUtil.mask()` output matches UY number lengths
- [ ] `README.md` examples show Uruguayan numbers
