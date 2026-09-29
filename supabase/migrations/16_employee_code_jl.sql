-- Migration 16: Change employee code format from JSN#### to JL###
-- New format: JL001, JL002, ... JL999, JL1000 (no zero-padding cap)

-- Drop old sequence and recreate starting at 1
DROP SEQUENCE IF EXISTS employee_code_seq CASCADE;
CREATE SEQUENCE employee_code_seq START 1 INCREMENT 1;

-- Sync sequence to current max to avoid collisions with existing rows
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(employee_code, '[^0-9]', '', 'g'),
        ''
      )::INT
    ), 0
  )
  INTO max_num
  FROM employees
  WHERE employee_code IS NOT NULL;

  IF max_num > 0 THEN
    PERFORM setval('employee_code_seq', max_num, true);
  END IF;
END $$;

-- Replace generator function with new JL prefix + zero-padded 3-digit (then 4+)
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.employee_code IS NULL THEN
    next_num := nextval('employee_code_seq');
    -- Zero-pad to at least 3 digits: JL001, JL010, JL100, JL1000 ...
    NEW.employee_code := 'JL' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_employee_code ON employees;
CREATE TRIGGER trg_employee_code
  BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_code();

-- Backfill existing employees that still have JSN-prefixed codes
-- Maps them to JL codes in the same numeric order they were assigned
DO $$
DECLARE
  rec RECORD;
  new_code TEXT;
BEGIN
  FOR rec IN
    SELECT id, employee_code,
           regexp_replace(employee_code, '[^0-9]', '', 'g')::INT AS num
    FROM employees
    WHERE employee_code LIKE 'JSN%'
    ORDER BY num
  LOOP
    new_code := 'JL' || LPAD(rec.num::TEXT, 3, '0');
    -- Avoid collision if target code already exists
    IF NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = new_code AND id <> rec.id) THEN
      UPDATE employees SET employee_code = new_code WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
