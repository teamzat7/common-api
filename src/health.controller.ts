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

  @Get('readiness')
  readiness(): {
    ok: boolean;
    missing: string[];
    checks: Record<string, boolean>;
  } {
    const checks = {
      publicApiBaseUrl: this.hasEnv('PUBLIC_API_BASE_URL'),
      razorpayKeyId: this.hasEnv('RAZORPAY_KEY_ID'),
      razorpayKeySecret: this.hasEnv('RAZORPAY_KEY_SECRET'),
      firebaseProjectId: this.hasEnv('FIREBASE_PROJECT_ID'),
      firebaseCredentials: this.hasEnv('FIREBASE_SERVICE_ACCOUNT_JSON') || this.hasEnv('GOOGLE_APPLICATION_CREDENTIALS')
    };
    const missing = Object.entries(checks)
      .filter(([, ready]) => !ready)
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
