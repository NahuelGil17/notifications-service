# QR Auth UI Specification

## Purpose
Define the requirements for a static test page that allows developers to visualize and test the WhatsApp QR code authentication flow.

## Requirements

### Requirement: Static Asset Serving
The system MUST provide a way to serve static HTML files from a designated public directory.

#### Scenario: Accessing the test page
- GIVEN the server is running
- AND a file `public/qr-test.html` exists
- WHEN a user navigates to `http://localhost:{port}/qr-test.html`
- THEN the system MUST return the content of the HTML file with a 200 OK status.

### Requirement: QR Code Rendering
The test page MUST connect to the WhatsApp QR SSE endpoint and render the received string as a scannable QR image.

#### Scenario: Successful QR rendering
- GIVEN the test page is open in the browser
- AND a valid X-Api-Key is provided
- WHEN the user clicks "Connect"
- THEN the page MUST open an SSE connection to `/auth/whatsapp/qr`
- AND upon receiving a message, it MUST render a QR code image.

### Requirement: Connection Status Feedback
The test page SHOULD display the current connection status of the WhatsApp service.

#### Scenario: Monitoring status
- GIVEN the test page is open
- WHEN the WhatsApp service status changes to "CONNECTED"
- THEN the test page SHOULD update the UI to reflect the successful link.
