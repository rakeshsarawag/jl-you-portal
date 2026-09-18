import { useState, useRef, useEffect } from "react";
import { useEmployeeOptions } from "../../hooks/useSharedData";

interface EmployeeSearchDropdownProps {
  value: string;
  onChange: (name: string, id?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Filter function to exclude specific employees */
  filter?: (emp: { value: string; label: string; email?: string }) => boolean;
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

  // Close dropdown on outside click
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

  const displayValue = search || value;

  const filtered = options.filter((emp) => {
    if (filter && !filter(emp)) return false;
    if (!search) return true;
    return (
      emp.label?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!e.target.value) onChange("", undefined);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? "Loading…" : placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-[200] mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              {loading ? "Loading employees…" : "No employees found"}
            </div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.value}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0 flex items-center gap-2 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(emp.label, emp.value);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="font-medium text-foreground truncate flex-1">{emp.label}</span>
                {emp.employeeCode && (
                  <span className="text-xs text-muted-foreground shrink-0 font-mono">{emp.employeeCode}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
