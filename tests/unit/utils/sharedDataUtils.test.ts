import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helper functions extracted from useEmployeeOptions in useSharedData.ts
// ---------------------------------------------------------------------------

function extractFullName(emp: any): string {
  return emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
}

function buildDisplayLabel(fullName: string, employeeCode: string | undefined): string {
  return employeeCode ? `${fullName} · ${employeeCode}` : fullName;
}

function buildEmployeeOption(emp: any): {
  value: string;
  label: string;
  displayLabel: string;
  employeeCode: string;
  email: string;
  department: string;
  jobTitle: string;
} {
  const fullName = extractFullName(emp);
  const jobTitle = emp.designation || emp.position || emp.jobTitle || emp.title || '';
  const employeeCode = emp.employee_code || emp.employeeCode || '';
  return {
    value: emp.id,
    label: fullName,
    displayLabel: buildDisplayLabel(fullName, employeeCode),
    employeeCode,
    email: emp.email,
    department: emp.department,
    jobTitle,
  };
}

// ---------------------------------------------------------------------------
// extractFullName
// ---------------------------------------------------------------------------
describe('extractFullName', () => {
  it('prefers emp.name when present', () => {
    expect(extractFullName({ name: 'Alice Smith', firstName: 'Alice', lastName: 'Smith' })).toBe('Alice Smith');
  });

  it('falls back to firstName + lastName when name is absent', () => {
    expect(extractFullName({ firstName: 'Bob', lastName: 'Jones' })).toBe('Bob Jones');
  });

  it('uses only firstName when lastName is missing', () => {
    expect(extractFullName({ firstName: 'Carol' })).toBe('Carol');
  });

  it('uses only lastName when firstName is missing', () => {
    expect(extractFullName({ lastName: 'Doe' })).toBe('Doe');
  });

  it('returns empty string when all name fields are absent', () => {
    expect(extractFullName({})).toBe('');
  });

  it('trims extra whitespace from firstName + lastName concatenation', () => {
    expect(extractFullName({ firstName: 'Dan', lastName: '' })).toBe('Dan');
  });
});

// ---------------------------------------------------------------------------
// buildDisplayLabel
// ---------------------------------------------------------------------------
describe('buildDisplayLabel', () => {
  it('formats as "Name · Code" when code is present', () => {
    expect(buildDisplayLabel('Alice Smith', 'JL001')).toBe('Alice Smith · JL001');
  });

  it('returns just the name when code is undefined', () => {
    expect(buildDisplayLabel('Alice Smith', undefined)).toBe('Alice Smith');
  });

  it('returns just the name when code is an empty string', () => {
    expect(buildDisplayLabel('Alice Smith', '')).toBe('Alice Smith');
  });

  it('uses the middle-dot separator (·) not a dash', () => {
    const result = buildDisplayLabel('Test User', 'EMP999');
    expect(result).toContain('·');
    expect(result).not.toContain('-');
  });

  it('works with numeric-looking codes', () => {
    expect(buildDisplayLabel('John Doe', '12345')).toBe('John Doe · 12345');
  });
});

// ---------------------------------------------------------------------------
// buildEmployeeOption
// ---------------------------------------------------------------------------
describe('buildEmployeeOption', () => {
  const baseEmp = {
    id: 'emp-1',
    name: 'Alice Smith',
    employee_code: 'JL001',
    email: 'alice@example.com',
    department: 'Engineering',
    jobTitle: 'Engineer',
  };

  it('maps id to value', () => {
    expect(buildEmployeeOption(baseEmp).value).toBe('emp-1');
  });

  it('maps full name to label', () => {
    expect(buildEmployeeOption(baseEmp).label).toBe('Alice Smith');
  });

  it('builds displayLabel with code separator', () => {
    expect(buildEmployeeOption(baseEmp).displayLabel).toBe('Alice Smith · JL001');
  });

  it('reads employeeCode from snake_case employee_code field', () => {
    expect(buildEmployeeOption(baseEmp).employeeCode).toBe('JL001');
  });

  it('reads employeeCode from camelCase employeeCode field', () => {
    const emp = { ...baseEmp, employee_code: undefined, employeeCode: 'CC002' };
    expect(buildEmployeeOption(emp).employeeCode).toBe('CC002');
  });

  it('prefers employee_code over employeeCode when both present', () => {
    const emp = { ...baseEmp, employeeCode: 'CAMEL', employee_code: 'SNAKE' };
    expect(buildEmployeeOption(emp).employeeCode).toBe('SNAKE');
  });

  it('displayLabel is just the name when employeeCode is absent', () => {
    const emp = { id: 'emp-2', name: 'Bob Brown', email: 'bob@example.com', department: 'HR', jobTitle: 'Recruiter' };
    expect(buildEmployeeOption(emp).displayLabel).toBe('Bob Brown');
  });

  it('resolves jobTitle from designation field', () => {
    const emp = { ...baseEmp, jobTitle: undefined, designation: 'Senior Dev' };
    expect(buildEmployeeOption(emp).jobTitle).toBe('Senior Dev');
  });

  it('resolves jobTitle from position field as second fallback', () => {
    const emp = { ...baseEmp, jobTitle: undefined, designation: undefined, position: 'Lead' };
    expect(buildEmployeeOption(emp).jobTitle).toBe('Lead');
  });

  it('resolves jobTitle from title field as third fallback', () => {
    const emp = { ...baseEmp, jobTitle: undefined, designation: undefined, position: undefined, title: 'CTO' };
    expect(buildEmployeeOption(emp).jobTitle).toBe('CTO');
  });

  it('jobTitle is empty string when all title fields are missing', () => {
    const emp = { id: 'emp-3', name: 'No Title', email: 'x@x.com', department: 'Ops' };
    expect(buildEmployeeOption(emp).jobTitle).toBe('');
  });

  it('maps email and department correctly', () => {
    const opt = buildEmployeeOption(baseEmp);
    expect(opt.email).toBe('alice@example.com');
    expect(opt.department).toBe('Engineering');
  });

  it('handles employee with firstName + lastName instead of name', () => {
    const emp = {
      id: 'emp-4',
      firstName: 'Carol',
      lastName: 'White',
      employee_code: 'CW003',
      email: 'carol@example.com',
      department: 'Finance',
      jobTitle: 'Accountant',
    };
    const opt = buildEmployeeOption(emp);
    expect(opt.label).toBe('Carol White');
    expect(opt.displayLabel).toBe('Carol White · CW003');
  });

  it('all fields missing produces safe empty defaults', () => {
    const opt = buildEmployeeOption({ id: 'emp-5' });
    expect(opt.value).toBe('emp-5');
    expect(opt.label).toBe('');
    expect(opt.displayLabel).toBe('');
    expect(opt.employeeCode).toBe('');
    expect(opt.jobTitle).toBe('');
  });

  it('maps multiple employees correctly', () => {
    const emps = [
      { id: 'a', name: 'Alpha', employee_code: 'A1', email: 'a@x.com', department: 'Eng', jobTitle: 'Dev' },
      { id: 'b', name: 'Beta', employee_code: 'B2', email: 'b@x.com', department: 'HR', jobTitle: 'Mgr' },
    ];
    const opts = emps.map(buildEmployeeOption);
    expect(opts[0].displayLabel).toBe('Alpha · A1');
    expect(opts[1].displayLabel).toBe('Beta · B2');
    expect(opts[0].value).toBe('a');
    expect(opts[1].value).toBe('b');
  });
});
