/**
 * Invoice Master Data Manager
 * Manages Bill To, Registration Details, and Remittance Details
 */

import { useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Edit2, Trash2, Save, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceData, BillToItem, RegistrationItem, RemittanceItem, DescriptionItem } from '../../hooks/useInvoiceData';
import { seedInvoiceData } from '../../utils/seedInvoiceData';
import { SelectOptions } from '../../context/ValueHelpsContext';

export function InvoiceMasterDataManager() {
  const {
    billToList,
    registrationList,
    remittanceList,
    descriptionList,
    createBillTo,
    updateBillTo,
    deleteBillTo,
    createRegistration,
    updateRegistration,
    deleteRegistration,
    createRemittance,
    updateRemittance,
    deleteRemittance,
    createDescription,
    updateDescription,
    deleteDescription,
  } = useInvoiceData();

  const [activeTab, setActiveTab] = useState<'billto' | 'registration' | 'remittance' | 'descriptions'>('billto');
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);

  // Bill To Form State
  const [billToForm, setBillToForm] = useState<Partial<BillToItem>>({});
  const [editingBillTo, setEditingBillTo] = useState<string | null>(null);
  const [showBillToForm, setShowBillToForm] = useState(false);

  // Registration Form State
  const [registrationForm, setRegistrationForm] = useState<Partial<RegistrationItem>>({});
  const [editingRegistration, setEditingRegistration] = useState<string | null>(null);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);

  // Remittance Form State
  const [remittanceForm, setRemittanceForm] = useState<Partial<RemittanceItem>>({});
  const [editingRemittance, setEditingRemittance] = useState<string | null>(null);
  const [showRemittanceForm, setShowRemittanceForm] = useState(false);

  // Description Form State
  const [descriptionForm, setDescriptionForm] = useState<Partial<DescriptionItem>>({});
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [showDescriptionForm, setShowDescriptionForm] = useState(false);

  // Bill To Handlers
  const handleSaveBillTo = async () => {
    try {
      if (!billToForm.name || !billToForm.address) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (editingBillTo) {
        await updateBillTo(editingBillTo, billToForm);
        toast.success('Bill To updated successfully');
      } else {
        await createBillTo(billToForm);
        toast.success('Bill To created successfully');
      }

      setBillToForm({});
      setEditingBillTo(null);
      setShowBillToForm(false);
    } catch (error) {
      toast.error('Failed to save Bill To');
    }
  };

  const handleEditBillTo = (item: BillToItem) => {
    setBillToForm(item);
    setEditingBillTo(item.id);
    setShowBillToForm(true);
  };

  const handleDeleteBillTo = (id: string) => {
    setConfirmState({ title: 'Delete Bill To', message: 'Are you sure you want to delete this Bill To entry?', danger: true, action: async () => { setConfirmState(null); try { await deleteBillTo(id); toast.success('Bill To deleted successfully'); } catch { toast.error('Failed to delete Bill To'); } } });
  };

  const handleCancelBillTo = () => {
    setBillToForm({});
    setEditingBillTo(null);
    setShowBillToForm(false);
  };

  // Registration Handlers
  const handleSaveRegistration = async () => {
    try {
      if (!registrationForm.name || !registrationForm.details) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (editingRegistration) {
        await updateRegistration(editingRegistration, registrationForm);
        toast.success('Registration updated successfully');
      } else {
        await createRegistration(registrationForm);
        toast.success('Registration created successfully');
      }

      setRegistrationForm({});
      setEditingRegistration(null);
      setShowRegistrationForm(false);
    } catch (error) {
      toast.error('Failed to save Registration');
    }
  };

  const handleEditRegistration = (item: RegistrationItem) => {
    setRegistrationForm(item);
    setEditingRegistration(item.id);
    setShowRegistrationForm(true);
  };

  const handleDeleteRegistration = (id: string) => {
    setConfirmState({ title: 'Delete Registration', message: 'Are you sure you want to delete this Registration entry?', danger: true, action: async () => { setConfirmState(null); try { await deleteRegistration(id); toast.success('Registration deleted successfully'); } catch { toast.error('Failed to delete Registration'); } } });
  };

  const handleCancelRegistration = () => {
    setRegistrationForm({});
    setEditingRegistration(null);
    setShowRegistrationForm(false);
  };

  // Remittance Handlers
  const handleSaveRemittance = async () => {
    try {
      if (!remittanceForm.name || !remittanceForm.details || !remittanceForm.currency) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (editingRemittance) {
        await updateRemittance(editingRemittance, remittanceForm);
        toast.success('Remittance updated successfully');
      } else {
        await createRemittance(remittanceForm);
        toast.success('Remittance created successfully');
      }

      setRemittanceForm({});
      setEditingRemittance(null);
      setShowRemittanceForm(false);
    } catch (error) {
      toast.error('Failed to save Remittance');
    }
  };

  const handleEditRemittance = (item: RemittanceItem) => {
    setRemittanceForm(item);
    setEditingRemittance(item.id);
    setShowRemittanceForm(true);
  };

  const handleDeleteRemittance = (id: string) => {
    setConfirmState({ title: 'Delete Remittance', message: 'Are you sure you want to delete this Remittance entry?', danger: true, action: async () => { setConfirmState(null); try { await deleteRemittance(id); toast.success('Remittance deleted successfully'); } catch { toast.error('Failed to delete Remittance'); } } });
  };

  const handleCancelRemittance = () => {
    setRemittanceForm({});
    setEditingRemittance(null);
    setShowRemittanceForm(false);
  };

  // Description Handlers
  const handleSaveDescription = async () => {
    try {
      if (!descriptionForm.description) {
        toast.error('Please fill in the description field');
        return;
      }

      if (editingDescription) {
        await updateDescription(editingDescription, descriptionForm);
        toast.success('Description updated successfully');
      } else {
        await createDescription(descriptionForm);
        toast.success('Description created successfully');
      }

      setDescriptionForm({});
      setEditingDescription(null);
      setShowDescriptionForm(false);
    } catch (error) {
      toast.error('Failed to save Description');
    }
  };

  const handleEditDescription = (item: DescriptionItem) => {
    setDescriptionForm(item);
    setEditingDescription(item.id);
    setShowDescriptionForm(true);
  };

  const handleDeleteDescription = (id: string) => {
    setConfirmState({ title: 'Delete Description', message: 'Are you sure you want to delete this Description entry?', danger: true, action: async () => { setConfirmState(null); try { await deleteDescription(id); toast.success('Description deleted successfully'); } catch { toast.error('Failed to delete Description'); } } });
  };

  const handleCancelDescription = () => {
    setDescriptionForm({});
    setEditingDescription(null);
    setShowDescriptionForm(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Invoice Master Data</h2>
        <p className="text-sm text-gray-600 mt-1">Manage Bill To, Registration, and Remittance details for invoices</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('billto')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'billto' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Bill To
        </button>
        <button
          onClick={() => setActiveTab('registration')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'registration' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Registration Details
        </button>
        <button
          onClick={() => setActiveTab('remittance')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'remittance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Remittance Details
        </button>
        <button
          onClick={() => setActiveTab('descriptions')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'descriptions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Descriptions
        </button>
      </div>

      {/* Bill To Tab */}
      {activeTab === 'billto' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bill To Addresses</CardTitle>
                <CardDescription>Manage client billing addresses</CardDescription>
              </div>
              <Button onClick={() => setShowBillToForm(true)} disabled={showBillToForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill To
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showBillToForm && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <h3 className="font-semibold">{editingBillTo ? 'Edit' : 'Add'} Bill To</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Client Name *</Label>
                    <Input
                      value={billToForm.client || ''}
                      onChange={(e) => setBillToForm({ ...billToForm, client: e.target.value })}
                      placeholder="e.g., WBG, Acme Corp"
                    />
                  </div>
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={billToForm.name || ''}
                      onChange={(e) => setBillToForm({ ...billToForm, name: e.target.value })}
                      placeholder="e.g., WorldBank Group"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Address *</Label>
                    <Textarea
                      value={billToForm.address || ''}
                      onChange={(e) => setBillToForm({ ...billToForm, address: e.target.value })}
                      placeholder="Full billing address"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>GSTIN (for INR invoices)</Label>
                    <Input
                      value={billToForm.gstin || ''}
                      onChange={(e) => setBillToForm({ ...billToForm, gstin: e.target.value })}
                      placeholder="e.g., 22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <Label>Default Currency</Label>
                    <select
                      value={billToForm.currency || ''}
                      onChange={(e) => setBillToForm({ ...billToForm, currency: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select Currency</option>
                      <SelectOptions entity="invoice" field="currency" fallback={['INR','USD','EUR','GBP','AED']} />
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveBillTo}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancelBillTo}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {billToList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No Bill To addresses configured</p>
              ) : (
                billToList.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{item.client && `${item.client} - `}{item.name}</div>
                        <div className="text-sm text-gray-600 whitespace-pre-line mt-1">{item.address}</div>
                        {item.gstin && (
                          <div className="text-sm text-gray-500 mt-1">GSTIN: {item.gstin}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditBillTo(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteBillTo(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration Tab */}
      {activeTab === 'registration' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Registration Details</CardTitle>
                <CardDescription>Manage company registration information</CardDescription>
              </div>
              <Button onClick={() => setShowRegistrationForm(true)} disabled={showRegistrationForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Registration
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRegistrationForm && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <h3 className="font-semibold">{editingRegistration ? 'Edit' : 'Add'} Registration</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={registrationForm.name || ''}
                      onChange={(e) => setRegistrationForm({ ...registrationForm, name: e.target.value })}
                      placeholder="e.g., Jeshan Labs Private Limited"
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <select
                      value={registrationForm.currency || ''}
                      onChange={(e) => setRegistrationForm({ ...registrationForm, currency: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select Currency (Optional)</option>
                      <SelectOptions entity="invoice" field="currency" fallback={['INR','USD','EUR','GBP','AED']} />
                    </select>
                  </div>
                  <div>
                    <Label>Details *</Label>
                    <Textarea
                      value={registrationForm.details || ''}
                      onChange={(e) => setRegistrationForm({ ...registrationForm, details: e.target.value })}
                      placeholder="Full registration details including address, CIN, GSTIN, PAN, etc."
                      rows={5}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="regDefault"
                      checked={registrationForm.isDefault || false}
                      onChange={(e) => setRegistrationForm({ ...registrationForm, isDefault: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="regDefault" className="cursor-pointer">Set as default for this currency</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveRegistration}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancelRegistration}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {registrationList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No Registration details configured</p>
              ) : (
                registrationList.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-gray-600 whitespace-pre-line mt-1">{item.details}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditRegistration(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteRegistration(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remittance Tab */}
      {activeTab === 'remittance' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Remittance Details</CardTitle>
                <CardDescription>Manage payment remittance information by currency</CardDescription>
              </div>
              <Button onClick={() => setShowRemittanceForm(true)} disabled={showRemittanceForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Remittance
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRemittanceForm && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <h3 className="font-semibold">{editingRemittance ? 'Edit' : 'Add'} Remittance</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={remittanceForm.name || ''}
                      onChange={(e) => setRemittanceForm({ ...remittanceForm, name: e.target.value })}
                      placeholder="e.g., USD Bank Details"
                    />
                  </div>
                  <div>
                    <Label>Currency *</Label>
                    <select
                      value={remittanceForm.currency || ''}
                      onChange={(e) => setRemittanceForm({ ...remittanceForm, currency: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select Currency</option>
                      <SelectOptions entity="invoice" field="currency" fallback={['INR','USD','EUR','GBP','AED']} />
                    </select>
                  </div>
                  <div>
                    <Label>Details *</Label>
                    <Textarea
                      value={remittanceForm.details || ''}
                      onChange={(e) => setRemittanceForm({ ...remittanceForm, details: e.target.value })}
                      placeholder="Bank account details, SWIFT code, IBAN, etc."
                      rows={5}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={remittanceForm.isDefault || false}
                      onChange={(e) => setRemittanceForm({ ...remittanceForm, isDefault: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isDefault" className="cursor-pointer">Set as default for this currency</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveRemittance}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancelRemittance}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {remittanceList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No Remittance details configured</p>
              ) : (
                remittanceList.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{item.name}</div>
                          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{item.currency}</span>
                          {item.isDefault && (
                            <span className="text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 whitespace-pre-line mt-1">{item.details}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditRemittance(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteRemittance(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Descriptions Tab */}
      {activeTab === 'descriptions' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Descriptions</CardTitle>
                <CardDescription>Manage invoice line item descriptions and HSN/SAC codes</CardDescription>
              </div>
              <Button onClick={() => setShowDescriptionForm(true)} disabled={showDescriptionForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Description
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDescriptionForm && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <h3 className="font-semibold">{editingDescription ? 'Edit' : 'Add'} Description</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={descriptionForm.description || ''}
                      onChange={(e) => setDescriptionForm({ ...descriptionForm, description: e.target.value })}
                      placeholder="e.g., Software Development Services - Full-stack web application development"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>HSN/SAC Code (Optional)</Label>
                    <Input
                      value={descriptionForm.hsnSac || ''}
                      onChange={(e) => setDescriptionForm({ ...descriptionForm, hsnSac: e.target.value })}
                      placeholder="e.g., 998314 (for software services)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      HSN/SAC code is optional and typically used for INR invoices
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveDescription}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancelDescription}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {descriptionList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No Descriptions configured</p>
              ) : (
                descriptionList.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm text-gray-700">{item.description}</div>
                        {item.hsnSac && (
                          <div className="text-xs text-gray-500 mt-1">HSN/SAC: {item.hsnSac}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditDescription(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteDescription(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}