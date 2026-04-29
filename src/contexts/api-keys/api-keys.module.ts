import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './api-key.schema';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './api-key.guard';
import { IpAllowlistGuard } from './ip-allowlist.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
  ],
  providers: [ApiKeyService, ApiKeyGuard, IpAllowlistGuard],
  exports: [ApiKeyService, ApiKeyGuard, IpAllowlistGuard],
})
export class ApiKeysModule {}
