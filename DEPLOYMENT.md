# Deployment and operations

## Supported production target
Deploy this project to Sites / Cloudflare Workers with the tracked `.openai/hosting.json`, a `DB` D1 binding and generated Drizzle migrations. Sites provisions the binding and applies schema migrations before publishing. New deployment is private. The platform signs visitors in and injects trusted user identity headers.

Never expose the Worker directly through a route that allows arbitrary clients to forge `oai-authenticated-user-id` and `oai-authenticated-user-email`. This app's identity trust depends on the platform boundary. A different hosting provider requires a real session/OIDC middleware that verifies identity and strips incoming identity headers. It is not enough to set these headers in a public reverse proxy.

1. Install locked dependencies and run validation, TypeScript checks and build.
2. Verify migrations are schema-only and append-only; never modify applied migration history.
3. Push exact source to the project repository and package the matching build.
4. Save and privately deploy the version. Check deployment terminal status.
5. Test sign-in, create/edit/delete of each entity, cross-user access, stale-version handling and export in the target environment before onboarding users.

No application secret is required for the hosted configuration. Never commit credentials. Local database state and environment files are ignored. No mail provider is configured and the app sends no emails.

## Operational readiness before real customer data
- Establish data retention, deletion, access review and privacy policies appropriate to your business.
- Configure alerting for Worker errors, 5xx rates, D1 errors and latency; server errors include request IDs.
- Set platform traffic/rate controls and budget alerts. Per-user application rate limiting is not yet implemented.
- Schedule platform-supported D1 backups/exports and test restoring into an isolated environment. CSV export is not a database backup and excludes history.
- Load-test expected concurrency and data volumes. The 5,000-record UI limit is a release boundary, not a scalability claim.
- Perform a security review including authentication, cross-user isolation, CSRF, stored XSS and CSV formulas.
- Add shared organization memberships/RBAC and paginated endpoints before expanding this release into a team-wide CRM.

## Rollback
Redeploy a previously verified saved version through Sites. Application rollback does not reverse D1 migrations. Use backward-compatible schema migrations; restore database backups only with an explicitly reviewed recovery plan. Test restore and rollback before launch.

## API
`GET /api/crm`: authenticated user's records and latest 50 audit events.
`POST /api/crm`: `{kind, data}` creates a record.
`PATCH /api/crm`: `{kind, id, version, data}` updates the entire record payload.
`DELETE /api/crm`: `{kind, id, version}` deletes a record.
Kinds: `contacts`, `deals`, `tasks`. Writes require same-origin JSON. Responses: 400 validation, 401 no user, 403 bad origin, 409 stale/missing record, 413 body size, 415 content type, 503 database binding unavailable.

Values are INR; no currency conversion. Dates use ISO calendar dates. Sales metrics cover all loaded records, not a fixed reporting period. User ID, not email, owns data; records are isolated even if site access later expands.

## Docker local smoke environment
The included Dockerfile builds a local Worker preview, not a standalone production identity provider. Run only on loopback; it has no sign-in integration outside Sites. Build: `docker build -t nexora-crm .`. Run: `docker run --rm -p 127.0.0.1:8787:8787 nexora-crm`. The root UI is inspectable; protected APIs reject missing identity. Database migrations and durable production storage remain platform-managed. Docker build has not been verified in this session.
