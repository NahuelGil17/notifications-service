import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().url(),
  API_KEY_PEPPER: z.string().min(16, 'Pepper must be at least 16 characters'),
  BULK_MAX_ROWS: z.coerce.number().default(500),
  DELAY_MIN_MS: z.coerce.number().default(5000),
  DELAY_MAX_MS: z.coerce.number().default(30000),
  DAILY_CAP: z.coerce.number().default(500),
  // Circuit Breaker configs
  CB_WHATSAPP_THRESHOLD_PCT: z.coerce.number().default(50),
  CB_WHATSAPP_RESET_TIMEOUT_MS: z.coerce.number().default(30000),
  IP_ALLOWLIST: z.string().optional(),
});

export type EnvVars = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
