# Design: QR Test Page

## Technical Approach
The objective is to provide a local web interface to visualize the WhatsApp QR code. We will configure the NestJS/Fastify backend to serve static files from a `public` directory and implement a simple HTML/JavaScript frontend that consumes the existing SSE endpoint.

## Architecture Decisions

### Decision: Static File Serving
**Choice**: Use `@fastify/static` registered in `src/main.ts`.
**Alternatives considered**: Serving via a Controller using `@Res()`, or using a separate Nginx/Static server.
**Rationale**: NestJS provides a clean integration with Fastify's static plugin. It's lightweight and keeps everything within the same microservice for development purposes.

### Decision: SSE Authentication on Frontend
**Choice**: Use `fetch` API with a `ReadableStream` to handle the SSE stream.
**Alternatives considered**: Native `EventSource`, query parameter authentication.
**Rationale**: Native `EventSource` does not support custom headers (`X-Api-Key`). While we could add query param support to the controller, it's cleaner to keep the API consistent and use a small fetch-based reader in the browser to handle the stream with headers.

## Data Flow
1. Browser requests `http://localhost:3000/qr-test.html`.
2. Server (`@fastify/static`) returns the HTML.
3. User enters API Key in the page and clicks "Connect".
4. Browser JS initiates a `fetch` to `/auth/whatsapp/qr` with `X-Api-Key` header.
5. Server sends SSE events with the QR string.
6. Browser JS parses the stream and uses `qrcode.js` to render the image.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/main.ts` | Modify | Register `@fastify/static` pointing to the `public` folder. |
| `public/qr-test.html` | Create | Simple UI with HTML5, CSS (minimal), and JS to handle the QR flow. |

## Interfaces / Contracts
No changes to existing API contracts. The frontend will use:
- **Endpoint**: `GET /auth/whatsapp/qr` (SSE)
- **Header**: `X-Api-Key: <key>`
- **Response Format**: `{ data: { qr: "string" } }`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | QR Rendering | Open `/qr-test.html`, scan with a phone, and verify connection. |
| Integration | Static Serving | Assert that `GET /qr-test.html` returns 200 and the correct content type. |

## Migration / Rollout
No migration required. This is a developer-facing tool.

## Open Questions
- None.
