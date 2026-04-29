# Proposal: Notifications Microservice (WhatsApp + extensible)

## Intent
Internal backends need to send single and bulk WhatsApp messages (e.g., tender notifications, client comms) without coupling business logic to any specific channel. Must support future channels (SMS/Email/Telegram) without rewrites, and keep WhatsApp session alive via QR login.

## Scope

### In Scope
- NestJS + Fastify service (greenfield at `plus-fit/notifications-service`)
- Baileys-backed WhatsApp channel with MongoDB-persisted auth state (single global session)
- Strategy Pattern `INotificationChannel` to decouple channels
- Endpoints: QR login, status, logout, send, bulk CSV, job status
- agenda.js queue over MongoDB with random 5–30s delay between bulk sends
- API Key auth (hashed), @nestjs/throttler, helmet, strict CORS
- CSV validation (max 500 rows, MIME/size), E.164 phone validation, message sanitization
- Audit log, phone obfuscation in logs, circuit breaker on WA rejection spikes
- Docker Compose (service + mongo), Vitest tests, Swagger at `/api`

### Out of Scope
- Multi-tenant / multi-number WhatsApp sessions
- WhatsApp Business Cloud API integration
- SMS/Email/Telegram implementations (only the interface)
- Admin UI for QR / jobs
- Webhooks to consumers for delivery status (polling `/jobs/:id` for now)

## Capabilities

### New Capabilities
- `whatsapp-session`: QR login, session persistence, status, logout
- `notifications-dispatch`: single-message send through pluggable channel
- `notifications-bulk`: CSV upload, batch job creation, rate-limited delivery via agenda.js
- `notifications-jobs`: batch/job status lookup
- `api-auth`: API Key + optional IP allowlist for internal backends
- `audit-log`: immutable record of every dispatch attempt

### Modified Capabilities
None (greenfield).

## Approach
Strategy Pattern: controllers → `NotificationService` → `ChannelRegistry` resolves channel by key → channel implementation (WhatsAppChannel via Baileys) executes. Bulk endpoint persists a `batch` + N `jobs`, schedules them on agenda with individual `nextRunAt` spaced by random 5–30s. Worker consumes agenda jobs, invokes channel, updates status, writes audit log. Baileys custom Mongo auth state adapter replaces `useMultiFileAuthState`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `notifications-service/` | New | Whole service |
| Consumer backends | New integration | Will call service via API Key |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WhatsApp bans number | Med | Random delay, daily cap, warm-up, circuit breaker |
| Baileys protocol break | Med | Pin version, monitor upstream |
| Session expires | Med | Status endpoint + alerts, re-scan flow |
| CSV abuse | Low | Size/row limits, auth required |

## Rollback Plan
Service is standalone; consumers call it via API Key. Rollback = stop container, consumers fall back to direct messaging or disable notifications feature flag. No DB migration affects other services since Mongo is dedicated to this service.

## Dependencies
- MongoDB instance (new, dedicated)
- `@whiskeysockets/baileys`, `agenda`, `@nestjs/mongoose`, `libphonenumber-js`, `csv-parse`, `argon2`, `opossum`

## Success Criteria
- [ ] Admin scans QR → session persists across restarts
- [ ] `/notifications/send` delivers a single message E2E
- [ ] `/notifications/bulk` processes 500-row CSV with 5–30s gaps, status trackable via jobId
- [ ] Adding a mock `SmsChannel` requires zero changes in controllers/services
- [ ] All requests require valid API Key; invalid keys rate-limited
- [ ] Audit log records 100% of dispatch attempts
