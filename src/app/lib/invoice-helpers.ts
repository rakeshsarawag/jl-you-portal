import { CompanySettings, RemittanceSettings } from '../components/apps/MasterData';

const STORAGE_KEY_COMPANY = 'jeshan_company_settings';
const STORAGE_KEY_REMITTANCE = 'jeshan_remittance_settings';

const defaultCompanySettings: CompanySettings = {
  name: 'Jeshan Labs Private Limited',
  address: 'First Floor, 42B, Jaswant Nagar, Khatipura, Jaipur, Rajasthan, India 302012',
  email: 'sales@jeshanlabs.com',
  phone: '+91-9785833383',
  pan: 'AAGCJ067SH',
  gstin: '08AAGCJ0675H1ZG',
  lut: 'AD0802240717077',
  sacCode: '998314',
  serviceDesc: 'Export Software Services',
  invoicePrefix: 'JSN',
  currentInvoiceNumber: 1,
};

const defaultRemittanceSettings: RemittanceSettings = {
  paymentMode: 'RTGS/NEFT',
  beneficiaryName: 'Jeshan Labs Private Limited',
  accountNo: '50200088542754',
  bankName: 'HDFC BANK LIMITED',
  bankAddress: 'Vaishali Nagar, Jaipur',
  swift: 'HDFCINBB',
  ifsc: 'HDFC0000545',
};

export function getCompanySettings(): CompanySettings {
  const saved = localStorage.getItem(STORAGE_KEY_COMPANY);
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(defaultCompanySettings));
  return defaultCompanySettings;
}

export function getRemittanceSettings(): RemittanceSettings {
  const saved = localStorage.getItem(STORAGE_KEY_REMITTANCE);
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem(STORAGE_KEY_REMITTANCE, JSON.stringify(defaultRemittanceSettings));
  return defaultRemittanceSettings;
}

export function generateNextInvoiceNumber(): string {
  const settings = getCompanySettings();
  const invoiceNumber = `${settings.invoicePrefix}${String(settings.currentInvoiceNumber).padStart(4, '0')}`;
  
  // Increment for next time
  const newSettings = {
    ...settings,
    currentInvoiceNumber: settings.currentInvoiceNumber + 1,
  };
  localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(newSettings));
  
  return invoiceNumber;
}

export function saveCompanySettings(settings: CompanySettings): void {
  localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(settings));
}

export function saveRemittanceSettings(settings: RemittanceSettings): void {
  localStorage.setItem(STORAGE_KEY_REMITTANCE, JSON.stringify(settings));
}
