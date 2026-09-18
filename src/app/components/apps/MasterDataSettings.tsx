import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { CompanySettings, RemittanceSettings } from './MasterData';

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
  currentInvoiceNumber: 61,
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

export function CompanySettingsForm() {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_COMPANY);
    if (saved) {
      return JSON.parse(saved);
    }
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(defaultCompanySettings));
    return defaultCompanySettings;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(settings));
    toast.success('Company settings saved successfully!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company & Registration Settings</CardTitle>
        <CardDescription>Manage your company details and GST registration information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyAddress">Company Address *</Label>
                <Textarea
                  id="companyAddress"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email *</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone *</Label>
                <Input
                  id="companyPhone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4">GST Registration Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pan">PAN *</Label>
                <Input
                  id="pan"
                  value={settings.pan}
                  onChange={(e) => setSettings({ ...settings, pan: e.target.value })}
                  placeholder="AAGCJ067SH"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN *</Label>
                <Input
                  id="gstin"
                  value={settings.gstin}
                  onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                  placeholder="08AAGCJ0675H1ZG"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lut">LUT Number *</Label>
                <Input
                  id="lut"
                  value={settings.lut}
                  onChange={(e) => setSettings({ ...settings, lut: e.target.value })}
                  placeholder="AD0802240717077"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sacCode">SAC Code *</Label>
                <Input
                  id="sacCode"
                  value={settings.sacCode}
                  onChange={(e) => setSettings({ ...settings, sacCode: e.target.value })}
                  placeholder="998314"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="serviceDesc">Service Description *</Label>
                <Input
                  id="serviceDesc"
                  value={settings.serviceDesc}
                  onChange={(e) => setSettings({ ...settings, serviceDesc: e.target.value })}
                  placeholder="Export Software Services"
                  required
                />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Invoice Number Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Prefix *</Label>
                <Input
                  id="invoicePrefix"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  placeholder="JSN"
                  required
                />
                <p className="text-xs text-gray-500">Example: JSN will generate JSN0061, JSN0062, etc.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentInvoiceNumber">Next Invoice Number *</Label>
                <Input
                  id="currentInvoiceNumber"
                  type="number"
                  value={settings.currentInvoiceNumber}
                  onChange={(e) => setSettings({ ...settings, currentInvoiceNumber: parseInt(e.target.value) || 1 })}
                  min="1"
                  required
                />
                <p className="text-xs text-gray-500">Current: {settings.invoicePrefix}{String(settings.currentInvoiceNumber).padStart(4, '0')}</p>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Company Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function RemittanceSettingsForm() {
  const [settings, setSettings] = useState<RemittanceSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_REMITTANCE);
    if (saved) {
      return JSON.parse(saved);
    }
    localStorage.setItem(STORAGE_KEY_REMITTANCE, JSON.stringify(defaultRemittanceSettings));
    return defaultRemittanceSettings;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY_REMITTANCE, JSON.stringify(settings));
    toast.success('Remittance settings saved successfully!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remittance & Bank Details</CardTitle>
        <CardDescription>Manage your bank account information for invoice payments</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMode">Payment Mode *</Label>
              <Input
                id="paymentMode"
                value={settings.paymentMode}
                onChange={(e) => setSettings({ ...settings, paymentMode: e.target.value })}
                placeholder="RTGS/NEFT"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="beneficiaryName">Beneficiary Name *</Label>
              <Input
                id="beneficiaryName"
                value={settings.beneficiaryName}
                onChange={(e) => setSettings({ ...settings, beneficiaryName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNo">Account Number *</Label>
              <Input
                id="accountNo"
                value={settings.accountNo}
                onChange={(e) => setSettings({ ...settings, accountNo: e.target.value })}
                placeholder="50200088542754"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name *</Label>
              <Input
                id="bankName"
                value={settings.bankName}
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                placeholder="HDFC BANK LIMITED"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAddress">Bank Address *</Label>
              <Input
                id="bankAddress"
                value={settings.bankAddress}
                onChange={(e) => setSettings({ ...settings, bankAddress: e.target.value })}
                placeholder="Vaishali Nagar, Jaipur"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swift">SWIFT Code *</Label>
              <Input
                id="swift"
                value={settings.swift}
                onChange={(e) => setSettings({ ...settings, swift: e.target.value })}
                placeholder="HDFCINBB"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifsc">IFSC Code *</Label>
              <Input
                id="ifsc"
                value={settings.ifsc}
                onChange={(e) => setSettings({ ...settings, ifsc: e.target.value })}
                placeholder="HDFC0000545"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Remittance Details
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
