# Canonical Supabase migrations

The active database setup is intentionally limited to five ordered SQL files.
`scripts/migration-manifest.mjs` is the single source of truth used by the
migration runner, SQL bundle generator, and verification command.

| Order | File | Responsibility |
|---|---|---|
| 1 | `01_schema.sql` | Core schema, tables, indexes, functions, and base RLS |
| 2 | `02_seed_data.sql` | Reference data, lookup values, and starter records |
| 3 | `03_platform_services.sql` | Notifications, push delivery, analytics anomalies, and reports |
| 4 | `04_security_and_access.sql` | RLS, grants, JWT role claims, and anonymous-access lockdown |
| 5 | `05_business_extensions.sql` | Current module extensions, identifiers, and compatibility corrections |

`run-all.sql` is generated output. Do not edit it manually.

## Commands

```bash
# Verify the active file list and common idempotency requirements
pnpm verify:migrations

# Regenerate the deterministic combined SQL bundle
pnpm generate:sql

# Execute the canonical files through the project migration endpoint
pnpm migrate:all
```

## Re-run safety

Every canonical file must be safe to run more than once:

- Tables, columns, indexes, and sequences use existence guards.
- Triggers are dropped before recreation or created inside duplicate guards.
- Policies are dropped before recreation or checked through `pg_policies`.
- Constraints are dropped/replaced or checked through `pg_constraint`.
- Static seed rows use `ON CONFLICT`, deterministic delete-and-reinsert, or
  `NOT EXISTS`.
- Notification/backfill inserts include a stable duplicate check.
- Destructive compatibility changes use `IF EXISTS`.

Run `pnpm verify:migrations` after every database change. It also confirms that
`run-all.sql` matches the canonical files.

## Adding a database change

Add the change to the file that owns the affected concern:

- General tables/functions: `01_schema.sql`
- Reference or starter data: `02_seed_data.sql`
- Notifications/analytics platform services: `03_platform_services.sql`
- RLS, grants, auth claims, or access lockdown: `04_security_and_access.sql`
- Module-specific extensions and compatibility updates:
  `05_business_extensions.sql`

Use a clearly titled section and make the SQL idempotent. Do not add another
numbered file without first updating this ownership model and
`scripts/migration-manifest.mjs`.

## Legacy history

The original pre-consolidation files are preserved under
`supabase/migration_history/legacy/` for audit and archaeology. They are not
part of the active migration path and must not be executed in addition to the
canonical files.
