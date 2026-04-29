# Tasks: QR Test Page

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Modify `src/main.ts` to register `@fastify/static` plugin.
- [x] 1.2 Configure `@fastify/static` to serve files from a new `public` directory.
- [x] 1.3 Create the `public` directory in the project root.

## Phase 2: Core Implementation

- [x] 2.1 Create `public/qr-test.html` with a basic UI (API Key input, Connect button, QR container, Log area).
- [x] 2.2 Implement browser-side JS to handle SSE connection using `fetch` and `ReadableStream` (to support `X-Api-Key` header).
- [x] 2.3 Integrate `qrcode.js` (via CDN) in the HTML to render the QR string into an image.
- [x] 2.4 Implement status monitoring logic in the frontend to show "CONNECTED" state.

## Phase 3: Testing / Verification

- [ ] 3.1 Verify static serving: Navigate to `http://localhost:3000/qr-test.html` and ensure page loads.
- [ ] 3.2 Verify SSE link: Connect using a valid API Key and check console/log for incoming QR events.
- [ ] 3.3 Verify QR rendering: Ensure the QR string is converted into a scannable image.
- [ ] 3.4 Verify status feedback: Link a phone and confirm the UI reflects the "CONNECTED" status.
