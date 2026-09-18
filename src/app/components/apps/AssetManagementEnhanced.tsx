import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { toast } from 'sonner';
import {
  Package, Plus, Edit, Trash2, Eye, Loader2,
  CheckCircle, AlertTriangle, XCircle, UserCheck, RotateCcw, Wrench, QrCode,
  FileText, Image, Table, File, DownloadCloud, Upload, ShieldOff, Link as LinkIcon,
} from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { useAssetData, Asset, MaintenanceLog } from '../../hooks/useAssetData';
import { t } from '../../../i18n/index';
import { API_BASE, publicAnonKey, apiHeaders, supabase } from '../../utils/constants';
import {
  ASSET_TYPES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_TAG_PREFIX,
  MAINTENANCE_TYPES,
  RECURRING_FREQUENCIES,
  VENDORS,
  ASSET_CATEGORIES,
} from '../../../constants/apps/assets';
import { SelectOptions } from '../../context/ValueHelpsContext';

// ── DEPRECIATION ──────────────────────────────────────────────────────────────
function calcDepreciation(asset: Asset) {
  const type = (asset.type ?? '').toLowerCase();
  const usefulLife = type.includes('furniture') ? 5
    : type.includes('vehicle') ? 7
    : type.includes('building') ? 10
    : 3; // electronics / laptop / phone / default
  const purchaseDate = new Date(asset.purchaseDate ?? (asset as any).createdAt ?? Date.now());
  const yearsElapsed = (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  const purchasePrice = Number(asset.purchaseCost ?? 0);
  const annualDep = purchasePrice / usefulLife;
  const accumulated = Math.min(purchasePrice, annualDep * yearsElapsed);
  const bookValue = Math.max(0, purchasePrice - accumulated);
  const depPct = purchasePrice > 0 ? (accumulated / purchasePrice) * 100 : 0;
  return { usefulLife, annualDep, accumulated, bookValue, depPct, fullyDepreciated: purchasePrice > 0 && bookValue === 0 };
}

function bookValueColor(depPct: number) {
  if (depPct < 50) return 'text-green-700';
  if (depPct < 80) return 'text-amber-600';
  return 'text-red-600';
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const BUILDINGS = ['Head Office', 'Data Center', 'Branch - Mumbai', 'Branch - Delhi', 'Remote'];
const FLOOR_OPTIONS: Record<string, string[]> = {
  'Head Office': ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Basement'],
  'Data Center': ['Server Room A', 'Server Room B', 'NOC'],
  'Branch - Mumbai': ['Floor 1', 'Floor 2'],
  'Branch - Delhi': ['Floor 1', 'Floor 2', 'Floor 3'],
  'Remote': ['Home Office'],
};

// ── LINKED TICKET TYPES ───────────────────────────────────────────────────────
interface LinkedTicket {
  id: string;
  ticketId: string;
  type: string;
  externalId: string;
  title: string;
  status: string;
}

// ── DOCUMENT TYPES ────────────────────────────────────────────────────────────
interface AssetDocument {
  id: string;
  assetId: string;
  filename: string;
  fileType: 'pdf' | 'image' | 'docx' | 'xlsx' | 'other';
  fileSizeKB: number;
  uploadedAt: string;
  uploadedBy: string;
}

const FREQ_DAYS: Record<string, number> = {
  Weekly: 7,
  Monthly: 30,
  Quarterly: 90,
  'Semi-Annual': 180,
  Annual: 365,
};

function calcNextDue(performedDate: string, frequency: string): string {
  if (!performedDate || !frequency) return '';
  const days = FREQ_DAYS[frequency] ?? 30;
  const d = new Date(performedDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── QR MODAL ──────────────────────────────────────────────────────────────────
function QRModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qrData = encodeURIComponent(`${window.location.origin}/assets?id=${asset.id}`);
  const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${qrData}&choe=UTF-8`;

  function handleDownload() {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `asset-qr-${asset.assetTag ?? asset.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrUrl;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl p-6 w-72 text-center shadow-xl" id="qr-modal">
        <h3 className="font-semibold text-foreground mb-1">{asset.name}</h3>
        <p className="text-xs text-muted-foreground mb-4">{asset.assetTag ?? asset.id}</p>
        <img src={qrUrl} alt="Asset QR Code" className="mx-auto mb-4 rounded" />
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {t('Print')}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {t('Download')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            {t('Close')}
          </button>
        </div>
      </div>
      <style>{`@media print { body > *:not(#qr-modal) { display: none } }`}</style>
    </div>
  );
}

export function AssetManagementEnhanced({ accessToken: _accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const { currentUser } = useUser();
  const {
    assets, stats, loading, error,
    createAsset, updateAsset, deleteAsset,
    assignAsset, returnAsset, logMaintenance,
    isWarrantyExpired, isWarrantyExpiringSoon,
    refresh,
  } = useAssetData();

  const isAdmin = currentUser?.roles?.some(r => r === 'admin' || r === 'it') || currentUser?.primaryRole === 'admin' || currentUser?.primaryRole === 'it';
  const isManager = currentUser?.primaryRole === 'manager';
  const userEmail = currentUser?.email;
  const userName = currentUser?.name;

  const secDocuments = useSectionPermission('assets', 'documents');
  const secReports = useSectionPermission('assets', 'reports');
  const secCreate = useSectionPermission('assets', 'create');
  const secAssign = useSectionPermission('assets', 'assign');
  const secMaintenance = useSectionPermission('assets', 'maintenance');
  const secDispose = useSectionPermission('assets', 'dispose');

  const [activeTab, setActiveTab] = useState<'assets' | 'maintenance' | 'reports'>('assets');
  const [reportSubTab, setReportSubTab] = useState<'inventory' | 'depreciation' | 'warranty' | 'maintenance'>('depreciation');
  const [maintView, setMaintView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarTooltip, setCalendarTooltip] = useState<{ log: any; x: number; y: number } | null>(null);
  const [locationBuilding, setLocationBuilding] = useState('');
  const [locationFloor, setLocationFloor] = useState('');
  const [locationRoom, setLocationRoom] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [maintTypeFilter, setMaintTypeFilter] = useState('');
  const [maintAssetFilter, setMaintAssetFilter] = useState('');

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [assigneeName, setAssigneeName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});
  const [maintErrors, setMaintErrors] = useState<Record<string, string>>({});
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});

  // Documents state
  const [assetDocuments, setAssetDocuments] = useState<Map<string, AssetDocument[]>>(() => new Map());
  const [assetDetailTab, setAssetDetailTab] = useState<'overview' | 'documents' | 'linked-tickets'>('overview');

  // Linked IT tickets state
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [linkedTicketsLoading, setLinkedTicketsLoading] = useState(false);
  const [directLinkedTickets, setDirectLinkedTickets] = useState<any[]>([]);

  // DB-fetched vendors and categories
  const [dbVendors, setDbVendors] = useState<string[]>([]);
  const [dbAssetCategories, setDbAssetCategories] = useState<string[]>([]);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocNotes, setUploadDocNotes] = useState('');
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const loadAssetDocuments = useCallback(async (assetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/assets/documents/${assetId}`, { headers: apiHeaders(userEmail) });
      const json = await res.json();
      const docs = (json.data ?? []).map((d: any) => ({
        id: d.id,
        assetId: d.asset_id,
        filename: d.filename,
        fileType: d.file_type,
        fileSizeKB: d.file_size_kb,
        uploadedAt: d.uploaded_at,
        uploadedBy: d.uploaded_by,
      }));
      setAssetDocuments(prev => {
        const next = new Map(prev);
        next.set(assetId, docs);
        return next;
      });
    } catch { /* silently ignore */ }
  }, [userEmail]);

  const loadLinkedTickets = useCallback(async (assetId: string) => {
    setLinkedTicketsLoading(true);
    try {
      const [apiRes, sbRes] = await Promise.allSettled([
        fetch(`${API_BASE}/it-services/linked-items/asset-${assetId}`, { headers: apiHeaders(userEmail) })
          .then(r => r.json())
          .then(json => json.data ?? []),
        supabase
          .from('it_tickets')
          .select('id, ticket_number, title, status, priority, assigned_to_name, created_at')
          .eq('metadata->>linked_asset_id', assetId)
          .then(({ data }) => data ?? []),
      ]);
      const apiTickets: LinkedTicket[] = apiRes.status === 'fulfilled' ? apiRes.value : [];
      const sbTickets: any[] = sbRes.status === 'fulfilled' ? sbRes.value : [];
      setDirectLinkedTickets(sbTickets);
      // Combine, deduplicate by externalId / ticket number
      const sbAsLinked: LinkedTicket[] = sbTickets.map((t: any) => ({
        id: `direct-${t.id}`,
        ticketId: t.id,
        type: 'ticket',
        externalId: t.ticket_number ?? t.id.slice(0, 8),
        title: t.title ?? '',
        status: t.status ?? '',
      }));
      const existingIds = new Set(apiTickets.map((lt: LinkedTicket) => lt.externalId));
      const newOnes = sbAsLinked.filter(lt => !existingIds.has(lt.externalId));
      setLinkedTickets([...apiTickets, ...newOnes]);
    } catch { setLinkedTickets([]); }
    finally { setLinkedTicketsLoading(false); }
  }, [userEmail]);

  // Load vendors from master data API
  useEffect(() => {
    fetch(`${API_BASE}/master-data/vendors`, { headers: apiHeaders(userEmail) })
      .then(r => r.json())
      .then(json => {
        const names = (json.data ?? []).filter((v: any) => v.is_active).map((v: any) => v.name);
        if (names.length > 0) setDbVendors(names);
      })
      .catch(() => {});
  }, []);

  // Load asset categories from master data API
  useEffect(() => {
    fetch(`${API_BASE}/master-data/asset-categories`, { headers: apiHeaders(userEmail) })
      .then(r => r.json())
      .then(json => {
        const names = (json.data ?? []).filter((c: any) => c.is_active).map((c: any) => c.name);
        if (names.length > 0) setDbAssetCategories(names);
      })
      .catch(() => {});
  }, []);

  const vendorOptions = dbVendors.length > 0 ? dbVendors : [...VENDORS];
  const assetCategoryOptions = dbAssetCategories.length > 0 ? dbAssetCategories : [...ASSET_CATEGORIES];

  // Asset form state
  const blankForm = {
    name: '', type: ASSET_TYPES[0] as string, condition: ASSET_CONDITIONS[0] as string,
    serialNumber: '', purchaseDate: '', purchaseCost: '', vendor: '', location: '',
    warrantyExpiry: '', notes: '',
    warrantyAlerts: { days90: true, days30: true, onExpiry: true },
  };
  const [assetForm, setAssetForm] = useState(blankForm);

  // Maintenance form state
  const blankMaintForm = {
    assetId: '', type: MAINTENANCE_TYPES[0] as string, date: '', description: '',
    cost: '', performedBy: '', nextDueDate: '',
    isRecurring: false, recurringFrequency: 'Monthly', recurringNotify: true,
  };
  const [maintForm, setMaintForm] = useState(blankMaintForm);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (locationFilter && a.location !== locationFilter) return false;
      if (warrantyFilter !== 'all') {
        if (!a.warrantyExpiry) return false;
        const daysLeft = Math.ceil((new Date(a.warrantyExpiry).getTime() - Date.now()) / 86400000);
        if (warrantyFilter === 'valid' && daysLeft < 90) return false;
        if (warrantyFilter === 'expiring' && !(daysLeft >= 0 && daysLeft < 90)) return false;
        if (warrantyFilter === 'expired' && daysLeft >= 0) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) ||
          a.assetTag?.toLowerCase().includes(q) ||
          a.assignedToName?.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assets, typeFilter, statusFilter, locationFilter, warrantyFilter, search]);

  // All maintenance logs across all assets
  const allLogs = useMemo(() => {
    return assets.flatMap(a =>
      (a.maintenanceLogs || []).map(l => ({ ...l, assetName: a.name, assetTag: a.assetTag, assetType: a.type }))
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [assets]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter(l => {
      if (maintTypeFilter && l.type !== maintTypeFilter) return false;
      if (maintAssetFilter && l.assetId !== maintAssetFilter) return false;
      return true;
    });
  }, [allLogs, maintTypeFilter, maintAssetFilter]);

  // Upcoming maintenance (next 30 days)
  const upcomingMaintenance = useMemo(() => {
    const future30 = new Date(Date.now() + 30 * 86400000);
    const allLogs2: Array<{ assetId: string; assetName: string; date: string; type: string; technician: string }> = [];
    assets.forEach(asset => {
      (asset.maintenanceLogs ?? []).forEach((log: any) => {
        if (log.nextDueDate) {
          const due = new Date(log.nextDueDate);
          if (due <= future30) {
            allLogs2.push({
              assetId: asset.id,
              assetName: asset.name,
              date: log.nextDueDate,
              type: log.type,
              technician: log.performedBy,
            });
          }
        }
      });
    });
    return allLogs2.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assets]);

  // Warranty alerts
  const expiredWarranty = assets.filter(isWarrantyExpired);
  const expiringSoon = assets.filter(a => !isWarrantyExpired(a) && isWarrantyExpiringSoon(a));

  // ── ALERT PANEL DATA ──────────────────────────────────────────────────────
  const alertData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split('T')[0];
    const ago7 = new Date(); ago7.setDate(ago7.getDate() - 7);
    const ago7Str = ago7.toISOString().split('T')[0];

    const warrantyExpiring = assets.filter(a =>
      a.warrantyExpiry && a.warrantyExpiry > todayStr && a.warrantyExpiry <= in30Str
    );
    const maintOverdue = assets.filter(a => {
      const lastLog = (a.maintenanceLogs ?? []).reduce<string>((latest, l) =>
        l.nextDueDate && l.nextDueDate > latest ? l.nextDueDate : latest, '');
      return lastLog && lastLog < todayStr;
    });
    const unassignedOld = assets.filter(a =>
      !a.assignedToName && a.purchaseDate && a.purchaseDate <= ago7Str
    );
    return { warrantyExpiring, maintOverdue, unassignedOld };
  }, [assets]);

  // ── CALENDAR DATA ─────────────────────────────────────────────────────────
  const calendarEvents = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    // Actual logs keyed by date
    const byDate: Record<string, Array<{ log: any; color: string }>> = {};
    allLogs.forEach(log => {
      const d = log.date?.slice(0, 10);
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ log, color: d <= todayStr ? 'green' : 'orange' });
    });
    // Overdue nextDueDates (past due, no newer log)
    assets.forEach(a => {
      const logs = (a.maintenanceLogs ?? []).slice().sort((x, y) => y.date.localeCompare(x.date));
      if (!logs.length) return;
      const latest = logs[0];
      if (latest.nextDueDate && latest.nextDueDate < todayStr) {
        const d = latest.nextDueDate;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push({ log: { ...latest, assetName: a.name, assetTag: a.assetTag }, color: 'red' });
      }
    });
    return byDate;
  }, [allLogs, assets]);

  function statusColor(status: string) {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'In Repair': return 'bg-orange-100 text-orange-800';
      case 'Retired': return 'bg-gray-200 text-gray-700';
      case 'Lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  function conditionColor(condition: string) {
    switch (condition) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good': return 'bg-blue-100 text-blue-800';
      case 'Fair': return 'bg-yellow-100 text-yellow-800';
      case 'Poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  function WarrantyIcon({ asset }: { asset: Asset }) {
    if (!asset.warrantyExpiry) return null;
    if (isWarrantyExpired(asset)) return <XCircle className="h-4 w-4 text-red-500" title="Warranty expired" />;
    if (isWarrantyExpiringSoon(asset)) return <AlertTriangle className="h-4 w-4 text-orange-500" title="Warranty expiring soon" />;
    return <CheckCircle className="h-4 w-4 text-green-500" title="Warranty valid" />;
  }

  function generateAssetTag() {
    return `${ASSET_TAG_PREFIX}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function openAddAsset() {
    setEditingAsset(null);
    setAssetForm(blankForm);
    setLocationBuilding('');
    setLocationFloor('');
    setLocationRoom('');
    setShowAssetForm(true);
  }

  function openEditAsset(asset: Asset) {
    setEditingAsset(asset);
    // Parse hierarchical location "Building › Floor › Room"
    const parts = (asset.location ?? '').split(' › ');
    const bld = parts[0] ?? '';
    const flr = parts[1] ?? '';
    const rm = parts[2] ?? '';
    setLocationBuilding(bld);
    setLocationFloor(flr);
    setLocationRoom(rm);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      condition: asset.condition,
      serialNumber: asset.serialNumber ?? '',
      purchaseDate: asset.purchaseDate ?? '',
      purchaseCost: asset.purchaseCost != null ? String(asset.purchaseCost) : '',
      vendor: asset.vendor ?? '',
      location: asset.location,
      warrantyExpiry: asset.warrantyExpiry ?? '',
      notes: asset.notes ?? '',
      warrantyAlerts: { days90: true, days30: true, onExpiry: true },
    });
    setShowAssetForm(true);
  }

  async function handleAssetSubmit() {
    const errs: Record<string, string> = {};
    if (!assetForm.name?.trim()) errs.name = t('validation.asset.name');
    if (!assetForm.type?.trim()) errs.type = t('validation.asset.type');
    if (!assetForm.condition?.trim()) errs.condition = t('validation.asset.condition');
    if (!assetForm.location?.trim()) errs.location = t('validation.asset.location');
    if (assetForm.warrantyExpiry && assetForm.purchaseDate && new Date(assetForm.warrantyExpiry) <= new Date(assetForm.purchaseDate)) {
      errs.warrantyExpiry = t('validation.asset.warrantyAfterPurchase');
    }
    if (Object.keys(errs).length > 0) {
      setAssetErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setAssetErrors({});
    setSubmitting(true);
    try {
      const payload: Partial<Asset> = {
        name: assetForm.name,
        type: assetForm.type,
        condition: assetForm.condition,
        serialNumber: assetForm.serialNumber || undefined,
        purchaseDate: assetForm.purchaseDate || undefined,
        purchaseCost: assetForm.purchaseCost ? parseFloat(assetForm.purchaseCost) : undefined,
        vendor: assetForm.vendor || undefined,
        location: assetForm.location,
        warrantyExpiry: assetForm.warrantyExpiry || undefined,
        notes: assetForm.notes || undefined,
      };
      if (!editingAsset) {
        payload.assetTag = generateAssetTag();
        payload.status = 'Available';
        payload.maintenanceLogs = [];
        await createAsset(payload);
        toast.success(t('Asset created successfully'));
      } else {
        await updateAsset(editingAsset.id, payload);
        toast.success(t('Asset updated successfully'));
      }
      setShowAssetForm(false);
    } catch (e: any) {
      toast.error(e.message ?? t('Operation failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(asset: Asset) {
    setConfirmState({ title: t('Delete Asset'), message: t('Are you sure you want to delete this asset?'), danger: true, action: async () => {
      setConfirmState(null);
      try {
        const { id: _id, ...restAsset } = asset;
        await deleteAsset(asset.id);
        toast('Asset deleted', {
          description: 'This action can be reversed within 5 seconds.',
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await fetch(`${API_BASE}/assets/assets`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(restAsset),
                });
                await refresh();
                toast.success(t('Asset restored successfully'));
              } catch {
                toast.error(t('Failed to restore asset'));
              }
            },
          },
          duration: 5000,
        });
      } catch (e: any) { toast.error(e.message ?? t('Delete failed')); }
    } });
  }

  async function handleAssign() {
    const errs: Record<string, string> = {};
    if (!assigneeName.trim()) errs.assigneeName = t('validation.asset.assignee');
    if (Object.keys(errs).length > 0) {
      setAssignErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setAssignErrors({});
    if (!assigningAsset) return;
    setSubmitting(true);
    try {
      await assignAsset(assigningAsset.id, currentUser?.id ?? '', assigneeName.trim());
      toast.success(t('Asset assigned'));
      setAssigningAsset(null);
      setAssigneeName('');
    } catch (e: any) {
      toast.error(e.message ?? t('Assign failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReturn(asset: Asset) {
    setConfirmState({ title: t('Return Asset'), message: t('Mark this asset as returned?'), action: async () => { setConfirmState(null); try { await returnAsset(asset.id); toast.success(t('Asset returned')); } catch (e: any) { toast.error(e.message ?? t('Return failed')); } } });
  }

  async function handleMaintSubmit() {
    const errs: Record<string, string> = {};
    if (!maintForm.assetId) errs.assetId = t('validation.maintenance.asset');
    if (!maintForm.date) errs.date = t('validation.maintenance.date');
    if (!maintForm.description?.trim()) errs.description = t('validation.maintenance.description');
    if (!maintForm.performedBy?.trim()) errs.performedBy = t('validation.maintenance.performedBy');
    if (Object.keys(errs).length > 0) {
      setMaintErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setMaintErrors({});
    setSubmitting(true);
    try {
      const computedNextDue = maintForm.isRecurring && maintForm.date
        ? calcNextDue(maintForm.date, maintForm.recurringFrequency)
        : maintForm.nextDueDate || undefined;
      await logMaintenance(maintForm.assetId, {
        type: maintForm.type,
        date: maintForm.date,
        description: maintForm.description,
        cost: maintForm.cost ? parseFloat(maintForm.cost) : undefined,
        performedBy: maintForm.performedBy,
        nextDueDate: computedNextDue,
        isRecurring: maintForm.isRecurring || undefined,
        recurringFrequency: maintForm.isRecurring ? maintForm.recurringFrequency : undefined,
      } as any);
      toast.success(t('Maintenance logged'));
      setShowMaintForm(false);
      setMaintForm(blankMaintForm);
    } catch (e: any) {
      toast.error(e.message ?? t('Failed to log maintenance'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <InlineLoader />;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-bold text-foreground">{t('Asset Management')}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              {currentUser?.primaryRole ?? 'Employee'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {secCreate && (
              <button
                onClick={openAddAsset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('Add Asset')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Dashboard row: KPIs + alert panel */}
        <div className="flex gap-4 items-start">
          {/* Left: stat cards + depreciation */}
          <div className="flex-1 space-y-4 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t('Total Assets'), value: stats.total, color: 'text-foreground' },
                { label: t('Assigned'), value: stats.assigned, color: 'text-blue-700' },
                { label: t('Available'), value: stats.available, color: 'text-green-700' },
                { label: t('In Repair'), value: stats.inRepair, color: 'text-orange-700' },
              ].map(card => (
                <div key={card.label} className="bg-card rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Depreciation summary card */}
            {(() => {
              const totalCost = assets.reduce((s, a) => s + Number(a.purchaseCost ?? 0), 0);
              const totalBook = assets.reduce((s, a) => s + calcDepreciation(a).bookValue, 0);
              const totalDep = totalCost - totalBook;
              const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
              return (
                <div className="bg-card rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('Depreciation Summary')}</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t('Total Assets Value')}</p>
                      <p className="text-lg font-bold text-foreground">{fmt(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t('Current Book Value')}</p>
                      <p className="text-lg font-bold text-green-700">{fmt(totalBook)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t('Total Depreciated')}</p>
                      <p className="text-lg font-bold text-red-600">{fmt(totalDep)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right: alert panel (sticky, 300px) */}
          <div className="w-[300px] shrink-0 bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t('Alerts')}</p>
            </div>
            {alertData.warrantyExpiring.length === 0 && alertData.maintOverdue.length === 0 && alertData.unassignedOld.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-green-700">
                {t('No alerts — all assets healthy ✓')}
              </div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {alertData.warrantyExpiring.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                      <p className="text-xs font-semibold text-orange-700">
                        {t('Warranty Expiring Soon')} ({alertData.warrantyExpiring.length})
                      </p>
                    </div>
                    {alertData.warrantyExpiring.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">Expires {a.warrantyExpiry}</p>
                        </div>
                        <button
                          onClick={() => { setViewingAsset(a); loadAssetDocuments(a.id); loadLinkedTickets(a.id); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded border border-orange-300 text-orange-600 hover:bg-orange-50 shrink-0"
                        >
                          {t('View')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {alertData.maintOverdue.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                      <p className="text-xs font-semibold text-red-700">
                        {t('Maintenance Overdue')} ({alertData.maintOverdue.length})
                      </p>
                    </div>
                    {alertData.maintOverdue.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">Maintenance past due</p>
                        </div>
                        <button
                          onClick={() => { setViewingAsset(a); loadAssetDocuments(a.id); loadLinkedTickets(a.id); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded border border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                        >
                          {t('View')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {alertData.unassignedOld.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                      <p className="text-xs font-semibold text-blue-700">
                        {t('Unassigned >7 days')} ({alertData.unassignedOld.length})
                      </p>
                    </div>
                    {alertData.unassignedOld.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">Since {a.purchaseDate}</p>
                        </div>
                        <button
                          onClick={() => { setViewingAsset(a); loadAssetDocuments(a.id); loadLinkedTickets(a.id); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 shrink-0"
                        >
                          {t('View')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border">
          {([
            { key: 'assets', label: t('Assets') },
            { key: 'maintenance', label: t('Maintenance Log') },
            { key: 'reports', label: t('assetMgmt.reports') },
          ] as { key: 'assets' | 'maintenance' | 'reports'; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ASSETS TAB ── */}
        {activeTab === 'assets' && (
          <div className="space-y-4">
            {/* Warranty alerts */}
            {expiredWarranty.length > 0 && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-semibold text-red-700 mb-1">{t('Expired Warranties')}</p>
                <ul className="text-sm text-red-600 space-y-0.5">
                  {expiredWarranty.map(a => (
                    <li key={a.id}>{a.assetTag} — {a.name} (expired {a.warrantyExpiry})</li>
                  ))}
                </ul>
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-sm font-semibold text-yellow-700 mb-1">{t('Warranties Expiring Soon')}</p>
                <ul className="text-sm text-yellow-700 space-y-0.5">
                  {expiringSoon.map(a => (
                    <li key={a.id}>{a.assetTag} — {a.name} (expires {a.warrantyExpiry})</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Filter bar */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Type chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setTypeFilter('')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      typeFilter === '' ? 'bg-orange-600 text-white border-orange-600' : 'border-border text-muted-foreground hover:border-orange-400'
                    }`}
                  >
                    {t('All')}
                  </button>
                  {ASSET_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        typeFilter === type ? 'bg-orange-600 text-white border-orange-600' : 'border-border text-muted-foreground hover:border-orange-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-border rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">{t('All Statuses')}</option>
                  <SelectOptions entity="asset" field="status" fallback={['Available','Assigned','In Repair','Retired','Disposed']} />
                </select>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All Locations</option>
                  {[...new Set(assets.map(a => a.location).filter(Boolean))].sort().map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <select
                  value={warrantyFilter}
                  onChange={e => setWarrantyFilter(e.target.value as any)}
                  className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">All Warranty</option>
                  <option value="valid">Valid (90d+)</option>
                  <option value="expiring">Expiring Soon (&lt;90d)</option>
                  <option value="expired">Expired</option>
                </select>
                <input
                  type="text"
                  placeholder={t('Search assets...')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 min-w-40 border border-border rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Asset table */}
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('Asset Tag')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('Name / Type')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('Status')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('Condition')}</th>
                    <th className="hidden lg:table-cell px-4 py-3 font-medium text-muted-foreground">{t('Book Value')}</th>
                    <th className="hidden sm:table-cell px-4 py-3 font-medium text-muted-foreground">{t('Assigned To')}</th>
                    <th className="hidden md:table-cell px-4 py-3 font-medium text-muted-foreground">{t('Location')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('Warranty')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {t('assetMgmt.noAssets')}
                      </td>
                    </tr>
                  ) : filteredAssets.map(asset => (
                    <tr key={asset.id} className="group border-b border-gray-50 hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{asset.assetTag}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(asset.condition)}`}>
                          {asset.condition}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3">
                        {(() => {
                          const dep = calcDepreciation(asset);
                          if (dep.fullyDepreciated) {
                            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Fully Depreciated</span>;
                          }
                          if (Number(asset.purchaseCost ?? 0) === 0) return <span className="text-muted-foreground text-xs">—</span>;
                          return (
                            <span className={`text-xs font-semibold ${bookValueColor(dep.depPct)}`}>
                              ${dep.bookValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {asset.assignedToName ?? '—'}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{asset.location}</td>
                      <td className="px-4 py-3">
                        <WarrantyIcon asset={asset} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setViewingAsset(asset); loadAssetDocuments(asset.id); loadLinkedTickets(asset.id); }}
                            className="p-1.5 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground transition-colors"
                            title={t('View Details')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {secAssign && asset.status === 'Available' && (
                            <button
                              onClick={() => { setAssigningAsset(asset); setAssigneeName(''); }}
                              className="p-1.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
                              title={t('Assign')}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && asset.status === 'Assigned' && (
                            <button
                              onClick={() => handleReturn(asset)}
                              className="p-1.5 rounded hover:bg-orange-100 text-orange-500 hover:text-orange-700 transition-colors"
                              title={t('Return')}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => openEditAsset(asset)}
                              className="p-1.5 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground transition-colors"
                              title={t('Edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setQrAsset(asset)}
                              className="p-1.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors"
                              title={t('View QR')}
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(asset)}
                              className="p-1.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                              title={t('Delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && !secReports && (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <ShieldOff className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{t('common.noPermission')}</p>
          </div>
        )}
        {activeTab === 'reports' && secReports && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 border-b border-border">
              {(['inventory', 'depreciation', 'warranty', 'maintenance'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setReportSubTab(st)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                    reportSubTab === st
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st === 'maintenance' ? 'Maintenance Cost' : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>

            {/* Depreciation sub-tab */}
            {reportSubTab === 'depreciation' && (() => {
              const rows = assets.map(a => {
                const dep = calcDepreciation(a);
                const ageYears = a.purchaseDate
                  ? ((Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000)).toFixed(1)
                  : '—';
                return { a, dep, ageYears };
              });
              const totalValue = assets.reduce((s, a) => s + Number(a.purchaseCost ?? 0), 0);
              const totalDep = rows.reduce((s, r) => s + r.dep.accumulated, 0);
              const avgAge = assets.filter(a => a.purchaseDate).length > 0
                ? (assets.filter(a => a.purchaseDate).reduce((s, a) =>
                    s + (Date.now() - new Date(a.purchaseDate!).getTime()) / (365.25 * 24 * 3600 * 1000), 0)
                  / assets.filter(a => a.purchaseDate).length).toFixed(1)
                : '—';
              const nearEol = rows.filter(r => r.dep.depPct >= 90).length;
              const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Asset Value', value: fmt(totalValue), color: 'text-foreground' },
                      { label: 'Total Depreciated', value: fmt(totalDep), color: 'text-red-600' },
                      { label: 'Average Age', value: `${avgAge} yrs`, color: 'text-foreground' },
                      { label: 'Assets <10% Value', value: String(nearEol), color: 'text-orange-600' },
                    ].map(c => (
                      <div key={c.label} className="bg-card rounded-xl border border-border p-4">
                        <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                        <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted text-left">
                          {['Asset', 'Category', 'Purchase Price', 'Age (yrs)', 'Current Value', 'Dep %', 'Status'].map(h => (
                            <th key={h} className="px-4 py-3 font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ a, dep, ageYears }) => {
                          const status = dep.depPct >= 90 ? { label: 'EOL', cls: 'bg-red-50 text-red-700 border-red-200' }
                            : dep.depPct >= 70 ? { label: 'Near-EOL', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
                            : { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-200' };
                          return (
                            <tr key={a.id} className="border-b border-border hover:bg-muted transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{a.type}</td>
                              <td className="px-4 py-3 text-muted-foreground">{a.purchaseCost ? fmt(Number(a.purchaseCost)) : '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground">{ageYears}</td>
                              <td className="px-4 py-3 text-muted-foreground">{Number(a.purchaseCost ?? 0) > 0 ? fmt(dep.bookValue) : '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground">{Number(a.purchaseCost ?? 0) > 0 ? `${dep.depPct.toFixed(0)}%` : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Warranty sub-tab */}
            {reportSubTab === 'warranty' && (() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const rows = assets
                .filter(a => a.warrantyExpiry)
                .map(a => {
                  const daysLeft = Math.ceil((new Date(a.warrantyExpiry!).getTime() - Date.now()) / (86400 * 1000));
                  const status = daysLeft < 0
                    ? { label: 'Expired', cls: 'bg-red-50 text-red-700 border-red-200' }
                    : daysLeft < 30
                    ? { label: 'Critical', cls: 'bg-red-50 text-red-700 border-red-200' }
                    : daysLeft <= 90
                    ? { label: 'Expiring', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
                    : { label: 'Valid', cls: 'bg-green-50 text-green-700 border-green-200' };
                  return { a, daysLeft, status };
                })
                .sort((x, y) => x.daysLeft - y.daysLeft);
              return (
                <div className="bg-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted text-left">
                        {['Asset', 'Category', 'Warranty End', 'Days Remaining', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No warranty data</td></tr>
                      ) : rows.map(({ a, daysLeft, status }) => (
                        <tr key={a.id} className="border-b border-border hover:bg-muted transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{a.type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{a.warrantyExpiry}</td>
                          <td className="px-4 py-3 text-muted-foreground">{daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Maintenance Cost sub-tab */}
            {reportSubTab === 'maintenance' && (() => {
              const byCat: Record<string, number> = {};
              allLogs.forEach(log => {
                const cat = (log as any).assetType ?? 'Other';
                byCat[cat] = (byCat[cat] ?? 0) + (log.cost ?? 0);
              });
              const total = Object.values(byCat).reduce((s, v) => s + v, 0);
              const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
              return (
                <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <p className="text-sm font-semibold text-foreground">
                    Total Maintenance Cost: <span className="text-orange-600">${total.toLocaleString()}</span>
                  </p>
                  {sorted.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No maintenance cost data</p>
                  ) : sorted.map(([cat, cost]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground">{cat}</span>
                        <span className="text-muted-foreground">${cost.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-orange-500 transition-all"
                          style={{ width: `${total > 0 ? (cost / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Inventory sub-tab */}
            {reportSubTab === 'inventory' && (() => {
              const byStatus: Record<string, number> = {};
              assets.forEach(a => { byStatus[a.status] = (byStatus[a.status] ?? 0) + 1; });
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(byStatus).map(([status, count]) => (
                      <div key={status} className="bg-card rounded-xl border border-border p-4">
                        <p className="text-xs text-muted-foreground mb-1">{status}</p>
                        <p className="text-2xl font-bold text-foreground">{count}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted text-left">
                          <th className="px-4 py-3 font-medium text-muted-foreground">Tag</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Location</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Purchase Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map(a => (
                          <tr key={a.id} className="border-b border-border hover:bg-muted transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.assetTag}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.type}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>{a.status}</span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{a.assignedToName ?? '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.location}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.purchaseDate ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── MAINTENANCE TAB ── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['list', 'calendar'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setMaintView(v)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                      maintView === v ? 'bg-orange-600 text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v === 'list' ? 'List' : 'Calendar'}
                  </button>
                ))}
              </div>
              <select
                value={maintAssetFilter}
                onChange={e => setMaintAssetFilter(e.target.value)}
                className="border border-border rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">{t('All Assets')}</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
              </select>
              <select
                value={maintTypeFilter}
                onChange={e => setMaintTypeFilter(e.target.value)}
                className="border border-border rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">{t('All Types')}</option>
                <SelectOptions entity="asset" field="maintenance_type" fallback={['Preventive','Corrective','Emergency']} />
              </select>
              {secMaintenance && (
                <button
                  onClick={() => { setShowMaintForm(true); setMaintForm(blankMaintForm); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                >
                  <Wrench className="h-4 w-4" />
                  {t('Log Maintenance')}
                </button>
              )}
            </div>

            {/* List view */}
            {maintView === 'list' && (
              <div className="bg-card rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Asset Tag')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Asset Name')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Type')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Date')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Performed By')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Cost')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">{t('Next Due')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          {t('No maintenance logs found')}
                        </td>
                      </tr>
                    ) : filteredLogs.map(log => (
                      <tr key={log.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(log as any).assetTag}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{(log as any).assetName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.date}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.performedBy}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.cost != null ? `$${log.cost.toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.nextDueDate ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Calendar view */}
            {maintView === 'calendar' && (() => {
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();
              const upcomingPanel = (
                <div className="w-80 shrink-0">
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">Upcoming — Next 30 Days</h3>
                    </div>
                    <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                      {upcomingMaintenance.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">No upcoming maintenance</div>
                      )}
                      {upcomingMaintenance.map((item, i) => {
                        const daysUntil = Math.ceil((new Date(item.date).getTime() - Date.now()) / 86400000);
                        const isOverdue = daysUntil < 0;
                        return (
                          <div key={i} className={`flex items-start gap-3 px-4 py-3 ${isOverdue ? 'bg-red-50' : ''}`}>
                            <div className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${isOverdue ? 'bg-red-100 text-red-700' : daysUntil <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                              {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.assetName || 'Asset'}</p>
                              <p className="text-xs text-muted-foreground">{item.type} · {item.technician || 'Unassigned'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
              const monthName = calendarDate.toLocaleString('default', { month: 'long' });
              const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: (number | null)[] = Array(firstDay).fill(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(null);
              const pad = (n: number) => String(n).padStart(2, '0');
              return (
                <div className="flex gap-6">
                <div className="flex-1">
                <div className="bg-card rounded-xl border border-border overflow-hidden relative" onClick={() => setCalendarTooltip(null)}>
                  {/* Month nav */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <button
                      onClick={e => { e.stopPropagation(); setCalendarDate(new Date(year, month - 1, 1)); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    >&#8592;</button>
                    <p className="font-semibold text-foreground text-sm">{monthName} {year}</p>
                    <button
                      onClick={e => { e.stopPropagation(); setCalendarDate(new Date(year, month + 1, 1)); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    >&#8594;</button>
                  </div>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-border">
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} className="min-h-[72px] border-b border-r border-border bg-muted/30" />;
                      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                      const events = calendarEvents[dateStr] ?? [];
                      return (
                        <div
                          key={i}
                          className="min-h-[72px] border-b border-r border-border p-1.5 relative"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="text-xs font-medium text-muted-foreground block mb-1">{day}</span>
                          {events.length > 0 && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                          )}
                          <div className="space-y-0.5">
                            {events.slice(0, 3).map((ev, j) => (
                              <button
                                key={j}
                                onClick={e => {
                                  e.stopPropagation();
                                  setCalendarTooltip({ log: ev.log, x: e.clientX, y: e.clientY });
                                }}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate ${
                                  ev.color === 'green' ? 'bg-green-100 text-green-800'
                                  : ev.color === 'red' ? 'bg-red-100 text-red-800'
                                  : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {ev.log.assetName ?? ev.log.type}
                              </button>
                            ))}
                            {events.length > 3 && (
                              <p className="text-xs text-muted-foreground pl-1">+{events.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Tooltip */}
                  {calendarTooltip && (
                    <div
                      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg p-3 text-sm w-56"
                      style={{ top: calendarTooltip.y + 8, left: calendarTooltip.x + 8 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="font-semibold text-foreground mb-1">{calendarTooltip.log.assetName}</p>
                      <p className="text-muted-foreground text-xs">{calendarTooltip.log.type}</p>
                      {calendarTooltip.log.performedBy && (
                        <p className="text-muted-foreground text-xs">By: {calendarTooltip.log.performedBy}</p>
                      )}
                      <button
                        onClick={() => setCalendarTooltip(null)}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Close
                      </button>
                    </div>
                  )}
                  {/* Legend */}
                  <div className="flex gap-4 px-4 py-2 border-t border-border">
                    {[['bg-green-100 text-green-800', 'Completed'], ['bg-orange-100 text-orange-800', 'Scheduled'], ['bg-red-100 text-red-800', 'Overdue']].map(([cls, label]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
                {upcomingPanel}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── ASSET DETAIL MODAL ── */}
      {viewingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-bold text-foreground">{t('Asset Details')}</h2>
              <button onClick={() => { setViewingAsset(null); setAssetDetailTab('overview'); }} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">&times;</button>
            </div>
            {/* Detail tabs */}
            <div className="flex gap-0 border-b border-border shrink-0">
              {([
                { key: 'overview', label: t('assetMgmt.overview'), show: true },
                { key: 'documents', label: t('assetMgmt.documents'), show: secDocuments },
                { key: 'linked-tickets', label: (() => {
                  const openCount = directLinkedTickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress').length;
                  return openCount > 0 ? `IT Tickets · ${openCount} Open` : 'IT Tickets';
                })(), show: true },
              ] as { key: 'overview' | 'documents' | 'linked-tickets'; label: string; show: boolean }[]).filter(tab => tab.show).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setAssetDetailTab(tab.key)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    assetDetailTab === tab.key
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'documents' && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                      {(assetDocuments.get(viewingAsset.id) ?? []).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1">
            {assetDetailTab === 'overview' && (
            <div className="px-6 py-4 space-y-5">
              {/* Asset info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  [t('Asset Tag'), viewingAsset.assetTag],
                  [t('Name'), viewingAsset.name],
                  [t('Type'), viewingAsset.type],
                  [t('Serial Number'), viewingAsset.serialNumber ?? '—'],
                  [t('Purchase Date'), viewingAsset.purchaseDate ?? '—'],
                  [t('Purchase Cost'), viewingAsset.purchaseCost != null ? `$${viewingAsset.purchaseCost.toLocaleString()}` : '—'],
                  [t('Vendor'), viewingAsset.vendor ?? '—'],
                  [t('Location'), viewingAsset.location],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Assignment section */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('Assignment')}</h3>
                {viewingAsset.assignedToName ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{viewingAsset.assignedToName}</p>
                      <p className="text-xs text-muted-foreground">{t('Since')} {viewingAsset.assignedDate ?? '—'}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => { handleReturn(viewingAsset); setViewingAsset(null); }}
                        className="px-3 py-1.5 text-sm border border-orange-300 text-orange-600 rounded-md hover:bg-orange-50 transition-colors"
                      >
                        {t('Return Asset')}
                      </button>
                    )}
                  </div>
                ) : (
                  isAdmin && viewingAsset.status === 'Available' ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('Employee name')}
                        value={assigneeName}
                        onChange={e => setAssigneeName(e.target.value)}
                        className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={async () => {
                          if (!assigneeName.trim()) return;
                          setSubmitting(true);
                          try {
                            await assignAsset(viewingAsset.id, currentUser?.id ?? '', assigneeName.trim());
                            toast.success(t('Asset assigned'));
                            setViewingAsset(null);
                            setAssigneeName('');
                          } catch (e: any) { toast.error(e.message); }
                          finally { setSubmitting(false); }
                        }}
                        disabled={submitting}
                        className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                      >
                        {t('Assign')}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('Unassigned')}</p>
                  )
                )}
              </div>

              {/* Depreciation section */}
              {Number(viewingAsset.purchaseCost ?? 0) > 0 && (() => {
                const dep = calcDepreciation(viewingAsset);
                return (
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">{t('Depreciation')}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Purchase Price')}</p>
                        <p className="font-medium text-foreground">${Number(viewingAsset.purchaseCost).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Book Value')}</p>
                        <p className={`font-medium ${bookValueColor(dep.depPct)}`}>
                          {dep.fullyDepreciated ? 'Fully Depreciated' : `$${dep.bookValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Annual Depreciation')}</p>
                        <p className="font-medium text-foreground">${dep.annualDep.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Useful Life')}</p>
                        <p className="font-medium text-foreground">{dep.usefulLife} yrs</p>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${dep.depPct < 50 ? 'bg-green-500' : dep.depPct < 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, dep.depPct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{dep.depPct.toFixed(1)}% depreciated</p>
                  </div>
                );
              })()}

              {/* Warranty section */}
              {viewingAsset.warrantyExpiry && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('Warranty')}</h3>
                  <div className="flex items-center gap-2">
                    <WarrantyIcon asset={viewingAsset} />
                    <span className="text-sm text-foreground">
                      {isWarrantyExpired(viewingAsset) ? t('Expired') : t('Expires')} {viewingAsset.warrantyExpiry}
                    </span>
                  </div>
                </div>
              )}

              {/* Maintenance history */}
              {viewingAsset.maintenanceLogs?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">{t('Maintenance History')}</h3>
                  <div className="space-y-2">
                    {[...viewingAsset.maintenanceLogs]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(log => (
                        <div key={log.id} className="flex justify-between items-start text-sm border-b border-border pb-2">
                          <div>
                            <p className="font-medium text-foreground">{log.type} — {log.description}</p>
                            <p className="text-xs text-muted-foreground">{log.performedBy} · {log.date}</p>
                          </div>
                          {log.cost != null && <p className="text-muted-foreground text-xs">${log.cost.toLocaleString()}</p>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Documents tab */}
            {assetDetailTab === 'documents' && (() => {
              const docs = assetDocuments.get(viewingAsset.id) ?? [];
              function fileIcon(fileType: string) {
                if (fileType === 'pdf') return <FileText className="h-8 w-8 text-red-500" />;
                if (fileType === 'image') return <Image className="h-8 w-8 text-blue-500" />;
                if (fileType === 'docx') return <FileText className="h-8 w-8 text-blue-600" />;
                if (fileType === 'xlsx') return <Table className="h-8 w-8 text-green-600" />;
                return <File className="h-8 w-8 text-muted-foreground" />;
              }
              function fmtSize(kb: number) {
                return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
              }
              return (
                <div className="px-6 py-4">
                  <div className="flex justify-end mb-4">
                    {secDocuments && (
                      <button
                        onClick={() => { setShowUploadDocModal(true); setUploadDocFile(null); setUploadDocNotes(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        {t('assetMgmt.uploadDocument')}
                      </button>
                    )}
                  </div>
                  {docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">{t('assetMgmt.noDocuments')}</p>
                      {secDocuments && (
                        <button
                          onClick={() => { setShowUploadDocModal(true); setUploadDocFile(null); setUploadDocNotes(''); }}
                          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          {t('assetMgmt.uploadDocument')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {docs.map(doc => (
                        <div key={doc.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all flex flex-col">
                          <div className="flex justify-center mb-2">{fileIcon(doc.fileType)}</div>
                          <p className="text-sm font-medium text-foreground truncate text-center" title={doc.filename}>{doc.filename}</p>
                          <p className="text-xs text-muted-foreground text-center mt-0.5">{fmtSize(doc.fileSizeKB)}</p>
                          <p className="text-xs text-muted-foreground text-center">{doc.uploadedAt} · by {doc.uploadedBy}</p>
                          <div className="flex gap-1 mt-3 justify-center">
                            <button
                              onClick={() => toast.success(t('assetMgmt.downloadStarted'))}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-muted-foreground"
                              title="Download"
                            >
                              <DownloadCloud className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await fetch(`${API_BASE}/assets/documents/${doc.id}`, { method: 'DELETE', headers: apiHeaders(userEmail) });
                                  await loadAssetDocuments(viewingAsset.id);
                                  toast.success(t('assetMgmt.documentDeleted'));
                                } catch {
                                  toast.error(t('common.error'));
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-50 transition-colors text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Linked IT Tickets tab */}
            {assetDetailTab === 'linked-tickets' && (
              <div className="p-4 space-y-3">
                {linkedTicketsLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
                {!linkedTicketsLoading && linkedTickets.length === 0 && (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <LinkIcon className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No IT tickets linked to this asset</p>
                  </div>
                )}
                {linkedTickets.map(lt => (
                  <div key={lt.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:shadow-sm transition-all">
                    <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{lt.externalId}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          lt.status === 'Open' ? 'bg-blue-50 text-blue-700' :
                          lt.status === 'In Progress' ? 'bg-yellow-50 text-yellow-700' :
                          lt.status === 'Resolved' ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'
                        }`}>{lt.status}</span>
                      </div>
                      <p className="text-sm text-foreground truncate mt-0.5">{lt.title || 'IT Ticket'}</p>
                    </div>
                    <button
                      onClick={() => toast.success('Opening in IT Services... (navigate to IT Services app)')}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Open ↗
                    </button>
                  </div>
                ))}
                <AddAssetTicketLink assetId={viewingAsset.id} onLinked={() => loadLinkedTickets(viewingAsset.id)} userEmail={userEmail} />
              </div>
            )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-border shrink-0">
              <button
                onClick={() => { setViewingAsset(null); setAssetDetailTab('overview'); }}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSET FORM MODAL ── */}
      {showAssetForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {editingAsset ? t('Edit Asset') : t('Add Asset')}
              </h2>
              <button onClick={() => setShowAssetForm(false)} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Name')} *</label>
                <input
                  type="text"
                  value={assetForm.name}
                  onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {assetErrors.name && <p className="text-xs text-red-500 mt-0.5">{assetErrors.name}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Type')} *</label>
                <select
                  value={assetForm.type}
                  onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <SelectOptions entity="asset" field="type" fallback={['Laptop','Desktop','Monitor','Phone','Tablet','Printer','Server','Other']} />
                </select>
                {assetErrors.type && <p className="text-xs text-red-500 mt-0.5">{assetErrors.type}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Condition')} *</label>
                <select
                  value={assetForm.condition}
                  onChange={e => setAssetForm(f => ({ ...f, condition: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <SelectOptions entity="asset" field="condition" fallback={['New','Good','Fair','Poor']} />
                </select>
                {assetErrors.condition && <p className="text-xs text-red-500 mt-0.5">{assetErrors.condition}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Serial Number')}</label>
                <input
                  type="text"
                  value={assetForm.serialNumber}
                  onChange={e => setAssetForm(f => ({ ...f, serialNumber: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Purchase Date')}</label>
                <input
                  type="date"
                  value={assetForm.purchaseDate}
                  onChange={e => setAssetForm(f => ({ ...f, purchaseDate: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Purchase Cost')}</label>
                <input
                  type="number"
                  value={assetForm.purchaseCost}
                  onChange={e => setAssetForm(f => ({ ...f, purchaseCost: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Vendor')}</label>
                <select
                  value={assetForm.vendor}
                  onChange={e => setAssetForm(f => ({ ...f, vendor: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                >
                  <option value="">{t('Select vendor...')}</option>
                  {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{t('Location')} *</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={locationBuilding}
                    onChange={e => {
                      const bld = e.target.value;
                      setLocationBuilding(bld);
                      setLocationFloor('');
                      setLocationRoom('');
                      const loc = bld ? [bld].join(' › ') : '';
                      setAssetForm(f => ({ ...f, location: loc }));
                    }}
                    className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  >
                    <option value="">Building</option>
                    {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select
                    value={locationFloor}
                    disabled={!locationBuilding}
                    onChange={e => {
                      const flr = e.target.value;
                      setLocationFloor(flr);
                      setLocationRoom('');
                      const loc = [locationBuilding, flr].filter(Boolean).join(' › ');
                      setAssetForm(f => ({ ...f, location: loc }));
                    }}
                    className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background disabled:opacity-50"
                  >
                    <option value="">Floor</option>
                    {(FLOOR_OPTIONS[locationBuilding] ?? []).map(fl => <option key={fl} value={fl}>{fl}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Room / Zone"
                    value={locationRoom}
                    disabled={!locationFloor}
                    onChange={e => {
                      const rm = e.target.value;
                      setLocationRoom(rm);
                      const loc = [locationBuilding, locationFloor, rm].filter(Boolean).join(' › ');
                      setAssetForm(f => ({ ...f, location: loc }));
                    }}
                    className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                </div>
                {assetForm.location && (
                  <p className="text-xs text-muted-foreground mt-1">{assetForm.location}</p>
                )}
                {assetErrors.location && <p className="text-xs text-red-500 mt-0.5">{assetErrors.location}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Warranty Expiry')}</label>
                <input
                  type="date"
                  value={assetForm.warrantyExpiry}
                  onChange={e => setAssetForm(f => ({ ...f, warrantyExpiry: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {assetErrors.warrantyExpiry && <p className="text-xs text-red-500 mt-0.5">{assetErrors.warrantyExpiry}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2 border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground">Alert me before warranty expires:</p>
                <div className="flex flex-wrap gap-4">
                  {([
                    { key: 'days90', label: '90 days before' },
                    { key: 'days30', label: '30 days before' },
                    { key: 'onExpiry', label: 'On expiry' },
                  ] as { key: keyof typeof assetForm.warrantyAlerts; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={assetForm.warrantyAlerts[key]}
                        onChange={e => setAssetForm(f => ({
                          ...f,
                          warrantyAlerts: { ...f.warrantyAlerts, [key]: e.target.checked },
                        }))}
                        className="h-4 w-4 rounded border-border accent-orange-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{t('Notes')}</label>
                <textarea
                  value={assetForm.notes}
                  onChange={e => setAssetForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowAssetForm(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleAssetSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingAsset ? t('Update') : t('Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN MODAL ── */}
      {assigningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">{t('Assign Asset')}</h2>
              <button onClick={() => setAssigningAsset(null)} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">{assigningAsset.name} ({assigningAsset.assetTag})</p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Employee Name')} *</label>
                <input
                  type="text"
                  value={assigneeName}
                  onChange={e => setAssigneeName(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {assignErrors.assigneeName && <p className="text-xs text-red-500 mt-0.5">{assignErrors.assigneeName}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setAssigningAsset(null)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                {t('Cancel')}
              </button>
              <button
                onClick={handleAssign}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('Assign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAINTENANCE FORM MODAL ── */}
      {showMaintForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('Log Maintenance')}</h2>
              <button onClick={() => setShowMaintForm(false)} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Asset')} *</label>
                <select
                  value={maintForm.assetId}
                  onChange={e => setMaintForm(f => ({ ...f, assetId: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">{t('Select asset...')}</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
                </select>
                {maintErrors.assetId && <p className="text-xs text-red-500 mt-0.5">{maintErrors.assetId}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Maintenance Type')}</label>
                <select
                  value={maintForm.type}
                  onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <SelectOptions entity="asset" field="maintenance_type" fallback={['Preventive','Corrective','Emergency']} />
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Date')} *</label>
                <input
                  type="date"
                  value={maintForm.date}
                  onChange={e => setMaintForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {maintErrors.date && <p className="text-xs text-red-500 mt-0.5">{maintErrors.date}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Description')} *</label>
                <textarea
                  value={maintForm.description}
                  onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {maintErrors.description && <p className="text-xs text-red-500 mt-0.5">{maintErrors.description}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('Performed By')} *</label>
                <input
                  type="text"
                  value={maintForm.performedBy}
                  onChange={e => setMaintForm(f => ({ ...f, performedBy: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {maintErrors.performedBy && <p className="text-xs text-red-500 mt-0.5">{maintErrors.performedBy}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('Cost')}</label>
                  <input
                    type="number"
                    value={maintForm.cost}
                    onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {!maintForm.isRecurring && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('Next Due Date')}</label>
                    <input
                      type="date"
                      value={maintForm.nextDueDate}
                      onChange={e => setMaintForm(f => ({ ...f, nextDueDate: e.target.value }))}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Recurring toggle */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={maintForm.isRecurring}
                    onChange={e => setMaintForm(f => ({ ...f, isRecurring: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-orange-600"
                  />
                  <span className="text-sm font-medium text-foreground">{t('assetMgmt.recurringMaintenance')}</span>
                </label>
                {maintForm.isRecurring && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('assetMgmt.frequency')}</label>
                      <select
                        value={maintForm.recurringFrequency}
                        onChange={e => {
                          const freq = e.target.value;
                          const nextDue = maintForm.date ? calcNextDue(maintForm.date, freq) : '';
                          setMaintForm(f => ({ ...f, recurringFrequency: freq, nextDueDate: nextDue }));
                        }}
                        className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {RECURRING_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    {maintForm.date && maintForm.recurringFrequency && (() => {
                      const nd = calcNextDue(maintForm.date, maintForm.recurringFrequency);
                      return nd ? (
                        <p className="text-xs text-muted-foreground">
                          Next scheduled: <span className="font-medium text-foreground">{nd}</span>
                        </p>
                      ) : null;
                    })()}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={maintForm.recurringNotify}
                        onChange={e => setMaintForm(f => ({ ...f, recurringNotify: e.target.checked }))}
                        className="h-4 w-4 rounded border-border accent-orange-600"
                      />
                      <span className="text-xs text-foreground">{t('assetMgmt.notifyBefore')}</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowMaintForm(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                {t('Cancel')}
              </button>
              <button
                onClick={handleMaintSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('Save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── UPLOAD DOCUMENT MODAL ── */}
      {showUploadDocModal && viewingAsset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-[480px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">{t('assetMgmt.uploadDocument')}</h3>
              <button onClick={() => setShowUploadDocModal(false)} className="text-muted-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg h-20 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 transition-colors"
                onClick={() => docFileInputRef.current?.click()}
              >
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                {uploadDocFile ? (
                  <p className="text-sm text-foreground font-medium truncate max-w-xs">{uploadDocFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Drop files here or browse</p>
                )}
              </div>
              <input
                ref={docFileInputRef}
                type="file"
                className="hidden"
                onChange={e => setUploadDocFile(e.target.files?.[0] ?? null)}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes / Description (optional)</label>
                <input
                  type="text"
                  value={uploadDocNotes}
                  onChange={e => setUploadDocNotes(e.target.value)}
                  placeholder="e.g. Warranty certificate"
                  className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowUploadDocModal(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                {t('Cancel')}
              </button>
              <button
                onClick={async () => {
                  if (!uploadDocFile) { toast.error(t('common.error')); return; }
                  try {
                    const res = await fetch(`${API_BASE}/assets/documents`, {
                      method: 'POST',
                      headers: { ...apiHeaders(userEmail), 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        assetId: viewingAsset.id,
                        filename: uploadDocFile.name,
                        fileType: uploadDocFile.name.split('.').pop()?.toLowerCase() || 'other',
                        fileSizeKB: Math.round(uploadDocFile.size / 1024),
                        notes: uploadDocNotes,
                        uploadedBy: userName || 'System',
                      }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      await loadAssetDocuments(viewingAsset.id);
                      toast.success(t('assetMgmt.documentUploaded'));
                    } else {
                      toast.error(json.error ?? t('common.error'));
                    }
                  } catch {
                    toast.error(t('common.error'));
                  }
                  setShowUploadDocModal(false);
                }}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                {t('assetMgmt.uploadDocument')}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrAsset && <QRModal asset={qrAsset} onClose={() => setQrAsset(null)} />}
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

function AddAssetTicketLink({ assetId, onLinked, userEmail }: { assetId: string; onLinked: () => void; userEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Open');

  const handleAdd = async () => {
    if (!ticketId) return;
    await fetch(`${API_BASE}/it-services/linked-items`, {
      method: 'POST',
      headers: { ...apiHeaders(userEmail), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: `asset-${assetId}`, type: 'ticket', externalId: ticketId, title, status }),
    });
    setOpen(false); setTicketId(''); setTitle(''); setStatus('Open');
    onLinked();
    toast.success('Ticket linked');
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">+ Link IT Ticket</button>
  );
  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
      <input value={ticketId} onChange={e => setTicketId(e.target.value)} placeholder="Ticket ID (e.g. INC-1047)" className="w-full bg-input-background border border-border rounded-lg px-2 py-1 text-sm" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ticket title (optional)" className="w-full bg-input-background border border-border rounded-lg px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <button onClick={handleAdd} className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs">Add Link</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1 bg-card border border-border text-muted-foreground rounded-lg text-xs">Cancel</button>
      </div>
    </div>
  );
}
