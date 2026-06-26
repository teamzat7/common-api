import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const defaultAllowedOrigins = ['https://vizhinjamsummit.com', 'https://www.vizhinjamsummit.com'];
  const allowedOrigins = Array.from(new Set([
    ...defaultAllowedOrigins,
    ...(process.env['ALLOWED_ORIGINS'] ?? '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  ]));

  app.setGlobalPrefix('api');
  app.use(
    '/api/payments/webhook',
    json({
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      }
    })
  );
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
    credentials: false
  });

  await app.listen(Number(process.env['PORT'] ?? 3000));
}

void bootstrap();
