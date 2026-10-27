-- Align invoices with the current clients table and persist all create-form fields.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_from DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_to DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Preserve legacy invoice rows by clearing only IDs that have no modern client match.
-- client_name remains available on those historical invoices.
UPDATE invoices
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.id = invoices.client_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
