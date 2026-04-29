import { Controller, Get, Post, Sse, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { map, filter } from 'rxjs';
import { WhatsAppService, WhatsAppStatus } from './whatsapp.service';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { Request } from '@nestjs/common';

@ApiTags('WhatsApp Auth')
@Controller('auth/whatsapp')
@UseGuards(ApiKeyGuard)
@ApiHeader({ name: 'X-Api-Key', required: true })
export class WhatsAppController {
  constructor(private whatsappService: WhatsAppService) {}

  @Sse('qr')
  @ApiOperation({ summary: 'Get WhatsApp QR code via SSE' })
  qr(@Request() req: any) {
    this.checkAdminScope(req);
    return this.whatsappService.qr$.pipe(
      filter((qr) => qr !== null),
      map((qr) => ({ data: { qr } }))
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Get WhatsApp connection status' })
  status(@Request() req: any) {
    this.checkAdminScope(req);
    return {
      status: this.whatsappService.status$.value,
      isConnected: this.whatsappService.isConnected(),
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and delete WhatsApp session' })
  async logout(@Request() req: any) {
    this.checkAdminScope(req);
    await this.whatsappService.logout();
    return { message: 'Logged out successfully' };
  }

  private checkAdminScope(req: any) {
    if (!req.apiKey?.scopes?.includes('admin')) {
      throw new UnauthorizedException('Admin scope required');
    }
  }
}
