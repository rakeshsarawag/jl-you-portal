-- Workflow automation contract and trace hardening.
-- Safe to run repeatedly after 01_schema.sql and 02_seed_data.sql.

-- Older bundled workflows use the pre-builder node format (`next`, root-level
-- approval config, and trigger names in trigger_type). Keep them available for
-- reference, but do not leave definitions active when the executor cannot run
-- them safely. The mounted API can seed compatible replacements.
UPDATE workflow_definitions
SET
  status = 'paused',
  updated_at = NOW()
WHERE status = 'active'
  AND (
    trigger_type NOT IN ('manual', 'event', 'scheduled')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(nodes, '[]'::jsonb)) AS node
      WHERE node ? 'next'
        AND NOT node ? 'connections'
    )
  );

-- Install a small, fully executable starter set. These definitions deliberately
-- use only node types supported by the durable executor.
INSERT INTO workflow_definitions (
  name,
  description,
  status,
  trigger_type,
  trigger_config,
  nodes,
  version,
  is_template,
  category,
  tags
) VALUES
(
  'Leave Request Approval',
  'Routes a submitted leave request to a manager for approval.',
  'active',
  'event',
  '{"event_key":"leave_applied"}'::jsonb,
  '[
    {"id":"leave-start","type":"trigger","label":"Leave submitted","config":{},"position":{"x":100,"y":160},"connections":["leave-notify"]},
    {"id":"leave-notify","type":"notification","label":"Notify managers","config":{"recipients_role":"manager","title":"Leave request pending","message":"A leave request requires review.","link":"/workflow-dashboard"},"position":{"x":320,"y":160},"connections":["leave-approval"]},
    {"id":"leave-approval","type":"approval","label":"Manager approval","config":{"approver_role":"manager","step_name":"Manager approval"},"position":{"x":540,"y":160},"connections":["leave-end"]},
    {"id":"leave-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'HR',
  '["default"]'::jsonb
),
(
  'Payroll Run Approval',
  'Routes an initiated payroll run to Finance for approval.',
  'active',
  'event',
  '{"event_key":"payroll_run_initiated"}'::jsonb,
  '[
    {"id":"payroll-start","type":"trigger","label":"Payroll initiated","config":{},"position":{"x":100,"y":160},"connections":["payroll-notify"]},
    {"id":"payroll-notify","type":"notification","label":"Notify Finance","config":{"recipients_role":"finance","title":"Payroll approval required","message":"A payroll run requires approval.","link":"/workflow-dashboard"},"position":{"x":320,"y":160},"connections":["payroll-approval"]},
    {"id":"payroll-approval","type":"approval","label":"Finance approval","config":{"approver_role":"finance","step_name":"Finance approval"},"position":{"x":540,"y":160},"connections":["payroll-end"]},
    {"id":"payroll-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'Finance',
  '["default"]'::jsonb
),
(
  'Onboarding Team Notification',
  'Notifies HR and IT when an onboarding record is started.',
  'active',
  'event',
  '{"event_key":"onboarding_started"}'::jsonb,
  '[
    {"id":"onboarding-start","type":"trigger","label":"Onboarding started","config":{},"position":{"x":100,"y":160},"connections":["onboarding-it"]},
    {"id":"onboarding-it","type":"notification","label":"Notify IT","config":{"recipients_role":"it","title":"New onboarding started","message":"Please prepare access and equipment.","link":"/onboarding"},"position":{"x":320,"y":100},"connections":["onboarding-hr"]},
    {"id":"onboarding-hr","type":"notification","label":"Notify HR","config":{"recipients_role":"hr","title":"Onboarding workflow started","message":"A new employee onboarding record has been created.","link":"/onboarding"},"position":{"x":540,"y":220},"connections":["onboarding-end"]},
    {"id":"onboarding-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'HR',
  '["default"]'::jsonb
)
ON CONFLICT (lower(name)) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wf_definitions_trigger
  ON workflow_definitions (status, trigger_type);

CREATE INDEX IF NOT EXISTS idx_wf_instances_definition_started
  ON workflow_instances (definition_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_wf_instance_steps_status
  ON workflow_instance_steps (instance_id, status);

-- The original gap migration intentionally omitted the foreign key. Add it
-- only when it is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_instance_steps_instance_id_fkey'
  ) THEN
    ALTER TABLE workflow_instance_steps
      ADD CONSTRAINT workflow_instance_steps_instance_id_fkey
      FOREIGN KEY (instance_id)
      REFERENCES workflow_instances(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;
