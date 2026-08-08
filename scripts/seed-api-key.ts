import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { ApiKeyService } from '../src/contexts/api-keys/api-key.service';
import minimist from 'minimist';
import { parseScopes } from './parse-scopes';

async function bootstrap() {
  const args = minimist(process.argv.slice(2));
  const name = args.name;
  const scopes = parseScopes(args.scopes);
  const force = Boolean(args.force);

  if (!name) {
    console.error(
      'Usage: pnpm seed:api-key --name=<name> [--scopes=send,bulk,admin] [--force]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  const apiKeyService = app.get(ApiKeyService);

  try {
    const existing = await apiKeyService.findByName(name);
    if (existing && !force) {
      console.error(
        `API Key with name "${name}" already exists. Re-run with --force to replace it.`,
      );
      await app.close();
      process.exit(1);
    }

    const { rawKey } = existing
      ? await apiKeyService.rotate(name, scopes)
      : await apiKeyService.generate(name, scopes);

    console.log('---------------------------------------------------------');
    if (existing) {
      console.log('♻️  API Key replaced. The previous key no longer works.');
    }
    console.log('✅ API Key generated successfully!');
    console.log(`Name:   ${name}`);
    console.log(`Scopes: [${scopes.join(', ')}]`);
    console.log('---------------------------------------------------------');
    console.log(`RAW KEY: ${rawKey}`);
    console.log('---------------------------------------------------------');
    console.log('⚠️  Store this key safely. It will NOT be shown again.');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding API Key:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
