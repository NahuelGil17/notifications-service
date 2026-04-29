import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    try {
      const keyDoc = await this.apiKeyService.verify(apiKey);
      request.apiKey = keyDoc;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid API Key');
    }
  }
}
