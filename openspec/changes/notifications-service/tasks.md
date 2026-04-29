# Tasks: Notifications Microservice

## Phase 1: Bootstrap & Infra
- [x] 1.1 `pnpm init`, install NestJS 10 CLI, Fastify adapter, SWC, Vitest, ESLint/Prettier, Husky
- [x] 1.2 Create `tsconfig.json` with path aliases matching Cornapp (`@/src/*`, `@/contexts/*`, `@/shared/*`, `@/tests/*`)
- [x] 1.3 Scaffold `src/main.ts` (Fastify adapter, helmet, strict CORS, global ValidationPipe whitelist+transform, Swagger `/api`)
- [x] 1.4 Create `src/app/app.module.ts` + `health.controller.ts` (`GET /health`)
- [x] 1.5 Add `src/config/env.validation.ts` with Zod schema (MONGO_URI, PORT, API_KEY_PEPPER, BULK_MAX_ROWS, DELAY_MIN_MS, DELAY_MAX_MS, DAILY_CAP, CB_*)
- [x] 1.6 Wire `@nestjs/mongoose` via `MongooseModule.forRootAsync` reading validated config
- [x] 1.7 Add `src/config/agenda.config.ts` + `AgendaModule` provider (singleton, concurrency defaults)
- [x] 1.8 Add middleware: `CorrelationIdMiddleware`, `LoggerMiddleware` (phone-masking formatter)

## Phase 2: API Keys & Auth
- [x] 2.1 Create `src/contexts/api-keys/api-key.schema.ts` (name, hash, scopes[], enabled, createdAt)
- [x] 2.2 Create `api-key.service.ts` with `generate()`, `verify(rawKey)` using argon2id + pepper
- [x] 2.3 Implement `ApiKeyGuard` reading `X-Api-Key`, attaching `request.apiKey`; 401 on miss
- [x] 2.4 Add optional `IpAllowlistGuard` reading `IP_ALLOWLIST` env
- [x] 2.5 Wire `@nestjs/throttler` globally with tighter limits on `/auth/whatsapp/qr`
- [x] 2.6 Create CLI `scripts/seed-api-key.ts` → `pnpm seed:api-key --name=<x> --scopes=send,bulk,admin`; prints raw key once

## Phase 3: Channel Strategy
- [x] 3.1 Define `src/contexts/channels/inotification-channel.ts` interface (key, send, healthy)
- [x] 3.2 Implement `ChannelRegistry` with `register()` + `get(key)`, throws on unknown channel
- [x] 3.3 Create `ChannelsModule` with multi-provider token `CHANNEL` collected by registry

## Phase 4: WhatsApp Channel
- [x] 4.1 Create `src/contexts/whatsapp/wa-session.schema.ts` (id='default', creds, keys Map, updatedAt)
- [x] 4.2 Implement `mongo-auth-state.ts` adapter returning Baileys `AuthenticationState` + `saveCreds`
- [x] 4.3 Create `WhatsAppService` managing Baileys socket lifecycle (connect/reconnect/logout), exposes `qr$` subject and `status`
- [x] 4.4 Create `WhatsAppController`: `POST /auth/whatsapp/qr` (SSE stream), `GET /auth/whatsapp/status`, `POST /auth/whatsapp/logout` — all under `ApiKeyGuard` scope `admin`
- [x] 4.5 Implement `whatsapp.channel.ts` (`INotificationChannel`) calling `sock.sendMessage()` with E.164 → `@s.whatsapp.net`
- [x] 4.6 Wrap `send()` with `opossum` circuit breaker; open on CB thresholds, expose `healthy()`
- [x] 4.7 Register WhatsAppChannel in `ChannelsModule`

## Phase 5: Notifications — Single Send
- [x] 5.1 Create `send.dto.ts` with `channel`, `to` (E.164 via custom validator), `message` (max len, sanitized)
- [x] 5.2 `NotificationsService.send()`: enforce daily cap (Mongo counter by day) → 429 if reached
- [x] 5.3 `POST /notifications/send` controller → call service → return `{ providerMessageId, sentAt }`
- [x] 5.4 Append `AuditLog` entry on every attempt (success/failure)

## Phase 6: Notifications — Bulk CSV
- [x] 6.1 Create `batch.schema.ts` and `job.schema.ts` (statuses include `cancelled_daily_cap`)
- [x] 6.2 Implement `csv-parser.service.ts` streaming + row-by-row validation (max 500)
- [x] 6.3 `POST /notifications/bulk` multipart controller; returns 202 `{ batchId, total }`
- [x] 6.4 `BulkService.enqueue()`: persist Batch + Jobs, schedule each via `agenda.schedule(ts, 'notifications.dispatch', {jobId})` with cumulative random(5–30s)
- [x] 6.5 Define `dispatch-processor.ts` agenda job (concurrency=1): load Job, check daily cap → cancel remaining if hit, else dispatch via registry, update Job + AuditLog
- [x] 6.6 `GET /notifications/jobs/:id` and `GET /notifications/batches/:id` for status

## Phase 7: Audit & Observability
- [x] 7.1 Create `audit-log.schema.ts` (append-only, toMasked, ts) + `audit.service.ts`
- [x] 7.2 Add `phone.util.ts` (libphonenumber-js normalize + mask last 4)
- [x] 7.3 Structured logging with correlation id; scrub phones/messages

## Phase 8: Testing
- [x] 8.1 Unit: csv-parser, phone util, daily cap logic, channel registry, api-key service (argon2 roundtrip), circuit breaker transitions
- [x] 8.2 Integration (mongodb-memory-server + Baileys mock): mongo auth adapter roundtrip, agenda schedule + worker picks job with correct delay, audit log append
- [x] 8.3 E2E (supertest): `/send` happy + invalid key + bad phone + over-cap, `/bulk` 10-row CSV with time mocked, `/jobs/:id` transitions, `/auth/whatsapp/status`

## Phase 9: Docker & Docs
- [x] 9.1 `Dockerfile` (multi-stage, Node 22, pnpm) + `docker-compose.yml` (service + mongo volume)
- [x] 9.2 `.env.example` with all env vars
- [x] 9.3 `README.md`: single-replica constraint, QR flow, seed script, consumer integration example
- [x] 9.4 Swagger annotations on all DTOs/controllers; verify `/api` renders

