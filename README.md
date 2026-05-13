# Plus Fit Notifications Service

Microservice for handling notifications via WhatsApp and bulk messaging.

## Tech Stack

- **Framework**: NestJS (Fastify)
- **Database**: MongoDB (Mongoose)
- **Job Queue**: Agenda
- **WhatsApp**: Baileys
- **Security**: Argon2, X-Api-Key Auth, Helmet, Throttler

## Constraints & Considerations

⚠️ **Single Replica Only**: Due to the nature of WhatsApp Web socket management (Baileys), this service **MUST** run as a single instance (replica=1). Scaling horizontally will cause multiple sessions to fight for the same socket, leading to logouts.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- MongoDB instance

### Installation

```bash
pnpm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

### Running the App

```bash
# development
pnpm start:dev

# production mode
pnpm build
pnpm start:prod
```

## Authentication & API Keys

The service uses `X-Api-Key` header for authentication. 

### Seeding an API Key

Use the built-in script to generate a new key:

```bash
pnpm seed:api-key --name=MyClient --scopes=send,bulk,admin
```

**Note**: Scopes can be `send`, `bulk`, or `admin`.

## WhatsApp Integration

### Connection Flow

1. Start the service.
2. Open the Swagger UI at `http://localhost:3000/api`.
3. Use an API Key with `admin` scope.
4. Listen to the SSE stream at `GET /auth/whatsapp/qr`.
5. Scan the QR code with your phone.
6. Check status at `GET /auth/whatsapp/status`.

## API Documentation

Interactive Swagger documentation is available at `/api`.

### Single Send Example

```http
POST /notifications/send
X-Api-Key: pf_...
Content-Type: application/json

{
  "channel": "whatsapp",
  "to": "+59891234567",
  "message": "Hello from Plus Fit!"
}
```

### Bulk CSV Example

```http
POST /notifications/bulk
X-Api-Key: pf_...
Content-Type: multipart/form-data

file: [notifications.csv]
```

CSV Format:
```csv
to,message
+59891234567,Message 1
+59891234568,Message 2
```

## Testing

```bash
# Unit & Integration tests
pnpm test

# E2E tests
pnpm test:e2e
```

## Docker

```bash
docker-compose up --build
```
