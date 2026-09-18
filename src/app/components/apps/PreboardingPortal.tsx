/**
 * PreboardingPortal — Public pre-boarding form wizard
 * No authentication required. Accessed via ?token={UUID}
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Upload, X, User, MapPin, Phone, CreditCard, FileText, Eye } from 'lucide-react';
import { supabase } from '../../utils/constants';

// ==================== TYPES ====================

interface PreboardingSubmission {
  id: string;
  token: string;
  candidate_id?: string;
  employee_id?: string;
  personal_info: Record<string, any>;
  emergency_contacts: EmergencyContact[];
  bank_details: Record<string, any>;
  document_uploads: Record<string, any>;
  submitted_at?: string;
  token_expires_at: string;
  status: string;
}

interface PersonalInfo {
  full_name: string;
  dob: string;
  gender: string;
  nationality: string;
  personal_email: string;
  phone: string;
}

interface AddressInfo {
  permanent_line1: string;
  permanent_line2: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pincode: string;
  current_same_as_permanent: boolean;
  current_line1: string;
  current_line2: string;
  current_city: string;
  current_state: string;
  current_pincode: string;
}

interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

interface BankDetails {
  bank_name: string;
  account_number: string;
  ifsc: string;
  account_type: string;
}

interface DocumentUploads {
  aadhaar?: { url: string; name: string };
  pan?: { url: string; name: string };
  passport?: { url: string; name: string };
  education_certs?: { url: string; name: string }[];
}

// ==================== HELPERS ====================

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: <User size={16} /> },
  { id: 'personal', label: 'Personal Info', icon: <User size={16} /> },
  { id: 'address', label: 'Address', icon: <MapPin size={16} /> },
  { id: 'emergency', label: 'Emergency Contacts', icon: <Phone size={16} /> },
  { id: 'bank', label: 'Bank Details', icon: <CreditCard size={16} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  { id: 'review', label: 'Review & Submit', icon: <Eye size={16} /> },
];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ==================== STEP COMPONENTS ====================

function WelcomeStep({ submission }: { submission: PreboardingSubmission }) {
  const name = submission.personal_info?.full_name || 'Candidate';
  return (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
        <span className="text-3xl text-white font-bold">JL</span>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome, {name}!</h2>
        <p className="mt-2 text-gray-600 text-sm max-w-md mx-auto">
          We're excited to have you join Jeshan Labs. Please complete the following steps to get your pre-boarding information set up.
          This will take approximately 10–15 minutes.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
        <p className="text-sm font-semibold text-blue-800">You'll need to provide:</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Personal information (name, DOB, contact)</li>
          <li>• Permanent and current address</li>
          <li>• Emergency contact details</li>
          <li>• Bank account details for salary</li>
          <li>• Identity and educational documents</li>
        </ul>
      </div>
    </div>
  );
}

function PersonalInfoStep({
  data,
  onChange,
  errors,
}: {
  data: PersonalInfo;
  onChange: (field: keyof PersonalInfo, value: string) => void;
  errors: Partial<Record<keyof PersonalInfo, string>>;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <input
            type="text"
            className={`${inputCls} ${errors.full_name ? 'border-red-400' : ''}`}
            value={data.full_name}
            onChange={e => onChange('full_name', e.target.value)}
            placeholder="As per official documents"
          />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </Field>
        <Field label="Date of Birth" required>
          <input
            type="date"
            className={`${inputCls} ${errors.dob ? 'border-red-400' : ''}`}
            value={data.dob}
            onChange={e => onChange('dob', e.target.value)}
          />
          {errors.dob && <p className="text-xs text-red-500 mt-1">{errors.dob}</p>}
        </Field>
        <Field label="Gender" required>
          <select
            className={`${inputCls} ${errors.gender ? 'border-red-400' : ''}`}
            value={data.gender}
            onChange={e => onChange('gender', e.target.value)}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
        </Field>
        <Field label="Nationality" required>
          <input
            type="text"
            className={`${inputCls} ${errors.nationality ? 'border-red-400' : ''}`}
            value={data.nationality}
            onChange={e => onChange('nationality', e.target.value)}
            placeholder="e.g. Indian"
          />
          {errors.nationality && <p className="text-xs text-red-500 mt-1">{errors.nationality}</p>}
        </Field>
        <Field label="Personal Email" required>
          <input
            type="email"
            className={`${inputCls} ${errors.personal_email ? 'border-red-400' : ''}`}
            value={data.personal_email}
            onChange={e => onChange('personal_email', e.target.value)}
            placeholder="your@email.com"
          />
          {errors.personal_email && <p className="text-xs text-red-500 mt-1">{errors.personal_email}</p>}
        </Field>
        <Field label="Mobile Phone" required>
          <input
            type="tel"
            className={`${inputCls} ${errors.phone ? 'border-red-400' : ''}`}
            value={data.phone}
            onChange={e => onChange('phone', e.target.value)}
            placeholder="+91 9876543210"
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </Field>
      </div>
    </div>
  );
}

function AddressStep({
  data,
  onChange,
}: {
  data: AddressInfo;
  onChange: (field: keyof AddressInfo, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permanent Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Address Line 1" required>
            <input type="text" className={inputCls} value={data.permanent_line1}
              onChange={e => onChange('permanent_line1', e.target.value)} placeholder="House/Flat No., Street" />
          </Field>
          <Field label="Address Line 2">
            <input type="text" className={inputCls} value={data.permanent_line2}
              onChange={e => onChange('permanent_line2', e.target.value)} placeholder="Landmark, Area" />
          </Field>
          <Field label="City" required>
            <input type="text" className={inputCls} value={data.permanent_city}
              onChange={e => onChange('permanent_city', e.target.value)} />
          </Field>
          <Field label="State" required>
            <input type="text" className={inputCls} value={data.permanent_state}
              onChange={e => onChange('permanent_state', e.target.value)} />
          </Field>
          <Field label="Pincode" required>
            <input type="text" className={inputCls} value={data.permanent_pincode}
              onChange={e => onChange('permanent_pincode', e.target.value)} placeholder="6-digit pincode" />
          </Field>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer p-3 bg-blue-50 rounded-lg">
        <input
          type="checkbox"
          checked={data.current_same_as_permanent}
          onChange={e => onChange('current_same_as_permanent', e.target.checked)}
          className="w-4 h-4 rounded text-blue-600"
        />
        <span className="text-sm font-medium text-blue-800">Current address is same as permanent address</span>
      </label>

      {!data.current_same_as_permanent && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Address</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Address Line 1" required>
              <input type="text" className={inputCls} value={data.current_line1}
                onChange={e => onChange('current_line1', e.target.value)} placeholder="House/Flat No., Street" />
            </Field>
            <Field label="Address Line 2">
              <input type="text" className={inputCls} value={data.current_line2}
                onChange={e => onChange('current_line2', e.target.value)} placeholder="Landmark, Area" />
            </Field>
            <Field label="City" required>
              <input type="text" className={inputCls} value={data.current_city}
                onChange={e => onChange('current_city', e.target.value)} />
            </Field>
            <Field label="State" required>
              <input type="text" className={inputCls} value={data.current_state}
                onChange={e => onChange('current_state', e.target.value)} />
            </Field>
            <Field label="Pincode" required>
              <input type="text" className={inputCls} value={data.current_pincode}
                onChange={e => onChange('current_pincode', e.target.value)} placeholder="6-digit pincode" />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function EmergencyContactsStep({
  contacts,
  onChange,
}: {
  contacts: EmergencyContact[];
  onChange: (contacts: EmergencyContact[]) => void;
}) {
  const addContact = () => {
    if (contacts.length >= 3) return;
    onChange([...contacts, { name: '', relation: '', phone: '' }]);
  };

  const updateContact = (idx: number, field: keyof EmergencyContact, value: string) => {
    const updated = contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
    onChange(updated);
  };

  const removeContact = (idx: number) => {
    onChange(contacts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Emergency Contacts</h3>
        {contacts.length < 3 && (
          <button
            type="button"
            onClick={addContact}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Contact
          </button>
        )}
      </div>

      {contacts.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-xl">
          <Phone size={32} className="mx-auto mb-2 text-gray-300" />
          <p>No emergency contacts added yet.</p>
          <button type="button" onClick={addContact} className="mt-2 text-blue-600 font-medium">
            Add your first contact
          </button>
        </div>
      )}

      {contacts.map((contact, idx) => (
        <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Contact {idx + 1}</span>
            {idx > 0 && (
              <button type="button" onClick={() => removeContact(idx)}
                className="text-red-500 hover:text-red-600">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Full Name" required>
              <input type="text" className={inputCls} value={contact.name}
                onChange={e => updateContact(idx, 'name', e.target.value)} placeholder="Contact name" />
            </Field>
            <Field label="Relation" required>
              <select className={inputCls} value={contact.relation}
                onChange={e => updateContact(idx, 'relation', e.target.value)}>
                <option value="">Select</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Child">Child</option>
                <option value="Friend">Friend</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Phone" required>
              <input type="tel" className={inputCls} value={contact.phone}
                onChange={e => updateContact(idx, 'phone', e.target.value)} placeholder="+91 9876543210" />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function BankDetailsStep({
  data,
  onChange,
  errors,
}: {
  data: BankDetails;
  onChange: (field: keyof BankDetails, value: string) => void;
  errors: Partial<Record<keyof BankDetails, string>>;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-gray-900">Bank Details</h3>
      <p className="text-sm text-gray-500">Your salary will be deposited to this account.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Bank Name" required>
          <input type="text" className={`${inputCls} ${errors.bank_name ? 'border-red-400' : ''}`}
            value={data.bank_name} onChange={e => onChange('bank_name', e.target.value)}
            placeholder="e.g. State Bank of India" />
          {errors.bank_name && <p className="text-xs text-red-500 mt-1">{errors.bank_name}</p>}
        </Field>
        <Field label="Account Type" required>
          <select className={`${inputCls} ${errors.account_type ? 'border-red-400' : ''}`}
            value={data.account_type} onChange={e => onChange('account_type', e.target.value)}>
            <option value="">Select type</option>
            <option value="Savings">Savings</option>
            <option value="Current">Current</option>
            <option value="Salary">Salary</option>
          </select>
          {errors.account_type && <p className="text-xs text-red-500 mt-1">{errors.account_type}</p>}
        </Field>
        <Field label="Account Number" required>
          <input type="text" className={`${inputCls} ${errors.account_number ? 'border-red-400' : ''}`}
            value={data.account_number} onChange={e => onChange('account_number', e.target.value)}
            placeholder="Enter account number" />
          {errors.account_number && <p className="text-xs text-red-500 mt-1">{errors.account_number}</p>}
        </Field>
        <Field label="IFSC Code" required>
          <input type="text" className={`${inputCls} ${errors.ifsc ? 'border-red-400' : ''}`}
            value={data.ifsc} onChange={e => onChange('ifsc', e.target.value.toUpperCase())}
            placeholder="e.g. SBIN0001234" />
          {errors.ifsc && <p className="text-xs text-red-500 mt-1">{errors.ifsc}</p>}
        </Field>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        Your bank details are securely encrypted and only used for salary disbursement.
      </div>
    </div>
  );
}

function DocumentsStep({
  submissionId,
  uploads,
  onUploaded,
}: {
  submissionId: string;
  uploads: DocumentUploads;
  onUploaded: (docType: string, url: string, name: string) => void;
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleUpload = async (docType: string, file: File) => {
    setUploading(u => ({ ...u, [docType]: true }));
    try {
      const path = `preboarding/${submissionId}/${docType}/${file.name}`;
      const { error } = await supabase.storage
        .from('onboarding-documents')
        .upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: signedData, error: signErr } = await supabase.storage
        .from('onboarding-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
      if (signErr) throw signErr;

      onUploaded(docType, signedData.signedUrl, file.name);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(u => ({ ...u, [docType]: false }));
    }
  };

  const docs: { key: string; label: string; required: boolean; description: string }[] = [
    { key: 'aadhaar', label: 'Aadhaar Card', required: true, description: 'Both sides (PDF or image)' },
    { key: 'pan', label: 'PAN Card', required: true, description: 'Clear, readable copy' },
    { key: 'passport', label: 'Passport', required: false, description: 'First and last page (optional)' },
    { key: 'education_cert_0', label: 'Highest Education Certificate', required: true, description: 'Degree/Diploma certificate' },
  ];

  const getUpload = (key: string) => {
    if (key.startsWith('education_cert')) {
      return uploads.education_certs?.[0];
    }
    return (uploads as any)[key];
  };

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-gray-900">Document Upload</h3>
      <p className="text-sm text-gray-500">Please upload clear, legible copies of your documents. Accepted formats: PDF, JPG, PNG.</p>

      <div className="space-y-3">
        {docs.map(doc => {
          const uploaded = getUpload(doc.key);
          const isUploading = uploading[doc.key];
          return (
            <div key={doc.key} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {doc.label} {doc.required && <span className="text-red-500">*</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {uploaded && (
                    <a href={uploaded.url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate max-w-[120px]">
                      {uploaded.name}
                    </a>
                  )}
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    uploaded
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                    {isUploading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {uploaded ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={isUploading}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(doc.key, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({
  personalInfo,
  addressInfo,
  contacts,
  bankDetails,
  uploads,
}: {
  personalInfo: PersonalInfo;
  addressInfo: AddressInfo;
  contacts: EmergencyContact[];
  bankDetails: BankDetails;
  uploads: DocumentUploads;
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value || '—'}</span>
    </div>
  );

  const docCount = [
    uploads.aadhaar ? 1 : 0,
    uploads.pan ? 1 : 0,
    uploads.passport ? 1 : 0,
    (uploads.education_certs?.length ?? 0),
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-gray-900">Review Your Information</h3>
      <p className="text-sm text-gray-500">Please review all details before submitting. You can go back to edit any section.</p>

      <Section title="Personal Information">
        <Row label="Full Name" value={personalInfo.full_name} />
        <Row label="Date of Birth" value={personalInfo.dob} />
        <Row label="Gender" value={personalInfo.gender} />
        <Row label="Nationality" value={personalInfo.nationality} />
        <Row label="Personal Email" value={personalInfo.personal_email} />
        <Row label="Phone" value={personalInfo.phone} />
      </Section>

      <Section title="Address">
        <Row label="Permanent" value={[addressInfo.permanent_line1, addressInfo.permanent_city, addressInfo.permanent_state, addressInfo.permanent_pincode].filter(Boolean).join(', ')} />
        <Row label="Current" value={addressInfo.current_same_as_permanent ? 'Same as permanent' : [addressInfo.current_line1, addressInfo.current_city, addressInfo.current_state, addressInfo.current_pincode].filter(Boolean).join(', ')} />
      </Section>

      <Section title="Emergency Contacts">
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400">No contacts added</p>
        ) : (
          contacts.map((c, i) => (
            <Row key={i} label={`Contact ${i + 1}`} value={`${c.name} (${c.relation}) — ${c.phone}`} />
          ))
        )}
      </Section>

      <Section title="Bank Details">
        <Row label="Bank" value={bankDetails.bank_name} />
        <Row label="Account Number" value={bankDetails.account_number ? `****${bankDetails.account_number.slice(-4)}` : ''} />
        <Row label="IFSC" value={bankDetails.ifsc} />
        <Row label="Account Type" value={bankDetails.account_type} />
      </Section>

      <Section title="Documents">
        <Row label="Uploaded" value={`${docCount} document${docCount !== 1 ? 's' : ''}`} />
        {uploads.aadhaar && <Row label="Aadhaar" value={uploads.aadhaar.name} />}
        {uploads.pan && <Row label="PAN" value={uploads.pan.name} />}
        {uploads.passport && <Row label="Passport" value={uploads.passport.name} />}
        {(uploads.education_certs ?? []).map((c, i) => (
          <Row key={i} label={`Education Cert ${i + 1}`} value={c.name} />
        ))}
      </Section>
    </div>
  );
}

// ==================== MAIN PORTAL ====================

export default function PreboardingPortal() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [submission, setSubmission] = useState<PreboardingSubmission | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'expired' | 'not_found' | 'already_submitted' | 'ready'>('loading');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    full_name: '', dob: '', gender: '', nationality: '', personal_email: '', phone: '',
  });
  const [addressInfo, setAddressInfo] = useState<AddressInfo>({
    permanent_line1: '', permanent_line2: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
    current_same_as_permanent: true,
    current_line1: '', current_line2: '', current_city: '', current_state: '', current_pincode: '',
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: '', relation: '', phone: '' }]);
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '', account_number: '', ifsc: '', account_type: '',
  });
  const [uploads, setUploads] = useState<DocumentUploads>({});
  const [errors, setErrors] = useState<Record<string, any>>({});

  // Load submission
  useEffect(() => {
    if (!token) { setLoadingState('not_found'); return; }
    (async () => {
      const { data, error } = await supabase
        .from('preboarding_submissions')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) { setLoadingState('not_found'); return; }
      if (data.status === 'submitted') { setLoadingState('already_submitted'); return; }
      if (data.token_expires_at < new Date().toISOString()) { setLoadingState('expired'); return; }

      setSubmission(data as PreboardingSubmission);
      // Pre-fill from existing data
      if (data.personal_info) setPersonalInfo(prev => ({ ...prev, ...data.personal_info }));
      if (data.bank_details) setBankDetails(prev => ({ ...prev, ...data.bank_details }));
      if (Array.isArray(data.emergency_contacts) && data.emergency_contacts.length > 0) {
        setContacts(data.emergency_contacts);
      }
      if (data.document_uploads) setUploads(data.document_uploads);
      setLoadingState('ready');
    })();
  }, [token]);

  const validateStep = useCallback(() => {
    const newErrors: Record<string, any> = {};
    if (step === 1) {
      if (!personalInfo.full_name.trim()) newErrors.full_name = 'Full name is required';
      if (!personalInfo.dob) newErrors.dob = 'Date of birth is required';
      if (!personalInfo.gender) newErrors.gender = 'Gender is required';
      if (!personalInfo.nationality.trim()) newErrors.nationality = 'Nationality is required';
      if (!personalInfo.personal_email.trim()) newErrors.personal_email = 'Email is required';
      if (!personalInfo.phone.trim()) newErrors.phone = 'Phone is required';
    }
    if (step === 4) {
      if (!bankDetails.bank_name.trim()) newErrors.bank_name = 'Bank name is required';
      if (!bankDetails.account_number.trim()) newErrors.account_number = 'Account number is required';
      if (!bankDetails.ifsc.trim()) newErrors.ifsc = 'IFSC is required';
      if (!bankDetails.account_type) newErrors.account_type = 'Account type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [step, personalInfo, bankDetails]);

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleDocUploaded = (docType: string, url: string, name: string) => {
    setUploads(prev => {
      if (docType.startsWith('education_cert')) {
        const certs = [...(prev.education_certs ?? [])];
        const idx = parseInt(docType.split('_').pop() ?? '0', 10);
        certs[idx] = { url, name };
        return { ...prev, education_certs: certs };
      }
      return { ...prev, [docType]: { url, name } };
    });
  };

  const handleSubmit = async () => {
    if (!submission) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('preboarding_submissions')
        .update({
          personal_info: personalInfo,
          emergency_contacts: contacts,
          bank_details: bankDetails,
          document_uploads: uploads,
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        })
        .eq('id', submission.id);

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render states ----

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 text-sm">Loading your pre-boarding form…</p>
        </div>
      </div>
    );
  }

  if (loadingState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Link Expired</h2>
          <p className="text-gray-500 text-sm">
            Your pre-boarding link has expired. Please contact HR to get a new invitation link.
          </p>
          <p className="text-xs text-gray-400">hr@jeshanLabs.com</p>
        </div>
      </div>
    );
  }

  if (loadingState === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
          <p className="text-gray-500 text-sm">
            This pre-boarding link is invalid or has already been used. Please contact HR for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (loadingState === 'already_submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Already Submitted</h2>
          <p className="text-gray-500 text-sm">
            Your pre-boarding information has already been submitted. The HR team will be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
          <p className="text-gray-600 text-sm">
            Your pre-boarding information has been submitted successfully. Our HR team will review it and get in touch with you shortly.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            If you have any questions, contact us at hr@jeshanLabs.com
          </p>
          <div className="pt-4">
            <div className="w-12 h-1 bg-green-200 rounded-full mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">JL</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Jeshan Labs</p>
            <p className="text-xs text-gray-500">Pre-boarding Portal</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                idx === step
                  ? 'bg-blue-600 text-white'
                  : idx < step
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {idx < step ? <CheckCircle size={12} /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{idx + 1}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-3 rounded shrink-0 ${idx < step ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 0 && <WelcomeStep submission={submission!} />}
          {step === 1 && (
            <PersonalInfoStep
              data={personalInfo}
              onChange={(field, value) => setPersonalInfo(prev => ({ ...prev, [field]: value }))}
              errors={errors}
            />
          )}
          {step === 2 && (
            <AddressStep
              data={addressInfo}
              onChange={(field, value) => setAddressInfo(prev => ({ ...prev, [field]: value }))}
            />
          )}
          {step === 3 && (
            <EmergencyContactsStep contacts={contacts} onChange={setContacts} />
          )}
          {step === 4 && (
            <BankDetailsStep
              data={bankDetails}
              onChange={(field, value) => setBankDetails(prev => ({ ...prev, [field]: value }))}
              errors={errors}
            />
          )}
          {step === 5 && (
            <DocumentsStep
              submissionId={submission!.id}
              uploads={uploads}
              onUploaded={handleDocUploaded}
            />
          )}
          {step === 6 && (
            <ReviewStep
              personalInfo={personalInfo}
              addressInfo={addressInfo}
              contacts={contacts}
              bankDetails={bankDetails}
              uploads={uploads}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-60 transition-colors"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {submitting ? 'Submitting…' : 'Submit Information'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Step {step + 1} of {STEPS.length} &mdash; Your data is encrypted and secure.
        </p>
      </div>
    </div>
  );
}
