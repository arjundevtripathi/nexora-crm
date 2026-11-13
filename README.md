# Nexora CRM

A deployable private CRM with contacts, opportunity stages, follow-up tasks, an INR sales dashboard, CSV export and a server-written activity log. Records persist in Cloudflare D1; this is not a browser-storage demo.

## Stack
React 19 + TypeScript, Vinext, Cloudflare Workers, D1/SQLite, Drizzle migrations, Zod, Lucide. Hosted sign-in and site access are enforced by the Sites platform. All API queries and mutations scope data to the authenticated user ID.

## What is implemented
- Contact creation, editing, search, filtering and deletion
- Deal creation, editing, stage changes and pipeline totals
- Tasks with due dates, priorities and completion
- All-time metrics, newest-record activity, CSV export with formula protection
- Optional explicitly fictional sample data; no automatic seeding
- Authenticated API, strict field validation, same-origin writes, parameterized SQL
- Optimistic version checks for lost-update protection
- Atomic mutation + audit batches; request IDs on unexpected API failures
- Responsive keyboard-accessible forms, retry states, deletion confirmation

This version is a private, per-user CRM. It does **not** implement shared teams, sales-manager roles, invitations, email campaigns, attachments, notifications, SSO beyond platform sign-in, or CRM integrations. Lists return the latest 5,000 records; the UI warns if truncated. Audit shows the latest 50 events. Do not describe this release as enterprise certified or load tested.

## Develop
Requires Node >=22.13 and npm. Use `npm ci` with the committed lockfile. Run `npm run db:generate` after schema changes, review generated SQL, then `npm run build`. Apply pending migrations locally:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dapper_joshua_kane.sql
npm run dev
```

Use the actual SQL filename in `drizzle/`; do not replay applied migrations. The managed preview uses platform authentication. Portable development supports the starter's loopback-only mock sign-in. No production auth bypass is supplied.

## Verify
```sh
node --experimental-strip-types --test tests/validation.test.mjs
node tests/api.test.mjs
npx tsc --noEmit
npm run build
```

See DEPLOYMENT.md for deployment, rollback and operations. Tests cover input validation and a separate SQLite-backed API/tenant-isolation suite. Deployment success does not establish production capacity or security certification.
