import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app/app.module';
import { ApiKeyService } from '../src/contexts/api-keys/api-key.service';
import minimist from 'minimist';

async function bootstrap() {
  const args = minimist(process.argv.slice(2));
  const name = args.name;
  const scopes = args.scopes ? args.scopes.split(',') : [];

  if (!name) {
    console.error('Usage: pnpm seed:api-key --name=<name> [--scopes=send,bulk,admin]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const apiKeyService = app.get(ApiKeyService);

  try {
    const existing = await apiKeyService.findByName(name);
    if (existing) {
      console.error(`API Key with name "${name}" already exists.`);
      await app.close();
      process.exit(1);
    }

    const { rawKey } = await apiKeyService.generate(name, scopes);
    
    console.log('---------------------------------------------------------');
    console.log('✅ API Key generated successfully!');
    console.log(`Name:   ${name}`);
    console.log(`Scopes: [${scopes.join(', ')}]`);
    console.log('---------------------------------------------------------');
    console.log(`RAW KEY: ${rawKey}`);
    console.log('---------------------------------------------------------');
    console.log('⚠️  Store this key safely. It will NOT be shown again.');
    
    await app.close();
  } catch (error) {
    console.error('❌ Error seeding API Key:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
