# Fieldnote Inbox

React + TypeScript staff inbox for the WhatsApp LMS FastAPI backend.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `API_STAFF_KEY` to the backend's `STAFF_API_KEY`. Set `API_AUTHENTICATED_STAFF_ID` to a local caregiver ID for development. These values are read only by the Vite development server and are never exposed to browser code. Do not use a `VITE_` prefix for secrets.
3. Make sure the backend is running at `API_PROXY_TARGET` and MySQL is available.
4. Run `npm run dev` and open the URL printed by Vite.

The development server proxies `/api` and `/health` to FastAPI. Conversations refresh every 10 seconds and the selected thread refreshes every 5 seconds. Replies and internal notes use the existing backend routes. The inbox's **Transfer** control is beside the selected customer's chat header and asks for the target caregiver ID.

For production, the authenticated LMS/proxy must inject `X-Authenticated-Staff-ID` from the signed-in staff session and must strip any client-supplied header with that name. Never rely on the local Vite identity setting in a shared or production deployment.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
