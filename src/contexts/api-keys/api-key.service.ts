import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { EnvVars } from '../../config/env.validation';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectModel(ApiKey.name) private apiKeyModel: Model<ApiKeyDocument>,
    private configService: ConfigService<EnvVars, true>,
  ) {}

  async generate(name: string, scopes: string[] = []): Promise<{ rawKey: string; keyDoc: ApiKey }> {
    const rawKey = `pf_${randomBytes(24).toString('hex')}`;
    const pepper = this.configService.get('API_KEY_PEPPER', { infer: true });
    
    // Argon2id with pepper
    const hash = await argon2.hash(`${rawKey}${pepper}`, {
      type: argon2.argon2id,
    });

    const keyDoc = await this.apiKeyModel.create({
      name,
      hash,
      scopes,
    });

    return { rawKey, keyDoc };
  }

  async verify(rawKey: string): Promise<ApiKeyDocument> {
    // This is a naive implementation that checks all enabled keys
    // In production, we might want a cache or a way to identify the key name from the prefix
    const keys = await this.apiKeyModel.find({ enabled: true });
    const pepper = this.configService.get('API_KEY_PEPPER', { infer: true });

    for (const key of keys) {
      const isValid = await argon2.verify(key.hash, `${rawKey}${pepper}`);
      if (isValid) {
        return key;
      }
    }

    throw new UnauthorizedException('Invalid API Key');
  }

  async findByName(name: string): Promise<ApiKeyDocument | null> {
    return this.apiKeyModel.findOne({ name }).exec();
  }
}
