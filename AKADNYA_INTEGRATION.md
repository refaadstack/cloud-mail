# Akadnya.com — Cloud-mail integration

This file documents the changes made to the `cloud-mail` worker to add
`akadnya.com` as a second domain. After deploying, both `mail.refaadstack.com`
and `mail.akadnya.com` route to the same Cloudflare Worker.

## Changes made

### `mail-worker/wrangler.toml`
- Added `akadnya.com` to the `domain` env var array
- Added second `[[routes]]` block for `mail.akadnya.com`

### `mail-worker/wrangler-action.toml`
- Added second `[[routes]]` block using new `${CUSTOM_DOMAIN_AKADNYA}` placeholder
- This is the template used by the GitHub Actions workflow

### `.github/workflows/deploy-cloudflare.yml`
- Added `CUSTOM_DOMAIN_AKADNYA` env var (default: `mail.akadnya.com`)
- Added `DOMAIN` default fallback: `["refaadstack.com","akadnya.com"]`
- Updated sed-replace logic to substitute the new placeholder
- Updated route removal logic to handle partial-empty cases (only delete
  the akadnya route if `CUSTOM_DOMAIN_AKADNYA` is empty, otherwise keep it)

## Cloudflare Email Routing — required setup

After deploying the worker, configure Email Routing in the Cloudflare
dashboard for `akadnya.com`:

1. Email → Email Routing → Enable (if not already)
2. Add a catch-all route:
   - Action: **Send to a Worker**
   - Worker: `cloud-mail`
3. Verify MX records are set to Cloudflare (auto-managed)
4. Add SPF record:
   ```
   akadnya.com  TXT  "v=spf1 include:_spf.mx.cloudflare.net ~all"
   ```

## User signup

Once deployed, users can sign up at `https://mail.akadnya.com` (the same
worker serves both URLs). Sign-up requires:
- `admin@akadnya.com` must be a pre-created account in the D1 DB (set
  via the existing admin panel at `mail.refaadstack.com`)
- Or the user can be created manually in the database

## Email sending

Outbound email from Laravel continues to use:
```
MAIL_MAILER=brevo
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
```

The cloud-mail worker receives inbound mail only. Outbound can be handled
by the worker's built-in `send_email` binding or kept via Laravel's
existing Brevo SMTP.

## Per-domain admin (2026-09-15)

`admin@akadnya.com` is a domain admin for `akadnya.com` only; `admin@refaadstack.com`
remains global superadmin.

- `mail-worker/wrangler.toml` `[vars]`: `admins = '{"akadnya.com":"admin@akadnya.com"}'`
- Helper: `mail-worker/src/utils/admin-utils.js` (`isAdmin`, `adminDomains`, `assertCanManage`)
- `/user/list`, `/allEmail/list`, `/allEmail/latest` are scoped to the caller's
  administered domain(s). Mutations (`setPwd`, `setStatus`, `add`, `resetSendCount`,
  `restore`, `physicsDelete`) reject cross-domain targets with 403.
- UI role `Akadnya Admin` (granted via `/role/add` by superadmin): perms
  `email:delete/send`, `user:query/add/set-pwd/set-status/reset-send`,
  `account:query/add`, `all-email:query`. Deliberately NO `role:*`, `setting:*`,
  `user:delete`, `user:set-type`, `all-email:delete` — those stay superadmin-only.
- Menus (`/all-users`, `/all-mail`) appear automatically via perm-driven routing;
  no frontend rebuild needed for perm changes.
- CI: `wrangler-action.toml` uses `admins = "${ADMINS}"`; the deploy workflow
  requires repo variable/secret `ADMINS` (JSON object, default `'{}'`).
  Push without it wipes the mapping on next CI deploy.
