import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health(): { ok: true; service: string; timestamp: string } {
    return {
      ok: true,
      service: 'vizhinjam-payment-api',
      timestamp: new Date().toISOString()
    };
  }
}
