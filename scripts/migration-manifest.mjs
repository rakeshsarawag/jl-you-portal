/**
 * Canonical migration order.
 *
 * This is the only migration list consumed by runners, generators, and
 * verification. Historical pre-consolidation files live outside the active
 * `supabase/migrations` directory.
 */
export const ACTIVE_MIGRATIONS = [
  {
    file: '01_schema.sql',
    description: 'Core schema, tables, indexes, functions, and base RLS',
  },
  {
    file: '02_seed_data.sql',
    description: 'Reference data, lookup values, and idempotent starter data',
  },
  {
    file: '03_platform_services.sql',
    description: 'Notifications, push delivery, analytics anomalies, and reports',
  },
  {
    file: '04_security_and_access.sql',
    description: 'RLS, grants, JWT role claims, and anonymous-access lockdown',
  },
  {
    file: '05_business_extensions.sql',
    description: 'Current business-module extensions and corrective migrations',
  },
];

export const ACTIVE_MIGRATION_FILES = ACTIVE_MIGRATIONS.map(({ file }) => file);
