import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../config/env.validation';

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  constructor(private configService: ConfigService<EnvVars, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const allowlistStr = this.configService.get('IP_ALLOWLIST', { infer: true });
    if (!allowlistStr) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    
    const allowlist = allowlistStr.split(',').map(i => i.trim());
    
    if (!allowlist.includes(ip)) {
      throw new ForbiddenException(`IP ${ip} not allowed`);
    }

    return true;
  }
}
