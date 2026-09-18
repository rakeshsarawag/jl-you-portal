export const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Overdue", "Cancelled"] as const;
export const INVOICE_NUMBER_PREFIX = "JSN";
export const DEFAULT_CURRENCY = "INR";
export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;
export const DEFAULT_TAX_RATE = 18; // GST %
export const PAYMENT_TERMS = ["Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Immediate"] as const;
export const LINE_ITEM_UNITS = ["Hours", "Days", "Units", "Months", "Fixed"] as const;
