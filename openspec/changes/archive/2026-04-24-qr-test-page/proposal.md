# Proposal: QR Test Page

## Intent
Provide a simple, interactive frontend page to verify the WhatsApp QR code generation and rendering. This facilitates manual testing and demonstration of the notification service's WhatsApp authentication flow without needing a full frontend integration.

## Scope

### In Scope
- Enable static file serving in the NestJS/Fastify application.
- Create a `public/qr-test.html` page.
- Implement client-side logic to connect to the SSE `/auth/whatsapp/qr` endpoint.
- Render the QR code using a browser-compatible library (e.g., `qrcode.js`).
- Add basic UI for connection status and log output.

### Out of Scope
- Full multi-user authentication UI.
- Permanent frontend hosting (it's for local/dev testing).
- Persistent storage of the test page beyond the repository.

## Capabilities

### New Capabilities
- `qr-auth-ui`: A static UI for viewing and scanning the WhatsApp QR code.

### Modified Capabilities
- None

## Approach
Configure `@fastify/static` to serve files from a `public` directory. The test page will use the `X-Api-Key` header (provided via an input field or hardcoded for dev) to authenticate with the existing SSE endpoint. Since native `EventSource` doesn't support headers, we'll use a `fetch`-based SSE reader or a polyfill.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/main.ts` | Modified | Register `@fastify/static`. |
| `public/qr-test.html` | New | Static test page. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Security exposure | Low | Ensure static serving is only active or restricted in production. |
| CORS issues | Low | CORS is already enabled for `*` in `main.ts`. |

## Rollback Plan
Remove the `@fastify/static` registration in `src/main.ts` and delete the `public/` directory.

## Dependencies
- `@fastify/static` (already in `package.json`).
- `qrcode.js` (loaded via CDN in the HTML).

## Success Criteria
- [ ] Navigating to `/qr-test.html` renders the test page.
- [ ] Entering a valid API key and connecting shows the QR code string in the log.
- [ ] The QR code is rendered as a scannable image on the page.
- [ ] Connection status changes to "Connected" when WhatsApp links.
