# Pikipata WhatsApp Inbox

React staff inbox for the WhatsApp LMS backend.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `API_STAFF_KEY` to the backend's `STAFF_API_KEY`.
4. Set `API_AUTHENTICATED_STAFF_ID` to a local caregiver ID. This is only for single-user development.
5. Set `API_PROXY_TARGET` to the backend URL, then run `npm run dev`.

The Vite server proxies `/api` and `/health`. It injects the API key and local caregiver ID server-side; neither value is exposed to browser code.

## Production

Serve the frontend behind the authenticated LMS proxy. The proxy must authenticate the caregiver, remove any incoming `X-Authenticated-Staff-ID` header, then set it from the trusted LMS session. Never use the fixed local development ID or expose `API_STAFF_KEY` in a production browser.
