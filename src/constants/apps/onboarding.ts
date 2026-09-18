export const ONBOARDING_STATUSES = ["Pending", "In Progress", "Completed", "On Hold"] as const;

export const ONBOARDING_DEFAULT_TASKS = [
  "Complete personal information form",
  "Submit identity documents",
  "Sign employment contract",
  "Set up company email",
  "Complete IT equipment request",
  "Watch company orientation video",
  "Meet the team",
  "Complete compliance training",
] as const;

export const DOCUMENT_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Resume",
  "Offer Letter",
  "Experience Letter",
  "Educational Certificates",
  "Address Proof",
] as const;

export const WELCOME_KIT_ITEMS = [
  "Laptop",
  "Mouse",
  "Keyboard",
  "ID Card",
  "Access Card",
  "Welcome Letter",
  "Stationery Kit",
] as const;
