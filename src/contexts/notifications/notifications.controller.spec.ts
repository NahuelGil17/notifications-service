import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';
import { BulkDirectDto } from './dtos/bulk-direct.dto';

/**
 * Unit tests for the bulk-direct route: scope enforcement and delegation.
 * Payload shape is covered by the DTO spec; queueing behavior by the
 * BulkService spec. Here only the controller's own responsibilities matter.
 */
describe('NotificationsController.bulkDirect', () => {
  const notificationsService = { send: vi.fn(), dispatch: vi.fn(), getHistory: vi.fn() };
  const csvParserService = { parse: vi.fn() };
  const bulkService = {
    enqueue: vi.fn(),
    enqueueDirect: vi.fn(),
    getBatch: vi.fn(),
    getJob: vi.fn(),
  };

  let controller: NotificationsController;

  function requestWithScopes(scopes: string[]) {
    return { apiKey: { name: 'gym-backend', scopes } };
  }

  function buildDto(): BulkDirectDto {
    const dto = new BulkDirectDto();
    dto.to = ['+59891234567', '+59891234568'];
    dto.message = 'Hola\n\n- linea dos';
    return dto;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NotificationsController(
      notificationsService as never,
      bulkService as never,
      csvParserService as never,
    );
  });

  it('enqueues through the service and returns its accepted result', async () => {
    const accepted = { batchId: 'batch-1', total: 2 };
    bulkService.enqueueDirect.mockResolvedValue(accepted);
    const dto = buildDto();

    const result = await controller.bulkDirect(dto, 'corr-9', requestWithScopes(['bulk']));

    expect(result).toEqual(accepted);
    expect(bulkService.enqueueDirect).toHaveBeenCalledWith(
      dto.to,
      dto.message,
      'gym-backend',
      'corr-9',
    );
  });

  it('accepts the admin scope as well', async () => {
    bulkService.enqueueDirect.mockResolvedValue({ batchId: 'b', total: 1 });

    await controller.bulkDirect(buildDto(), undefined as never, requestWithScopes(['admin']));

    expect(bulkService.enqueueDirect).toHaveBeenCalled();
  });

  it('rejects an api key without bulk or admin scope', async () => {
    await expect(
      controller.bulkDirect(buildDto(), 'corr-9', requestWithScopes(['send'])),
    ).rejects.toThrow(UnauthorizedException);

    expect(bulkService.enqueueDirect).not.toHaveBeenCalled();
  });

  it('rejects a request whose api key carries no scopes at all', async () => {
    await expect(
      controller.bulkDirect(buildDto(), 'corr-9', { apiKey: {} }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
