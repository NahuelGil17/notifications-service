import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PhoneUtil } from '../utils/phone.util';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: any, res: any, next: () => void) {
    const { method, url, body, headers } = req;
    const correlationId = headers['x-correlation-id'];
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      
      let scrubbedBody = '';
      if (body) {
        const copy = { ...body };
        if (copy.to) copy.to = PhoneUtil.mask(copy.to);
        if (copy.message) copy.message = '[SCRUBBED]';
        scrubbedBody = JSON.stringify(copy);
      }

      this.logger.log(
        `[${correlationId}] ${method} ${url} ${statusCode} - ${duration}ms - Body: ${scrubbedBody}`
      );
    });

    next();
  }
}
