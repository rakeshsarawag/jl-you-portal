/**
 * EmployeeSearchDropdown — shared searchable employee picker.
 * Shows "Name · JL001" in the option list and input after selection.
 * Fix display logic here once; all consumers benefit automatically.
 */
import { useState, useRef, useEffect } from "react";
import { useEmployeeOptions } from "../../hooks/useSharedData";

interface EmployeeOption {
  value: string;
  label: string;
  displayLabel: string;
  employeeCode: string;
  email?: string;
  department?: string;
  jobTitle?: string;
}

interface EmployeeSearchDropdownProps {
  value: string;
  onChange: (name: string, id?: string, employeeCode?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filter?: (emp: EmployeeOption) => boolean;
}

export default function EmployeeSearchDropdown({
  value,
  onChange,
  placeholder = "Search employee…",
  disabled = false,
  className = "",
  filter,
}: EmployeeSearchDropdownProps) {
  const { options, loading } = useEmployeeOptions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // When not actively searching, show the selected displayLabel (includes code)
  // When searching, show the search query
  const selectedOpt = options.find((o) => o.label === value || o.value === value);
  const inputDisplayValue = search
    ? search
    : selectedOpt?.displayLabel ?? value;

  const filtered = options.filter((emp) => {
    if (filter && !filter(emp)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.label?.toLowerCase().includes(q) ||
      emp.employeeCode?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  function handleSelect(emp: EmployeeOption) {
    onChange(emp.label, emp.value, emp.employeeCode);
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        value={inputDisplayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!e.target.value) onChange("", undefined, undefined);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? "Loading…" : placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      {open && (
        <div className="absolute z-[200] mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              {loading ? "Loading employees…" : "No employees found"}
            </div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.value}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0 flex items-start gap-2 transition-colors group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(emp);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{emp.label}</span>
                    {emp.employeeCode && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        {emp.employeeCode}
                      </span>
                    )}
                  </div>
                  {(emp.department || emp.jobTitle) && (
                    <span className="text-xs text-muted-foreground truncate block mt-0.5">
                      {[emp.department, emp.jobTitle].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
