import { Controller, Post, Get, Body, Param, UseGuards, Headers, Request, Query, BadRequestException, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { BulkService } from './bulk.service';
import { CsvParserService } from './csv-parser.service';
import { SendNotificationDto } from './dtos/send.dto';
import { BulkDirectDto } from './dtos/bulk-direct.dto';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { FastifyRequest } from 'fastify';
import { Readable } from 'stream';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(ApiKeyGuard)
@ApiHeader({ name: 'X-Api-Key', required: true })
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly bulkService: BulkService,
    private readonly csvParserService: CsvParserService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a single notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async send(
    @Body() dto: SendNotificationDto,
    @Headers('x-correlation-id') correlationId: string,
    @Request() req: any,
  ) {
    this.checkScopes(req, ['send', 'admin']);
    return this.notificationsService.send(dto, correlationId);
  }

  @Post('bulk')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CSV for bulk notifications' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Bulk processing started' })
  async uploadBulk(
    @Request() req: any, // FastifyRequest
    @Headers('x-correlation-id') correlationId: string,
  ) {
    this.checkScopes(req, ['bulk', 'admin']);
    
    // Manual multipart handling for Fastify
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    if (data.mimetype !== 'text/csv' && !data.filename.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const rows = await this.csvParserService.parse(data.file);
    
    return this.bulkService.enqueue(
      data.filename,
      rows,
      req.apiKey.name,
      correlationId
    );
  }

  @Post('bulk-direct')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue a bulk message for a list of recipients (no file)' })
  @ApiResponse({ status: 202, description: 'Bulk processing started' })
  async bulkDirect(
    @Body() dto: BulkDirectDto,
    @Headers('x-correlation-id') correlationId: string,
    @Request() req: any,
  ) {
    this.checkScopes(req, ['bulk', 'admin']);

    return this.bulkService.enqueueDirect(dto.to, dto.message, req.apiKey.name, correlationId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get notification history (audit logs)' })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'failure'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @Request() req: any,
    @Query('correlationId') correlationId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkScopes(req, ['history', 'admin']);
    return this.notificationsService.getHistory({
      correlationId: correlationId || undefined,
      status: status || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get batch status' })
  async getBatch(@Param('id') id: string, @Request() req: any) {
    this.checkScopes(req, ['bulk', 'admin']);
    return this.bulkService.getBatch(id);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job status' })
  async getJob(@Param('id') id: string, @Request() req: any) {
    this.checkScopes(req, ['bulk', 'admin']);
    return this.bulkService.getJob(id);
  }

  @Get('mongo-test')
  @ApiOperation({ summary: 'Internal tool to debug MongoDB connection and collections' })
  async mongoTest(@Request() req: any) {
    this.checkScopes(req, ['admin']);
    return this.notificationsService.mongoTest();
  }

  private checkScopes(req: any, required: string[]) {
    const scopes = req.apiKey?.scopes || [];
    const hasScope = required.some(s => scopes.includes(s));
    if (!hasScope) {
      throw new UnauthorizedException(`Insufficient scopes (requires one of: ${required.join(', ')})`);
    }
  }
}
