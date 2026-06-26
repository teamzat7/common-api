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

Set MongoDB, Razorpay, CORS, and email credentials in `.env`.

Required production variables:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/
MONGODB_DB=vizhinjam
PUBLIC_API_BASE_URL=https://YOUR_API_DOMAIN/api
ALLOWED_ORIGINS=https://vizhinjamsummit.com,https://www.vizhinjamsummit.com
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

## UI Config

After hosting this API, update `vizh-web/public/assets/config.json`:

```json
{
  "paymentApiBaseUrl": "https://YOUR_API_DOMAIN/api"
}
```

The Angular app derives checkout, verify, and status URLs from this base URL.
