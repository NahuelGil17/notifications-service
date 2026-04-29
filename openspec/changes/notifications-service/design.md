# Design: Notifications Microservice

## Technical Approach
Context-oriented NestJS service mirroring Cornapp layout. Controllers validate DTOs → Services orchestrate → Channel Registry resolves `INotificationChannel` → WhatsApp channel executes via Baileys. Bulk writes a `batch` + N `jobs` and schedules each on agenda with a per-job `nextRunAt` = baseTime + cumulative random(5–30s). Worker runs in-process (single replica to protect WA single-session).

## Architecture Decisions

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Module layout | `src/contexts/{auth,whatsapp,notifications,channels,audit,api-keys}/` + `src/app/` | Flat modules | Matches Cornapp DDD-lite convention |
| Baileys auth state | Custom Mongo adapter implementing `AuthenticationState` (one doc id=`default`, subdocs for creds + keys map) | `useMultiFileAuthState` on disk | Cloud-friendly, survives container restart |
| Queue | agenda.js with job `notifications.dispatch` | BullMQ (Redis), custom cron | No Redis; agenda is Mongo-native, mature |
| Channel resolution | `ChannelRegistry` map `<string, INotificationChannel>` populated via Nest DI multi-provider | Factory + switch | Open/Closed — new channel = new provider, zero controller changes |
| QR delivery | `GET /auth/whatsapp/qr` SSE stream of `{qr, status}` events | One-shot base64 | QR rotates every ~20s; SSE handles rotation + status transitions |
| Circuit breaker | `opossum` wrapping `WhatsAppChannel.send`; opens on N consecutive failures or WA `connection.close` with logout reason | Custom logic | Battle-tested, observable |
| API Key hashing | argon2id | bcrypt | Modern, memory-hard, recommended by OWASP |
| Retry policy | agenda attempts=3, exponential backoff (1m/5m/15m), dead-letter status=`failed` with lastError | Manual requeue | Built-in, idempotent |
| Concurrency | agenda `defaultConcurrency: 1` for `notifications.dispatch` | Parallel workers | Single WA session MUST serialize sends |
| Daily cap | Hard stop: 429 on `/send`; bulk jobs flip remaining to `cancelled_daily_cap` (resumable next day) | Warn + continue | Protects number from ban |
| Bootstrap | CLI seed script `pnpm seed:api-key` prints key once | Env-var first-run | Keys never enter env/logs |
| Replicas | Single replica enforced + documented | Horizontal scale | WA single-session can't be sharded |

## Data Flow

    POST /bulk (csv)
      → ApiKeyGuard → BulkController → BulkService
        → validate(max 500 rows, E.164) → sanitize
        → Mongo: create Batch + N Jobs (status=pending)
        → for i in jobs: agenda.schedule(baseTs + Σ rand(5,30s), 'notifications.dispatch', {jobId})
      ← 202 {batchId, total}

    agenda worker (concurrency=1)
      → load Job → daily-cap check → CircuitBreaker(ChannelRegistry.get(job.channel).send())
      → update Job.status, write AuditLog entry (phone obfuscated)

    POST /auth/whatsapp/qr (SSE)
      → WhatsAppService.startSession() emits 'qr' events → client renders

## File Changes (key new files)

| File | Purpose |
|---|---|
| `src/app/app.module.ts` | Root module, Mongoose + agenda module imports |
| `src/contexts/whatsapp/whatsapp.module.ts` + `service.ts` + `controller.ts` | QR/status/logout, Baileys lifecycle |
| `src/contexts/whatsapp/mongo-auth-state.ts` | Custom `AuthenticationState` adapter |
| `src/contexts/whatsapp/whatsapp.channel.ts` | `INotificationChannel` impl, wrapped by opossum |
| `src/contexts/channels/channel-registry.ts` + `inotification-channel.ts` | Strategy interface + registry |
| `src/contexts/notifications/notifications.{module,controller,service}.ts` | `/send`, `/bulk`, `/jobs/:id` |
| `src/contexts/notifications/bulk/csv-parser.service.ts` | Streams CSV, validates rows |
| `src/contexts/notifications/agenda/dispatch-processor.ts` | agenda job definition |
| `src/contexts/audit/audit-log.{schema,service}.ts` | Immutable dispatch log |
| `src/contexts/api-keys/{schema,guard,service}.ts` | argon2 hash, ApiKeyGuard |
| `src/config/{env.validation.ts, agenda.config.ts}` | Zod env schema + agenda wiring |
| `src/shared/phone.util.ts` | libphonenumber-js wrapper + obfuscation |
| `scripts/seed-api-key.ts` | CLI to generate first API Key |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | Service + Mongo |
| `tests/unit/**`, `tests/e2e/**` | Vitest |

## Interfaces / Contracts

```ts
export interface INotificationChannel {
  readonly key: 'whatsapp' | 'sms' | 'email' | 'telegram';
  send(input: { to: string; message: string; meta?: Record<string, unknown> }):
    Promise<{ providerMessageId?: string; sentAt: Date }>;
  healthy(): Promise<boolean>;
}

// Schemas (Mongoose, simplified)
WaSession  { _id:'default', creds, keys:Map, updatedAt }
Batch      { _id, total, sent, failed, createdBy(apiKeyId), createdAt }
Job        { _id, batchId?, channel, to, message,
             status:'pending'|'sent'|'failed'|'cancelled_daily_cap',
             attempts, lastError?, scheduledAt, sentAt?, providerMessageId? }
AuditLog   { _id, jobId?, channel, toMasked, status, error?, ts } // append-only
ApiKey     { _id, name, hash(argon2id), scopes:['send','bulk','admin'], enabled, createdAt }

// Env (Zod): MONGO_URI, PORT, API_KEY_PEPPER, IP_ALLOWLIST?, BULK_MAX_ROWS=500,
//            DELAY_MIN_MS=5000, DELAY_MAX_MS=30000, DAILY_CAP=500,
//            CB_FAILURE_THRESHOLD=5, CB_RESET_MS=60000
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | CSV parse/validate, phone normalize/mask, delay scheduler, channel registry, api-key guard, circuit breaker transitions | Vitest + mocks |
| Integration | Mongo auth adapter roundtrip, agenda scheduling + worker, audit log append | Vitest + `mongodb-memory-server` + mocked Baileys |
| E2E | `/notifications/send` happy + bad key, `/bulk` with 10-row CSV (delays mocked), `/jobs/:id` lifecycle, `/auth/whatsapp/status` | Vitest + supertest |

## Migration / Rollout
Greenfield, no migration. Rollout: deploy service (single replica), create first API Key via `pnpm seed:api-key`, admin hits `/auth/whatsapp/qr` and scans, enable feature flag in consumer backends.

## Open Questions
Resolved:
- Daily cap → hard stop (429 / `cancelled_daily_cap`)
- Bootstrap → CLI seed script
- Multi-replica → single replica, enforced + documented
