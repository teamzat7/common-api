import { Controller, Get } from '@nestjs/common';

import { MongoOrderService } from './shared/mongo-order.service';

@Controller('health')
export class HealthController {
  constructor(private readonly orders: MongoOrderService) {}

  @Get()
  health(): { ok: true; service: string; timestamp: string } {
    return {
      ok: true,
      service: 'vizhinjam-payment-api',
      timestamp: new Date().toISOString()
    };
  }

  @Get('readiness')
  async readiness(): Promise<{
    ok: boolean;
    missing: string[];
    checks: Record<string, boolean | string>;
  }> {
    const checks = {
      publicApiBaseUrl: this.hasEnv('PUBLIC_API_BASE_URL'),
      mongoDbUri: this.hasEnv('MONGODB_URI'),
      mongoDbReachable: false as boolean | string,
      razorpayKeyId: this.hasEnv('RAZORPAY_KEY_ID'),
      razorpayKeySecret: this.hasEnv('RAZORPAY_KEY_SECRET')
    };
    if (checks.mongoDbUri) {
      try {
        await this.orders.ping();
        checks.mongoDbReachable = true;
      } catch (error) {
        checks.mongoDbReachable = error instanceof Error ? error.message : String(error);
      }
    }
    const missing = Object.entries(checks)
      .filter(([, ready]) => ready !== true)
      .map(([name]) => name);

    return {
      ok: missing.length === 0,
      missing,
      checks
    };
  }

  private hasEnv(name: string): boolean {
    return Boolean(process.env[name]?.trim());
  }
}
