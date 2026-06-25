# Vizhinjam Payment API

NestJS API for Vizhinjam Summit ticket payments.

## Endpoints

- `GET /api/health`
- `POST /api/payments/create-checkout`
- `POST /api/payments/verify`
- `GET /api/payments/status`
- `POST /api/payments/webhook`

## Local Setup

```bash
npm install
copy .env.example .env
npm run build
npm run start
```

Set Razorpay keys and Firebase Admin credentials in `.env`.

## UI Config

After hosting this API, update `vizh-web/public/assets/config.json`:

```json
{
  "paymentApiBaseUrl": "https://YOUR_API_DOMAIN/api"
}
```

The Angular app derives checkout, verify, and status URLs from this base URL.
