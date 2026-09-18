/**
 * IT Services Portal — Enhanced V2
 * RBAC: IT Admin (it role) = full management; all roles can raise & view own tickets
 */

import React, { useState, useEffect, useCallback } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { useNavigate } from 'react-router';
import {
  Laptop, AlertCircle, CheckCircle2, Clock, Plus, Loader2,
  RefreshCw, MessageSquare, User, Trash2, Eye, X, Shield,
  ChevronRight, ChevronDown, AlertTriangle, Siren, BookOpen, LayoutGrid, List, Search,
  ThumbsUp, Pencil, FileText, Link2, Bug, Package, ShieldOff, RotateCcw,
} from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { useITServicesData, Ticket, getSLAStatus } from '../../hooks/useITServicesData';
import {
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, SLA_HOURS,
  KB_CATEGORIES, KB_CATEGORIES_NO_ALL as KB_CATS_NO_ALL, LINKED_ITEM_STATUSES,
  IMPACT_LEVELS, TICKET_SOURCES,
} from '../../../constants/apps/it-services';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { API_BASE, publicAnonKey, apiHeaders, supabase } from '../../utils/constants';
import { t } from '../../../i18n/index';
import EmployeeSearchDropdown from '../ui/EmployeeSearchDropdown';

// ── Helpers ──────────────────────────────────────────────────────────────────

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    Low: 'bg-gray-100 text-gray-700',
    Medium: 'bg-blue-100 text-blue-700',
    High: 'bg-orange-100 text-orange-700',
    Critical: 'bg-red-100 text-red-700',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-600';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    'Open': 'bg-yellow-100 text-yellow-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    'Pending User': 'bg-orange-100 text-orange-800',
    'Awaiting Info': 'bg-orange-100 text-orange-800',
    'Awaiting Info': 'bg-orange-100 text-orange-800',
    'Resolved': 'bg-green-100 text-green-800',
    'Closed': 'bg-gray-100 text-gray-700',
    'Cancelled': 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

const STATUS_LABELS: Record<string, string> = {
  'Open': 'Open',
  'In Progress': 'In Progress',
  'Pending User': 'Awaiting Info',
  'Resolved': 'Resolved',
  'Closed': 'Closed',
  'Cancelled': 'Cancelled',
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── SLA Bar ──────────────────────────────────────────────────────────────────

function SLABar({ ticket }: { ticket: Ticket }) {
  const { hoursElapsed, slaHours, breached } = getSLAStatus(ticket);
  const pct = Math.min((hoursElapsed / slaHours) * 100, 100);
  const barColor = breached || pct >= 90 ? 'bg-red-500' : pct >= 50 ? 'bg-orange-400' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{Math.round(hoursElapsed)}h elapsed</span>
        <span>{slaHours}h SLA</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SLADot({ ticket }: { ticket: Ticket }) {
  const { urgencyColor, breached, hoursElapsed, slaHours } = getSLAStatus(ticket);
  const remaining = slaHours - hoursElapsed;
  const color =
    urgencyColor === 'red' ? 'bg-red-500' :
    urgencyColor === 'orange' ? 'bg-orange-400' : 'bg-green-500';
  const label = breached ? t('itServices.slaBreached') : remaining < 2 ? `${Math.round(remaining)}h left` : t('itServices.withinSla');
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>
    </div>
  );
}

// ── KB Articles Data ──────────────────────────────────────────────────────────

interface KBArticle {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content?: string;
  views: number;
  updatedAt: string;
  helpfulPct: number;
  helpfulVotes: number;
  status: 'draft' | 'published';
}

function kbCategoryBadge(category: string): string {
  const map: Record<string, string> = {
    Hardware: 'bg-orange-100 text-orange-700',
    Software: 'bg-blue-100 text-blue-700',
    Network: 'bg-indigo-100 text-indigo-700',
    Access: 'bg-purple-100 text-purple-700',
    Email: 'bg-teal-100 text-teal-700',
    Security: 'bg-red-100 text-red-700',
    Onboarding: 'bg-green-100 text-green-700',
    Other: 'bg-gray-100 text-gray-700',
  };
  return map[category] ?? 'bg-muted text-muted-foreground';
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Kanban View ───────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = ['Open', 'In Progress', 'Pending User', 'Resolved', 'Closed'] as const;

function KanbanView({ tickets, onView }: { tickets: Ticket[]; onView: (t: Ticket) => void }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max p-4">
        {KANBAN_COLUMNS.map(col => {
          const colTickets = tickets.filter(t => t.status === col);
          return (
            <div key={col} className="bg-muted/30 border border-border rounded-xl p-3 min-w-[240px] w-[240px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[col] ?? col}</span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{colTickets.length}</span>
              </div>
              <div className="space-y-2">
                {colTickets.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No tickets</p>
                )}
                {colTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => onView(ticket)}
                    className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{ticket.ticketNumber}</p>
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">{ticket.title}</p>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${priorityBadge(ticket.priority)}`}>{ticket.priority}</span>
                      <span className="text-xs text-muted-foreground">{ticket.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{ticket.assignedToName ?? 'Unassigned'}</span>
                      <SLADot ticket={ticket} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Linked Items ──────────────────────────────────────────────────────────────

type LinkedItem = {
  id: string;
  type: 'backlog' | 'defect' | 'ticket';
  externalId: string;
  title: string;
  status: string;
};

function LinkedItemsSection({ ticketId, canManage }: { ticketId: string; canManage: boolean }) {
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ backlog: false, defects: false, related: false });
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ externalId: '', title: '', status: 'Open' });

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/it-services/linked-items/${ticketId}`, { headers: apiHeaders() });
      const json = await res.json();
      setItems((json.data ?? []).map((r: any) => ({
        id: r.id,
        type: r.type,
        externalId: r.external_id,
        title: r.title,
        status: r.status,
      })));
    } catch { setItems([]); }
  }, [ticketId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  function toggle(key: string) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function removeItem(id: string) {
    try {
      await fetch(`${API_BASE}/it-services/linked-items/${id}`, { method: 'DELETE', headers: apiHeaders() });
      toast.success(t('itServices.linkRemoved'));
      loadLinks();
    } catch {
      toast.error(t('common.error'));
    }
  }

  function startAdd(key: string) {
    setAddingFor(key);
    setAddForm({ externalId: '', title: '', status: 'Open' });
    if (!open[key]) setOpen(prev => ({ ...prev, [key]: true }));
  }

  function cancelAdd() {
    setAddingFor(null);
  }

  async function confirmAdd(type: 'backlog' | 'defect' | 'ticket') {
    if (!addForm.externalId.trim()) return;
    try {
      await fetch(`${API_BASE}/it-services/linked-items`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          type,
          externalId: addForm.externalId.trim(),
          title: addForm.title.trim() || addForm.externalId.trim(),
          status: addForm.status,
        }),
      });
      setAddingFor(null);
      toast.success(t('itServices.linkAdded'));
      loadLinks();
    } catch {
      toast.error(t('common.error'));
    }
  }

  const sectionConfig = [
    {
      key: 'backlog',
      label: 'Backlog Items',
      type: 'backlog' as const,
      icon: <Package className="h-3.5 w-3.5" />,
      placeholder: 'Enter backlog item ID (e.g. BI-234)',
      iconBg: 'bg-blue-50 text-blue-600',
      idColor: 'text-blue-700',
    },
    {
      key: 'defects',
      label: 'Defects',
      type: 'defect' as const,
      icon: <Bug className="h-3.5 w-3.5" />,
      placeholder: 'Enter defect ID (e.g. DEF-089)',
      iconBg: 'bg-red-50 text-red-600',
      idColor: 'text-red-700',
    },
    {
      key: 'related',
      label: 'Related Tickets',
      type: 'ticket' as const,
      icon: <FileText className="h-3.5 w-3.5" />,
      placeholder: 'Enter ticket number (e.g. INC-1031)',
      iconBg: 'bg-violet-50 text-violet-600',
      idColor: 'text-violet-700',
    },
  ];

  const totalCount = items.length;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-muted-foreground" /> {t('itServices.linkedItems')}
        </h3>
        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{totalCount}</span>
      </div>
      <div className="space-y-2">
        {sectionConfig.map(sec => {
          const secItems = items.filter(i => i.type === sec.type);
          const isAdding = addingFor === sec.key;
          return (
            <div key={sec.key} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(sec.key)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <span className="font-medium text-foreground">{sec.label} ({secItems.length})</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open[sec.key] ? 'rotate-180' : ''}`} />
              </button>
              {open[sec.key] && (
                <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/10">
                  {secItems.length === 0 && !isAdding && (
                    <p className="text-xs text-muted-foreground italic py-1">{t('itServices.noLinkedItems')}</p>
                  )}
                  {secItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1">
                      <span className={`p-1 rounded ${sec.iconBg}`}>{sec.icon}</span>
                      <span className={`text-xs font-mono font-semibold ${sec.idColor}`}>{item.externalId}</span>
                      <span className="text-xs text-foreground flex-1 truncate">{item.title}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{item.status}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Unlink"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {isAdding && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 mt-1">
                      <input
                        autoFocus
                        value={addForm.externalId}
                        onChange={e => setAddForm(f => ({ ...f, externalId: e.target.value }))}
                        placeholder={sec.placeholder}
                        className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <input
                        value={addForm.title}
                        onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Item title (optional)"
                        className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <select
                        value={addForm.status}
                        onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        {LINKED_ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmAdd(sec.type)}
                          disabled={!addForm.externalId.trim()}
                          className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          {t('itServices.addLink')}
                        </button>
                        <button
                          onClick={cancelAdd}
                          className="border border-border rounded px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {!isAdding && canManage && (
                    <button
                      onClick={() => startAdd(sec.key)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      <Plus className="h-3 w-3" /> {t('itServices.addLink')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KB Article Slide-Over ─────────────────────────────────────────────────────

interface KBSlideOverProps {
  article?: KBArticle;
  onClose: () => void;
  onSave: (article: KBArticle, publishNow: boolean) => void;
}

function KBArticleSlideOver({ article, onClose, onSave }: KBSlideOverProps) {
  const isEdit = !!article;
  const [form, setForm] = useState({
    title: article?.title ?? '',
    category: article?.category ?? KB_CATS_NO_ALL[0],
    excerpt: article?.excerpt ?? '',
    content: article?.content ?? '',
    status: article?.status ?? 'draft' as 'draft' | 'published',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 10) e.title = 'Title must be at least 10 characters';
    if (!form.category) e.category = 'Category is required';
    return e;
  }

  function handleSave(publishNow: boolean) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const now = new Date().toISOString().slice(0, 10);
    const saved: KBArticle = {
      id: article?.id ?? `kb-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      views: article?.views ?? 0,
      updatedAt: now,
      helpfulPct: article?.helpfulPct ?? 100,
      helpfulVotes: article?.helpfulVotes ?? 0,
      status: publishNow ? 'published' : 'draft',
    };
    onSave(saved, publishNow);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? t('itServices.kbEditArticle') : t('itServices.kbCreateArticle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">Title <span className="text-red-500">*</span></label>
              <span className="text-xs text-muted-foreground">{form.title.length} chars</span>
            </div>
            <input
              value={form.title}
              onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: '' })); }}
              placeholder="Article title (min 10 characters)"
              className={`w-full bg-input-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${errors.title ? 'border-red-400' : 'border-border'}`}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setErrors(er => ({ ...er, category: '' })); }}
              className={`w-full bg-input-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${errors.category ? 'border-red-400' : 'border-border'}`}
            >
              {KB_CATS_NO_ALL.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Excerpt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">Excerpt</label>
              <span className="text-xs text-muted-foreground">{form.excerpt.length}/200</span>
            </div>
            <input
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value.slice(0, 200) }))}
              placeholder="Brief summary of the article"
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Article Content</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write the full article content here..."
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              style={{ minHeight: '120px' }}
              rows={6}
            />
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Status</label>
            <div className="flex bg-muted border border-border rounded-lg overflow-hidden w-fit">
              <button
                onClick={() => setForm(f => ({ ...f, status: 'draft' }))}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${form.status === 'draft' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Draft
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, status: 'published' }))}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${form.status === 'published' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Published
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {form.status === 'draft' ? 'Draft articles are only visible to agents.' : 'Published articles are visible to all users.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted font-medium">
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted font-medium"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            Publish Article
          </button>
        </div>
      </div>
    </>
  );
}

// ── KB Article Detail Modal ───────────────────────────────────────────────────

interface KBDetailModalProps {
  article: KBArticle;
  onClose: () => void;
  onVote: (id: string, helpful: boolean) => void;
  voted: boolean;
}

function KBArticleDetailModal({ article, onClose, onVote, voted }: KBDetailModalProps) {
  const [noFeedback, setNoFeedback] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${kbCategoryBadge(article.category)}`}>
                  {article.category}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {article.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-foreground leading-snug">{article.title}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted flex-shrink-0">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {article.excerpt && (
            <p className="text-sm text-muted-foreground italic">{article.excerpt}</p>
          )}
          {article.excerpt && <hr className="border-border" />}
          <div className="text-sm text-foreground whitespace-pre-wrap">
            {article.content || 'Full article content would appear here.'}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Was this helpful?</span>
          {!noFeedback ? (
            <>
              <button
                onClick={() => { onVote(article.id, true); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${voted ? 'bg-green-50 border-green-300 text-green-700' : 'border-border hover:bg-muted text-foreground'}`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Yes {article.helpfulVotes > 0 && `(${article.helpfulVotes})`}
              </button>
              <button
                onClick={() => setNoFeedback(true)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted text-foreground"
              >
                No
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">Thanks for your feedback</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Linked Asset Section ──────────────────────────────────────────────────────

interface LinkedAssetInfo {
  id: string;
  name: string;
  asset_tag: string;
  type: string;
  assigned_to_name?: string;
}

function LinkedAssetSection({
  ticketId,
  ticketMeta,
  onRefresh,
}: {
  ticketId: string;
  ticketMeta: Record<string, unknown> | null | undefined;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<LinkedAssetInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkedAsset, setLinkedAsset] = useState<LinkedAssetInfo | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const linkedAssetId = ticketMeta?.linked_asset_id as string | undefined;

  useEffect(() => {
    if (!linkedAssetId) { setLinkedAsset(null); return; }
    setLoadingLinked(true);
    supabase
      .from('assets')
      .select('id, name, asset_tag, type, assigned_to_name')
      .eq('id', linkedAssetId)
      .maybeSingle()
      .then(({ data }) => {
        setLinkedAsset(data ?? null);
        setLoadingLinked(false);
      });
  }, [linkedAssetId]);

  async function searchAssets(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('assets')
      .select('id, name, asset_tag, type, assigned_to_name')
      .or(`name.ilike.%${q.trim()}%,asset_tag.ilike.%${q.trim()}%`)
      .limit(10);
    setResults(data ?? []);
    setSearching(false);
  }

  async function linkAsset(asset: LinkedAssetInfo) {
    const { data: existing } = await supabase.from('it_tickets').select('metadata').eq('id', ticketId).maybeSingle();
    const meta = { ...(existing?.metadata ?? {}), linked_asset_id: asset.id };
    void supabase.from('it_tickets').update({ metadata: meta }).eq('id', ticketId);
    setLinkedAsset(asset);
    setSearchQuery('');
    setResults([]);
    toast.success(t('itServices.linkedAsset.linked'));
    onRefresh();
  }

  async function unlinkAsset() {
    const { data: existing } = await supabase.from('it_tickets').select('metadata').eq('id', ticketId).maybeSingle();
    const meta: Record<string, unknown> = { ...(existing?.metadata ?? {}) };
    delete meta.linked_asset_id;
    void supabase.from('it_tickets').update({ metadata: meta }).eq('id', ticketId);
    setLinkedAsset(null);
    toast.success(t('itServices.linkedAsset.unlinked'));
    onRefresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-muted-foreground" /> {t('itServices.linkedAsset.title')}
      </h3>
      {loadingLinked ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : linkedAsset ? (
        <div className="flex items-start justify-between gap-3 bg-muted/40 border border-border rounded-lg p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{linkedAsset.name}</p>
            <p className="text-xs text-muted-foreground">{linkedAsset.asset_tag} · {linkedAsset.type}</p>
            {linkedAsset.assigned_to_name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('itServices.linkedAsset.assignedTo')}: {linkedAsset.assigned_to_name}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={() => navigate('/assets')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t('itServices.linkedAsset.viewInAssets')} ↗
            </button>
            <button
              onClick={unlinkAsset}
              className="text-xs text-red-500 hover:underline"
            >
              {t('itServices.linkedAsset.unlink')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => searchAssets(e.target.value)}
              placeholder={t('itServices.linkedAsset.searchPlaceholder')}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {results.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              {results.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => linkAsset(asset)}
                  className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
                >
                  <span className="text-sm font-medium text-foreground">{asset.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{asset.asset_tag} · {asset.type}</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery && results.length === 0 && !searching && (
            <p className="text-xs text-muted-foreground italic">{t('itServices.linkedAsset.noResults')}</p>
          )}
          {!searchQuery && (
            <p className="text-xs text-muted-foreground italic">{t('itServices.linkedAsset.none')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ticket Form Modal ─────────────────────────────────────────────────────────

interface TicketFormProps {
  isIT: boolean;
  createdByName: string;
  createdBy: string;
  onSubmit: (data: Partial<Ticket>) => Promise<void>;
  onClose: () => void;
  ticketCategories?: string[];
}

function TicketForm({ isIT, createdByName, createdBy, onSubmit, onClose, ticketCategories: catsProp }: TicketFormProps) {
  const cats = catsProp && catsProp.length > 0 ? catsProp : [...TICKET_CATEGORIES];
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itEmployees, setItEmployees] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    title: '',
    category: cats[0] as string,
    priority: 'Medium' as string,
    description: '',
    assignedTo: '',
    assignedToName: '',
    impact: 'Individual' as string,
    source: 'Self-Service Portal' as string,
  });

  useEffect(() => {
    if (!isIT) return;
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json())
      .then(json => {
        const list = (json.data ?? [])
          .filter((e: any) => e.status !== 'Inactive')
          .map((e: any) => ({ id: e.id, name: e.employee_name ?? e.fullName ?? e.name ?? "" }))
          .filter((e: any) => e.name);
        if (list.length > 0) setItEmployees(list);
      })
      .catch(() => {});
  }, [isIT]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t('validation.ticket.title');
    if (!form.category) e.category = t('validation.ticket.category');
    if (!form.description.trim()) e.description = t('validation.ticket.description');
    else if (form.description.trim().length < 10) e.description = t('validation.ticket.description');
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); toast.error(t('common.error')); return; }
    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        category: form.category,
        priority: form.priority as Ticket['priority'],
        description: form.description.trim(),
        createdBy,
        createdByName,
        impact: form.impact,
        source: form.source,
        ...(isIT && form.assignedTo ? { assignedTo: form.assignedTo, assignedToName: form.assignedToName || form.assignedTo } : {}),
      } as any);
    } finally {
      setSubmitting(false);
    }
  }

  function field(id: string) {
    return (v: string) => setForm(f => ({ ...f, [id]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{t('itServices.raiseATicket')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.titleLabel')}</label>
            <input
              value={form.title}
              onChange={e => field('title')(e.target.value)}
              placeholder={t('itServices.titlePlaceholder')}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-400' : 'border-border'}`}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.categoryLabel')}</label>
              <select
                value={form.category}
                onChange={e => field('category')(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.category ? 'border-red-400' : 'border-border'}`}
              >
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <p className="text-xs text-red-500 mt-0.5">{errors.category}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.priorityLabel')}</label>
              <select
                value={form.priority}
                onChange={e => field('priority')(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <SelectOptions entity="ticket" field="priority" fallback={['Low','Medium','High','Critical']} />
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.impact')}</label>
              <select
                value={form.impact}
                onChange={e => field('impact')(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {IMPACT_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.source')}</label>
              <select
                value={form.source}
                onChange={e => field('source')(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TICKET_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={e => field('description')(e.target.value)}
              rows={4}
              placeholder={t('itServices.descriptionPlaceholder')}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.description ? 'border-red-400' : 'border-border'}`}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>

          {isIT && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('itServices.assignTo')}</label>
              <EmployeeSearchDropdown
                value={form.assignedToName}
                onChange={(name, id) => setForm(f => ({ ...f, assignedToName: name, assignedTo: id ?? name }))}
                placeholder={t('itServices.agentNameOptional')}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('itServices.submitTicket')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status Transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Open':         ['In Progress', 'Pending User', 'Resolved', 'Cancelled'],
  'In Progress':  ['Pending User', 'Resolved', 'Closed', 'Cancelled'],
  'Pending User': ['In Progress', 'Resolved', 'Closed', 'Cancelled'],
  'Resolved':     ['Closed', 'In Progress'],
  'Closed':       ['In Progress'],
  'Cancelled':    ['Open'],
};

// ── Ticket Detail Modal ───────────────────────────────────────────────────────

interface DetailModalProps {
  ticket: Ticket;
  isIT: boolean;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string;
  canManageLinks: boolean;
  ticketCategories?: string[];
  onClose: () => void;
  onResolve: (id: string) => Promise<void>;
  onClose2: (id: string) => Promise<void>;
  onAssign: (id: string, agentId: string, agentName: string) => Promise<void>;
  onAddComment: (ticketId: string, content: string, author: string) => Promise<void>;
  onUpdateStatus: (id: string, status: Ticket['status']) => Promise<void>;
  onRefresh: () => void;
}

function DetailModal({
  ticket, isIT, isAdmin, currentUserId, currentUserName, canManageLinks, ticketCategories,
  onClose, onResolve, onClose2, onAssign, onAddComment, onUpdateStatus, onRefresh,
}: DetailModalProps) {
  const detailCats = ticketCategories && ticketCategories.length > 0 ? ticketCategories : [...TICKET_CATEGORIES];
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState('');
  const [assignName, setAssignName] = useState(ticket.assignedToName ?? '');
  const [assignCode, setAssignCode] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority as string,
    description: ticket.description,
    impact: (ticket as any).impact ?? '',
    source: (ticket as any).source ?? '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const canComment = isIT || isAdmin || ticket.createdBy === currentUserId;
  const canResolve = isIT || isAdmin;
  const hasComments = (ticket.comments?.length ?? 0) > 0;
  const sla = getSLAStatus(ticket);

  useEffect(() => {
    if (!isIT && !isAdmin) return;
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json())
      .then(json => {
        const list = (json.data ?? [])
          .filter((e: any) => e.status !== 'Inactive')
          .map((e: any) => ({
            id: e.id,
            name: e.employee_name ?? e.fullName ?? e.name ?? '',
            code: e.employee_code ?? e.employeeCode ?? '',
          }))
          .filter((e: any) => e.name);
        if (list.length > 0) setEmployees(list);
      })
      .catch(() => {});
  }, [isIT, isAdmin]);

  async function addTag(ticketId: string) {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const existing = (ticket as any).tags ?? [];
    if (existing.includes(trimmed)) { setTagInput(''); return; }
    const newTags = [...existing, trimmed];
    await fetch(`${API_BASE}/it-services/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    });
    setTagInput('');
    onRefresh();
  }

  async function removeTag(ticketId: string, tag: string) {
    const newTags = ((ticket as any).tags ?? []).filter((t: string) => t !== tag);
    await fetch(`${API_BASE}/it-services/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    });
    onRefresh();
  }

  async function toggleWatch(ticketId: string, name: string) {
    const current = (ticket as any).watchers ?? [];
    const newWatchers = current.includes(name)
      ? current.filter((w: string) => w !== name)
      : [...current, name];
    await fetch(`${API_BASE}/it-services/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchers: newWatchers }),
    });
    onRefresh();
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment(ticket.id, commentText.trim(), currentUserName);
      setCommentText('');
      toast.success(t('itServices.commentAdded'));
    } catch {
      toast.error(t('itServices.commentFailed'));
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleAssign() {
    if (!assignName.trim()) return;
    setSubmittingAssign(true);
    try {
      const match = employees.find(e => e.name === assignName.trim());
      const agentId = match ? match.id : assignName.trim();
      const displayCode = assignCode || match?.code || '';
      const displayName = displayCode ? `${assignName.trim()} (${displayCode})` : assignName.trim();
      await onAssign(ticket.id, agentId, displayName);
      toast.success(`Assigned to ${displayName}`);
    } catch {
      toast.error(t('itServices.assignFailed'));
    } finally {
      setSubmittingAssign(false);
    }
  }

  async function handleSaveEdit() {
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setSavingEdit(true);
    try {
      await onUpdateStatus(ticket.id, ticket.status); // reuse as a generic update path via the hook
      await fetch(`${API_BASE}/it-services/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          category: editForm.category,
          priority: editForm.priority,
          description: editForm.description.trim(),
          impact: editForm.impact,
          source: editForm.source,
        }),
      });
      toast.success(t('itServices.saveChanges') + ' — ticket updated');
      setEditMode(false);
      onRefresh();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  }

  function attemptResolve() {
    // Parent's onResolve now opens StatusCommentDialog — just call it directly
    onResolve(ticket.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header — sticky so X is always visible */}
        <div className="p-6 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {ticket.ticketNumber}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${priorityBadge(ticket.priority)}`}>
                  {ticket.priority}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge(ticket.status)}`}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-foreground leading-snug">{ticket.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {ticket.category} · {t('itServices.raisedBy')} {ticket.createdByName} · {fmtDate(ticket.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {(isIT || isAdmin || ticket.createdBy === currentUserId) && !editMode && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                <button
                  onClick={() => setEditMode(true)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t('itServices.editTicket')}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* SLA Bar */}
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t('itServices.slaProgress')}</p>
            <SLABar ticket={ticket} />
            {sla.breached && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                SLA breached by {Math.round(sla.hoursElapsed - sla.slaHours)}h
              </p>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Edit Mode */}
          {editMode ? (
            <div className="space-y-4 bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">{t('itServices.editTicket')}</h3>
                <button onClick={() => setEditMode(false)} className="text-xs text-muted-foreground hover:text-foreground">{t('common.cancel')}</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('itServices.titleLabel')}</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('itServices.categoryLabel')}</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background">
                    {detailCats.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('itServices.priorityLabel')}</label>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background">
                    {['Low','Medium','High','Critical'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('itServices.descriptionLabel')}</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input-background resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('itServices.saveChanges')}
                </button>
                <button onClick={() => setEditMode(false)} className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
          /* Description */
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">{t('itServices.description')}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>
          )}

          {/* Linked Items */}
          <LinkedItemsSection ticketId={ticket.id} canManage={canManageLinks} />

          {/* Linked Asset */}
          <LinkedAssetSection
            ticketId={ticket.id}
            ticketMeta={(ticket as any).metadata}
            onRefresh={onRefresh}
          />

          {/* Tags */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Tags</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {((ticket as any).tags ?? []).map((tag: string) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                  {tag}
                  {canResolve && (
                    <button onClick={() => removeTag(ticket.id, tag)} className="hover:text-red-500 ml-0.5">×</button>
                  )}
                </span>
              ))}
              {((ticket as any).tags ?? []).length === 0 && <p className="text-xs text-muted-foreground italic">No tags</p>}
            </div>
            {canResolve && (
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag(ticket.id)}
                  placeholder="Add tag..."
                  className="flex-1 bg-input-background border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button onClick={() => addTag(ticket.id)} className="px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs">Add</button>
              </div>
            )}
          </div>

          {/* Watchers */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Watchers</h4>
            <div className="flex flex-wrap gap-3 mb-3">
              {((ticket as any).watchers ?? []).map((w: string) => (
                <div key={w} className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                    {w.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs text-foreground">{w}</span>
                </div>
              ))}
              {((ticket as any).watchers ?? []).length === 0 && <p className="text-xs text-muted-foreground italic">No watchers</p>}
            </div>
            <button
              onClick={() => toggleWatch(ticket.id, currentUserName)}
              className="text-xs text-primary hover:underline"
            >
              {((ticket as any).watchers ?? []).includes(currentUserName) ? 'Unwatch' : '+ Watch'}
            </button>
          </div>

          {/* Assigned To (IT Admin) */}
          {(isIT || isAdmin) && (
            <div className="border rounded-lg p-4 bg-muted">
              <h3 className="text-sm font-semibold text-foreground mb-3">Assigned To</h3>
              {ticket.assignedToName ? (
                <p className="text-xs text-muted-foreground mb-2">
                  Currently assigned to{' '}
                  <span className="font-medium text-foreground">{ticket.assignedToName}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-2">Unassigned</p>
              )}
              <div className="flex gap-2">
                <EmployeeSearchDropdown
                  value={assignName}
                  onChange={(name, id) => {
                    setAssignName(name);
                    const match = id ? employees.find(e => e.id === id) : employees.find(e => e.name === name);
                    setAssignCode(match?.code ?? '');
                  }}
                  placeholder="Search employee…"
                  className="flex-1"
                />
                <button
                  onClick={handleAssign}
                  disabled={submittingAssign || !assignName.trim()}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {submittingAssign && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Comments & Replies */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('itServices.comments')} ({ticket.comments?.length ?? 0})
            </h3>

            {ticket.comments && ticket.comments.length > 0 ? (
              <div className="space-y-2 mb-4">
                {ticket.comments.map(c => {
                  const isAgent = c.author === ticket.assignedToName || (isIT && c.author === currentUserName);
                  const isRequester = c.author === ticket.createdByName;
                  const isMe = c.author === currentUserName;
                  return (
                    <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                        ${isAgent ? 'bg-blue-100 text-blue-700' : isRequester ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                        {initials(c.author || 'U')}
                      </div>
                      <div className={`flex-1 max-w-[85%] rounded-xl p-3 ${isMe ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className={`text-xs font-semibold ${isMe ? 'text-blue-100' : 'text-foreground'}`}>
                            {c.author || 'Unknown'}
                            {isAgent && !isMe && (
                              <span className="ml-1.5 text-xs font-normal px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Agent</span>
                            )}
                          </span>
                          <span className={`text-xs ${isMe ? 'text-blue-200' : 'text-muted-foreground'}`}>{fmtDateTime(c.createdAt)}</span>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap ${isMe ? 'text-white' : 'text-foreground'}`}>{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground mb-2">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{t('itServices.noComments')}</p>
              </div>
            )}

            {canComment && ticket.status !== 'Closed' && (
              <div className="border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={t('itServices.addCommentPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-3 text-sm focus:outline-none resize-none bg-input-background"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment();
                  }}
                />
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-t border-border">
                  <span className="text-xs text-muted-foreground">Ctrl+Enter to send</span>
                  <button
                    onClick={handleComment}
                    disabled={submittingComment || !commentText.trim()}
                    className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {(isIT || isAdmin) && (
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Update Status</p>
              <div className="flex gap-2 flex-wrap">
                {/* In Progress */}
                {ticket.status !== 'In Progress' && (VALID_TRANSITIONS[ticket.status] ?? []).includes('In Progress') && (
                  <button
                    onClick={() => onUpdateStatus(ticket.id, 'In Progress')}
                    className="bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 min-w-[130px] justify-center shadow-sm"
                  >
                    <Loader2 className="h-4 w-4" /> In Progress
                  </button>
                )}
                {/* Awaiting Info (Pending User) */}
                {(VALID_TRANSITIONS[ticket.status] ?? []).includes('Pending User') && (
                  <button
                    onClick={() => onUpdateStatus(ticket.id, 'Pending User')}
                    className="bg-orange-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-orange-600 flex items-center gap-2 min-w-[140px] justify-center shadow-sm"
                  >
                    <MessageSquare className="h-4 w-4" /> Awaiting Info
                  </button>
                )}
                {/* Resolve */}
                {(VALID_TRANSITIONS[ticket.status] ?? []).includes('Resolved') && (
                  <button
                    onClick={attemptResolve}
                    className="bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-green-700 flex items-center gap-2 min-w-[130px] justify-center shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t('itServices.resolve')}
                  </button>
                )}
                {/* Close */}
                {(VALID_TRANSITIONS[ticket.status] ?? []).includes('Closed') && (
                  <button
                    onClick={() => onClose2(ticket.id)}
                    className="bg-gray-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-gray-800 flex items-center gap-2 min-w-[120px] justify-center shadow-sm"
                  >
                    <X className="h-4 w-4" /> {t('itServices.closeTicket')}
                  </button>
                )}
                {/* Re-open */}
                {(VALID_TRANSITIONS[ticket.status] ?? []).includes('Open') && (
                  <button
                    onClick={() => onUpdateStatus(ticket.id, 'Open')}
                    className="border-2 border-yellow-500 text-yellow-700 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-yellow-50 flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    <RotateCcw className="h-4 w-4" /> Re-open
                  </button>
                )}
                {/* Revert to In Progress from Resolved/Closed */}
                {ticket.status !== 'In Progress' && !['Open', 'In Progress', 'Cancelled'].includes(ticket.status) && (VALID_TRANSITIONS[ticket.status] ?? []).includes('In Progress') && (
                  null // already handled above
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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

// ── CSAT Inline Prompt ────────────────────────────────────────────────────────

function CSATPrompt({ ticket, onRated }: { ticket: Ticket; onRated: (id: string, rating: number) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hovered, setHovered] = useState(0);

  if ((ticket as any).csat_rating || submitted) {
    return (
      <div className="px-4 py-2 bg-green-50 text-green-700 text-xs flex items-center gap-1.5">
        <span>{"★".repeat((ticket as any).csat_rating ?? 5)}</span>
        <span>{t('itServices.csatThanks')}</span>
      </div>
    );
  }

  async function handleRate(rating: number) {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/it-services/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csat_rating: rating, csat_submitted_at: new Date().toISOString() }),
      });
      setSubmitted(true);
      onRated(ticket.id, rating);
    } catch {
      toast.error(t('itServices.csatRatingFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">{t('itServices.csatFeedback')}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={submitting}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => handleRate(star)}
            className={`text-lg leading-none transition-colors ${star <= (hovered || 0) ? 'text-amber-400' : 'text-gray-300'} hover:text-amber-400 disabled:cursor-wait`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Ticket Table ──────────────────────────────────────────────────────────────

interface TableProps {
  tickets: Ticket[];
  isIT: boolean;
  isAdmin: boolean;
  currentUserId: string;
  onView: (t: Ticket) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onEscalate?: (t: Ticket) => void;
  onCSATRated?: (id: string, rating: number) => void;
  selectedTickets?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
}

function TicketTable({ tickets, isIT, isAdmin, currentUserId, onView, onResolve, onDelete, onEscalate, onCSATRated, selectedTickets, onToggleSelect, onSelectAll }: TableProps) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Laptop className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{t('itServices.noTickets')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {onToggleSelect && (
              <th className="px-3 py-3">
                <input type="checkbox" className="rounded" onChange={onSelectAll} checked={selectedTickets ? selectedTickets.size === tickets.length && tickets.length > 0 : false} />
              </th>
            )}
            <th className="px-4 py-3">Ticket #</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3 hidden md:table-cell">Category</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 hidden sm:table-cell">Assigned To</th>
            <th className="px-4 py-3">SLA</th>
            <th className="px-4 py-3 hidden lg:table-cell">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tickets.map(ticket => (
            <React.Fragment key={ticket.id}>
            <tr className="group hover:bg-muted transition-colors cursor-pointer" onClick={() => onView(ticket)}>
              {onToggleSelect && (
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="rounded" checked={selectedTickets?.has(ticket.id) ?? false} onChange={() => onToggleSelect(ticket.id)} />
                </td>
              )}
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {ticket.ticketNumber}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-foreground line-clamp-1">{ticket.title}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{ticket.category}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${priorityBadge(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge(ticket.status)}`}>
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                  {(ticket as any).escalated && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                      <Siren className="h-3 w-3" /> Escalated
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                {ticket.assignedToName ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <SLADot ticket={ticket} />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                {fmtDate(ticket.createdAt)}
              </td>
              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {(isIT || isAdmin) && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                    <button
                      onClick={() => onResolve(ticket.id)}
                      title="Resolve"
                      className="p-1.5 rounded hover:bg-green-100 text-muted-foreground hover:text-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => onDelete(ticket.id)}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
            {/* CSAT prompt for employee view on resolved/closed tickets */}
            {!isIT && !isAdmin && (ticket.status === 'Resolved' || ticket.status === 'Closed') && !(ticket as any).csat_rating && onCSATRated && (
              <tr>
                <td colSpan={9} className="p-0">
                  <CSATPrompt ticket={ticket} onRated={onCSATRated} />
                </td>
              </tr>
            )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent,
}: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className={`bg-card rounded-xl border p-5 flex items-center gap-4 shadow-sm ${accent ?? ''}`}>
      <div className="p-2 rounded-lg bg-muted">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Status-Change Comment Dialog ─────────────────────────────────────────────

const STATUSES_REQUIRING_COMMENT = new Set(['Pending User', 'Resolved', 'Closed']);

interface StatusCommentDialogProps {
  title: string;
  targetStatus: string;
  ticketIds: string[];
  onConfirm: (comment: string) => Promise<void>;
  onCancel: () => void;
}

function StatusCommentDialog({ title, targetStatus, ticketIds, onConfirm, onCancel }: StatusCommentDialogProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const label = STATUS_LABELS[targetStatus] ?? targetStatus;
  const isBulk = ticketIds.length > 1;

  async function handleConfirm() {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(comment.trim());
    } finally {
      setSubmitting(false);
    }
  }

  const colorMap: Record<string, string> = {
    'Pending User': 'bg-orange-600',
    'Resolved':     'bg-green-600',
    'Closed':       'bg-gray-700',
  };
  const btnColor = colorMap[targetStatus] ?? 'bg-blue-600';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBulk
                ? `Updating ${ticketIds.length} tickets → ${label}`
                : `Setting status to: ${label}`}
            </p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Resolution / Comment <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              A comment is required before marking{isBulk ? ' these tickets' : ' this ticket'} as <strong>{label}</strong>.
              Describe what was done, what information is needed, or why the ticket is being closed.
            </p>
            <textarea
              autoFocus
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              placeholder={
                targetStatus === 'Pending User'
                  ? 'Describe what additional information is needed from the user...'
                  : targetStatus === 'Resolved'
                  ? 'Describe the resolution — what was done to fix the issue...'
                  : 'Reason for closing this ticket...'
              }
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-input-background"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleConfirm(); }}
            />
            {!comment.trim() && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Comment is required to proceed
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              disabled={submitting || !comment.trim()}
              className={`flex-1 ${btnColor} text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2`}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm — {label}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ITServicesDB({ accessToken: _accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const { currentUser } = useUser();
  const {
    tickets, stats, loading, error,
    loadAll, createTicket, resolveTicket, closeTicket, deleteTicket, assignTicket,
    addComment, updateTicket,
  } = useITServicesData();

  const navigate = useNavigate();
  const isIT = currentUser?.roles.includes('it') ?? false;
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  const secViewAll = useSectionPermission('it-services', 'view_all_tickets');
  const secAssign = useSectionPermission('it-services', 'assign_tickets');
  const secResolve = useSectionPermission('it-services', 'resolve_tickets');
  const secAnalytics = useSectionPermission('it-services', 'analytics');
  const secKBView = useSectionPermission('it-services', 'kb_view');
  const secKBManage = useSectionPermission('it-services', 'kb_manage');
  const secLinkedItems = useSectionPermission('it-services', 'linked_items');
  const secSLA = useSectionPermission('it-services', 'manage_sla');
  const canViewAll = isIT || isAdmin || secViewAll;
  const canKBView = isIT || isAdmin || secKBView;
  const canKBManage = isIT || isAdmin || secKBManage;
  const canLinkedItems = isIT || isAdmin || secLinkedItems;
  const canSLA = isIT || isAdmin || secSLA;

  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'analytics' | 'kb' | 'sla'>(canViewAll ? 'all' : 'mine');
  const [showForm, setShowForm] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [statusCommentState, setStatusCommentState] = useState<{
    title: string; targetStatus: string; ticketIds: string[];
    onConfirm: (comment: string) => Promise<void>;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [itStaff, setItStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [kbSearch, setKbSearch] = useState('');
  const [kbCategory, setKbCategory] = useState<string>('All');
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbVotes, setKbVotes] = useState<Record<string, boolean>>({});
  const [kbSlideOver, setKbSlideOver] = useState<{ article?: KBArticle } | null>(null);
  const [kbDetailArticle, setKbDetailArticle] = useState<KBArticle | null>(null);

  useEffect(() => {
    if (canViewAll) {
      loadAll();
    } else if (currentUser?.id) {
      loadAll(currentUser.id);
    }
  }, [currentUser?.id, canViewAll]);

  // Reopen detail ticket with fresh data when tickets change
  useEffect(() => {
    if (detailTicket) {
      const fresh = tickets.find(t => t.id === detailTicket.id);
      if (fresh) setDetailTicket(fresh);
    }
  }, [tickets]);

  const userEmail = currentUser?.email;

  const loadKBArticles = useCallback(async () => {
    setKbLoading(true);
    try {
      const res = await fetch(`${API_BASE}/it-services/kb-articles`, { headers: apiHeaders(userEmail) });
      const json = await res.json();
      setKbArticles(json.data ?? []);
    } catch { setKbArticles([]); }
    finally { setKbLoading(false); }
  }, [userEmail]);

  useEffect(() => { loadKBArticles(); }, [loadKBArticles]);

  // Fetch ticket categories from master_value_helps, fall back to constants
  useEffect(() => {
    supabase
      .from('master_value_helps')
      .select('value, label')
      .eq('category', 'it_ticket_categories')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const names = (data ?? []).map((r: any) => r.label || r.value).filter(Boolean);
        if (names.length > 0) {
          setDbCategories(names);
        }
      });
  }, []);

  // Fetch IT staff for assignee filter
  useEffect(() => {
    supabase
      .from('app_users')
      .select('id, full_name')
      .in('role', ['it', 'admin', 'it_admin'])
      .then(({ data }) => {
        if (data && data.length > 0) setItStaff(data);
      });
  }, []);

  const ticketCategories = dbCategories.length > 0 ? dbCategories : [...TICKET_CATEGORIES];

  const toggleSelect = (id: string) => setSelectedTickets(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedTickets(new Set(filtered.map(t => t.id)));
  const clearSelection = () => setSelectedTickets(new Set());

  function handleBulkExport() {
    const rows = tickets.filter(t => selectedTickets.has(t.id));
    const header = 'Ticket #,Title,Category,Priority,Status,Assigned To,Created\n';
    const csv = header + rows.map(t =>
      [t.ticketNumber, `"${t.title}"`, t.category, t.priority, t.status, t.assignedToName ?? '', t.createdAt.slice(0, 10)].join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tickets.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} tickets exported`);
  }

  function handleBulkStatusChange(status: string) {
    const ids = Array.from(selectedTickets);
    if (!ids.length) return;

    const doUpdate = async (comment?: string) => {
      try {
        await Promise.all(ids.map(async id => {
          await updateTicket(id, { status: status as Ticket['status'] });
          if (comment && currentUser) {
            await addComment(id, comment, currentUser.name);
          }
        }));
        toast.success(`${ids.length} ticket${ids.length > 1 ? 's' : ''} updated to "${STATUS_LABELS[status] ?? status}"`);
      } catch {
        toast.error('Failed to update some tickets');
      }
      clearSelection();
      setStatusCommentState(null);
    };

    if (STATUSES_REQUIRING_COMMENT.has(status)) {
      setStatusCommentState({
        title: `Update ${ids.length} ticket${ids.length > 1 ? 's' : ''}`,
        targetStatus: status,
        ticketIds: ids,
        onConfirm: (comment) => doUpdate(comment),
      });
    } else {
      doUpdate();
    }
  }

  const myTickets = tickets.filter(t => t.createdBy === currentUser?.id);
  const displayTickets = activeTab === 'mine' ? myTickets : tickets;

  const filtered = displayTickets
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.ticketNumber?.toLowerCase().includes(q);
    })
    .filter(t => {
      if (!assignedToFilter) return true;
      if (assignedToFilter === '__unassigned__') return !t.assignedTo && !t.assignedToName;
      return t.assignedToName === assignedToFilter || t.assignedTo === assignedToFilter;
    })
    .filter(t => !filterCategory || t.category === filterCategory)
    .filter(t => !dateFrom || t.createdAt >= dateFrom)
    .filter(t => !dateTo || t.createdAt <= dateTo + 'T23:59:59');

  // Stats derived
  const slaBreachedCount = tickets.filter(t =>
    t.status !== 'Resolved' && t.status !== 'Closed' && getSLAStatus(t).breached
  ).length;

  const today = new Date().toDateString();
  const resolvedToday = tickets.filter(t =>
    t.resolvedAt && new Date(t.resolvedAt).toDateString() === today
  ).length;

  async function handleCreate(data: Partial<Ticket>) {
    try {
      await createTicket({ ...data, status: 'Open' });
      toast.success('Ticket created successfully');
      setShowForm(false);
      loadAll(canViewAll ? undefined : currentUser?.id);
    } catch {
      toast.error('Failed to create ticket');
      throw new Error('create failed');
    }
  }

  function handleResolve(id: string) {
    setStatusCommentState({
      title: 'Resolve Ticket',
      targetStatus: 'Resolved',
      ticketIds: [id],
      onConfirm: async (comment) => {
        await resolveTicket(id);
        if (currentUser) await addComment(id, comment, currentUser.name);
        toast.success('Ticket resolved');
        setStatusCommentState(null);
        loadAll(canViewAll ? undefined : currentUser?.id);
      },
    });
  }

  async function handleEscalate(ticket: Ticket) {
    const sla = getSLAStatus(ticket);
    const hoursOverdue = Math.round(sla.hoursElapsed - sla.slaHours);
    try {
      await updateTicket(ticket.id, {
        priority: 'Critical',
      } as Partial<Ticket>);
      // Also mark escalated via separate update (extra fields not in Ticket type)
      fetch(`${API_BASE}/it-services/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalated: true, escalated_at: new Date().toISOString() }),
      }).catch(() => {});
      // Send notification
      fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'admin',
          title: 'IT Ticket Escalated',
          body: `Ticket ${ticket.ticketNumber} has breached SLA by ${hoursOverdue}h`,
          type: 'error',
          link: '/it-services',
        }),
      }).catch(() => {});
      toast.success('Ticket escalated to Critical');
    } catch {
      toast.error('Failed to escalate ticket');
    }
  }

  function handleDelete(id: string) {
    setConfirmState({ title: 'Delete Ticket', message: 'Delete this ticket? This cannot be undone.', danger: true, action: async () => { setConfirmState(null); await deleteTicket(id, true); toast.success('Ticket deleted'); } });
  }

  // Analytics computations (it/admin only)
  const analyticsData = canViewAll ? (() => {
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
    const slaBreachedCount2 = tickets.filter(t => getSLAStatus(t).breached).length;

    const resolved = tickets.filter(t => (t.status === 'Closed' || t.status === 'Resolved') && t.resolvedAt);
    const avgResolution = resolved.length === 0 ? 0 :
      resolved.reduce((sum, t) => {
        const hrs = (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000;
        return sum + Math.max(0, hrs);
      }, 0) / resolved.length;

    // By category
    const catMap = new Map<string, number[]>();
    resolved.forEach(t => {
      const hrs = (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000;
      if (!catMap.has(t.category)) catMap.set(t.category, []);
      catMap.get(t.category)!.push(Math.max(0, hrs));
    });
    const catRaw = Array.from(catMap.entries()).map(([category, hours]) => ({
      category,
      avgHours: hours.reduce((a, b) => a + b, 0) / hours.length,
    }));
    const maxAvgHours = Math.max(...catRaw.map(c => c.avgHours), 1);
    const categoryData = catRaw.map(c => ({ ...c, pct: (c.avgHours / maxAvgHours) * 100 }));

    // By priority
    const priorityData = TICKET_PRIORITIES.map(p => {
      const subset = tickets.filter(t => t.priority === p);
      const breached = subset.filter(t => getSLAStatus(t).breached).length;
      return { priority: p, total: subset.length, breached };
    }).filter(p => p.total > 0);

    // Last 7 days volume
    const now = new Date();
    const rawDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toDateString();
      return {
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        count: tickets.filter(t => new Date(t.createdAt).toDateString() === dateStr).length,
      };
    });
    const maxCount = Math.max(...rawDays.map(d => d.count), 1);
    const volumeDays = rawDays.map(d => ({ ...d, pct: (d.count / maxCount) * 100 }));

    // CSAT avg
    const ratedTickets = tickets.filter(t => (t as any).csat_rating);
    const avgCsat = ratedTickets.length === 0 ? null :
      ratedTickets.reduce((s, t) => s + ((t as any).csat_rating ?? 0), 0) / ratedTickets.length;

    return { totalTickets, openTickets, slaBreachedCount2, avgResolution, categoryData, priorityData, volumeDays, avgCsat, csatCount: ratedTickets.length };
  })() : null;

  const roleBadge = isAdmin ? 'Admin' : isIT ? 'IT Admin' : currentUser?.primaryRole ?? 'Employee';
  const roleBadgeColor = isAdmin
    ? 'bg-red-100 text-red-700'
    : isIT
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Laptop className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none">IT Services</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Support ticket management</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ml-1 ${roleBadgeColor}`}>
              {roleBadge}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAll(canViewAll ? undefined : currentUser?.id)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Raise Ticket
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open Tickets"
            value={stats.open}
            icon={<AlertCircle className="h-5 w-5 text-yellow-500" />}
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={<Clock className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Resolved Today"
            value={resolvedToday}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          />
          <StatCard
            label="SLA Breached"
            value={slaBreachedCount}
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            accent={slaBreachedCount > 0 ? 'border-red-300 bg-red-50' : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('mine')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'mine'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                My Tickets
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {myTickets.length}
                </span>
              </button>
              {canViewAll && (
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'all'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Tickets
                  <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {tickets.length}
                  </span>
                </button>
              )}
              {canViewAll && secAnalytics && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'analytics'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Analytics
                </button>
              )}
              <button
                onClick={() => setActiveTab('kb')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'kb'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                KB
              </button>
              {(isIT || isAdmin) && (
                <button
                  onClick={() => setActiveTab('sla')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'sla'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  SLA
                </button>
              )}
            </div>
            {activeTab !== 'analytics' && activeTab !== 'kb' && activeTab !== 'sla' && (
            <div className="py-2">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            )}
          </div>

          {loading ? (
            <InlineLoader />
          ) : activeTab === 'analytics' && analyticsData ? (
            <div className="p-6 space-y-8">
              {/* Key Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Tickets', value: analyticsData.totalTickets, color: 'text-foreground' },
                  { label: 'Open / In Progress', value: analyticsData.openTickets, color: 'text-yellow-700' },
                  { label: 'SLA Breached', value: analyticsData.slaBreachedCount2, color: 'text-red-700' },
                  { label: 'Avg Resolution', value: `${analyticsData.avgResolution.toFixed(1)}h`, color: 'text-blue-700' },
                  { label: 'Avg CSAT', value: analyticsData.avgCsat !== null ? `⭐ ${analyticsData.avgCsat.toFixed(1)} (${analyticsData.csatCount} ratings)` : 'No ratings yet', color: 'text-amber-700' },
                ].map(stat => (
                  <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Resolution Time by Category */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Avg Resolution Time by Category</h3>
                {analyticsData.categoryData.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No resolved tickets yet.</p>
                ) : (
                  <div className="space-y-2">
                    {analyticsData.categoryData.map(c => (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="w-32 text-sm text-muted-foreground truncate">{c.category}</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className="text-sm text-foreground w-16 text-right">{c.avgHours.toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SLA Breach Rate by Priority */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">SLA Breach Rate by Priority</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold text-muted-foreground uppercase">
                      <th className="pb-2">Priority</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Breached</th>
                      <th className="pb-2 text-right">Breach Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analyticsData.priorityData.map(p => (
                      <tr key={p.priority}>
                        <td className="py-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${priorityBadge(p.priority)}`}>{p.priority}</span>
                        </td>
                        <td className="py-2 text-right text-foreground">{p.total}</td>
                        <td className="py-2 text-right text-red-600">{p.breached}</td>
                        <td className="py-2 text-right font-medium text-foreground">
                          {p.total > 0 ? ((p.breached / p.total) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Volume Trend — Last 7 Days */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Ticket Volume — Last 7 Days</h3>
                <div className="flex items-end gap-1 h-16">
                  {analyticsData.volumeDays.map(d => (
                    <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-indigo-400 rounded-t"
                        style={{ height: `${Math.max(d.pct, d.count > 0 ? 8 : 0)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{d.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  {analyticsData.volumeDays.map(d => (
                    <div key={d.label} className="flex-1 text-center">
                      <span className="text-[10px] text-muted-foreground">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'kb' ? (
            /* ── Knowledge Base Tab ──────────────────────────────────── */
            <div className="p-6 space-y-5">
              {!canKBView ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <ShieldOff className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">{t('common.noPermission')}</p>
                </div>
              ) : (
              <>
              {/* Search + New Article button */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={kbSearch}
                    onChange={e => setKbSearch(e.target.value)}
                    placeholder="Search knowledge base..."
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {canKBManage && (
                  <button
                    onClick={() => setKbSlideOver({})}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 whitespace-nowrap flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" /> {t('itServices.kbNewArticle')}
                  </button>
                )}
              </div>

              {/* Category Chips */}
              <div className="flex flex-wrap gap-2">
                {KB_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setKbCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      kbCategory === cat
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Article Grid + Sidebar */}
              {kbLoading ? (
                <InlineLoader />
              ) : (() => {
                const q = kbSearch.toLowerCase();
                const visibleArticles = kbArticles.filter(a =>
                  (canKBManage || a.status === 'published') &&
                  (kbCategory === 'All' || a.category === kbCategory) &&
                  (!q || a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q))
                );
                return (
                  <div className="flex gap-6">
                    {/* Article grid */}
                    <div className="flex-1">
                      {visibleArticles.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-muted-foreground">
                          <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm">{t('itServices.kbNoArticles')}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {visibleArticles.map(article => (
                            <div
                              key={article.id}
                              className="group relative bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all hover:border-primary/30 cursor-pointer"
                              onClick={() => setKbDetailArticle(article)}
                            >
                              {canKBManage && (
                                <button
                                  onClick={e => { e.stopPropagation(); setKbSlideOver({ article }); }}
                                  title="Edit article"
                                  className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${kbCategoryBadge(article.category)}`}>
                                  {article.category}
                                </span>
                                {article.status === 'draft' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Draft</span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-foreground mt-2 line-clamp-2 pr-6">{article.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{article.excerpt}</p>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                <span className="text-xs text-muted-foreground">{article.views} views</span>
                                <span className="text-xs text-muted-foreground">Updated {daysSince(article.updatedAt)}d ago</span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    const voted = kbVotes[article.id];
                                    setKbVotes(v => ({ ...v, [article.id]: !voted }));
                                    setKbArticles(arts => arts.map(a =>
                                      a.id === article.id
                                        ? { ...a, helpfulVotes: a.helpfulVotes + (voted ? -1 : 1) }
                                        : a
                                    ));
                                  }}
                                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${kbVotes[article.id] ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  {article.helpfulVotes}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sidebar */}
                    <div className="w-72 shrink-0 space-y-4">
                      {/* Trending This Week */}
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Trending This Week</h4>
                        {kbArticles.filter(a => a.status === 'published').length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No published articles yet</p>
                        ) : (
                          kbArticles
                            .filter(a => a.status === 'published')
                            .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
                            .slice(0, 5)
                            .map((article, i) => (
                              <div key={article.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0 cursor-pointer hover:text-primary" onClick={() => setKbDetailArticle(article)}>
                                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                <span className="text-sm text-foreground line-clamp-2 leading-tight">{article.title}</span>
                              </div>
                            ))
                        )}
                      </div>

                      {/* Popular Categories */}
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Popular Categories</h4>
                        {KB_CATEGORIES.filter(c => c !== 'All').map(cat => {
                          const count = kbArticles.filter(a => a.category === cat && a.status === 'published').length;
                          const maxCount = Math.max(...KB_CATEGORIES.filter(c => c !== 'All').map(c2 => kbArticles.filter(a => a.category === c2).length), 1);
                          return (
                            <div key={cat} className="flex items-center gap-2 py-1.5">
                              <span className="text-xs text-foreground w-32 truncate">{cat}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              </>
              )}
            </div>
          ) : activeTab === 'sla' ? (
            /* ── SLA Management Tab (IT Admin only) ──────────────────── */
            <div className="p-6 space-y-5">
              {!canSLA ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <ShieldOff className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">{t('common.noPermission')}</p>
                </div>
              ) : (
              <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t('itServices.slaManagement')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">SLA policies are configured in Master Data App</p>
                </div>
                <div title="Coming soon">
                  <button
                    disabled
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" /> Add Policy
                  </button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-3">Policy Name</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">1st Response</th>
                      <th className="px-4 py-3">Resolution</th>
                      <th className="px-4 py-3">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { name: 'Critical SLA', priority: 'Critical', response: '4h', resolution: '8h', compliance: 91 },
                      { name: 'High Priority SLA', priority: 'High', response: '8h', resolution: '24h', compliance: 88 },
                      { name: 'Standard SLA', priority: 'Medium', response: '16h', resolution: '48h', compliance: 85 },
                      { name: 'Low Priority SLA', priority: 'Low', response: '24h', resolution: '72h', compliance: 94 },
                    ].map(row => {
                      const barColor = row.compliance >= 85 ? 'bg-green-500' : row.compliance >= 70 ? 'bg-yellow-400' : 'bg-red-500';
                      return (
                        <tr key={row.name} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${priorityBadge(row.priority)}`}>{row.priority}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.response}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.resolution}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${row.compliance}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-foreground w-10">{row.compliance}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
          ) : (
            <>
              {/* View Toggle + Filter Bar */}
              {(activeTab === 'mine' || activeTab === 'all') && (
                <div className="px-4 pt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-card border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <List className="h-3.5 w-3.5" /> Table
                      </button>
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                      </button>
                    </div>
                    <select
                      value={assignedToFilter}
                      onChange={e => setAssignedToFilter(e.target.value)}
                      className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">{t('itServices.allAssignees')}</option>
                      <option value="__unassigned__">{t('itServices.unassigned')}</option>
                      {itStaff.map(s => (
                        <option key={s.id} value={s.full_name}>{s.full_name}</option>
                      ))}
                    </select>
                    <select
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                      className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">{t('itServices.allCategories')}</option>
                      {ticketCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-32 bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      title="From date"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-32 bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      title="To date"
                    />
                    {(assignedToFilter || filterCategory || dateFrom || dateTo) && (
                      <button
                        onClick={() => { setAssignedToFilter(''); setFilterCategory(''); setDateFrom(''); setDateTo(''); }}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  {/* Bulk Action Bar */}
                  {selectedTickets.size > 0 && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-sm font-medium text-blue-700">{selectedTickets.size} {t('itServices.selected')}</span>
                      <div className="flex gap-2 ml-2 flex-wrap">
                        <button onClick={() => handleBulkStatusChange('In Progress')} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">→ In Progress</button>
                        <button onClick={() => handleBulkStatusChange('Pending User')} className="px-3 py-1 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600">→ Awaiting Info</button>
                        <button onClick={() => handleBulkStatusChange('Closed')} className="px-3 py-1 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700">→ Close</button>
                        <button onClick={handleBulkExport} className="px-3 py-1 text-xs bg-card border border-border text-foreground rounded-lg hover:bg-muted">{t('itServices.exportCsv')}</button>
                      </div>
                      <button onClick={clearSelection} className="ml-auto text-xs text-blue-600 hover:underline">{t('itServices.clearSelection')}</button>
                    </div>
                  )}
                </div>
              )}

              {/* SLA Breach Alert Banner — IT/Admin only, All Tickets tab */}
              {canViewAll && activeTab === 'all' && (() => {
                const breached = tickets.filter(t =>
                  t.status !== 'Resolved' && t.status !== 'Closed' && getSLAStatus(t).breached
                );
                if (breached.length === 0) return null;
                return (
                  <div className="mx-4 mt-4 mb-0 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Siren className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-800">
                        {breached.length} ticket{breached.length > 1 ? 's' : ''} have breached SLA
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-red-700 border-b border-red-200">
                            <th className="pb-1 pr-3 font-medium">Ticket #</th>
                            <th className="pb-1 pr-3 font-medium">Subject</th>
                            <th className="pb-1 pr-3 font-medium">Priority</th>
                            <th className="pb-1 pr-3 font-medium">Hours Overdue</th>
                            <th className="pb-1 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {breached.map(t => {
                            const sla = getSLAStatus(t);
                            const overdue = Math.round(sla.hoursElapsed - sla.slaHours);
                            return (
                              <tr key={t.id} className="text-red-900">
                                <td className="py-1.5 pr-3 font-mono">{t.ticketNumber}</td>
                                <td className="py-1.5 pr-3 max-w-[200px] truncate">{t.title}</td>
                                <td className="py-1.5 pr-3">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${priorityBadge(t.priority)}`}>{t.priority}</span>
                                </td>
                                <td className="py-1.5 pr-3 font-semibold">{overdue}h</td>
                                <td className="py-1.5">
                                  {!(t as any).escalated && (
                                    <button
                                      onClick={() => handleEscalate(t)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                                    >
                                      <Siren className="h-3 w-3" /> Escalate
                                    </button>
                                  )}
                                  {(t as any).escalated && (
                                    <span className="text-xs text-red-600 font-medium">Escalated</span>
                                  )}
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
              {viewMode === 'kanban' ? (
                <KanbanView tickets={filtered} onView={setDetailTicket} />
              ) : (
                <TicketTable
                  tickets={filtered}
                  isIT={isIT || secAssign || secResolve}
                  isAdmin={isAdmin}
                  currentUserId={currentUser?.id ?? ''}
                  onView={setDetailTicket}
                  onResolve={id => handleResolve(id)}
                  onDelete={handleDelete}
                  onEscalate={canViewAll ? handleEscalate : undefined}
                  onCSATRated={(id, rating) => {
                    updateTicket(id, { csat_rating: rating } as any);
                  }}
                  selectedTickets={selectedTickets}
                  onToggleSelect={toggleSelect}
                  onSelectAll={selectAll}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showForm && currentUser && (
        <TicketForm
          isIT={isIT || isAdmin}
          createdBy={currentUser.id}
          createdByName={currentUser.name}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          ticketCategories={ticketCategories}
        />
      )}

      {detailTicket && currentUser && (
        <DetailModal
          ticket={detailTicket}
          isIT={isIT || secAssign || secResolve}
          isAdmin={isAdmin}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          canManageLinks={canLinkedItems}
          ticketCategories={ticketCategories}
          onClose={() => setDetailTicket(null)}
          onResolve={async (id) => {
            setStatusCommentState({
              title: 'Resolve Ticket',
              targetStatus: 'Resolved',
              ticketIds: [id],
              onConfirm: async (comment) => {
                await resolveTicket(id);
                await addComment(id, comment, currentUser.name);
                toast.success('Ticket resolved');
                setStatusCommentState(null);
                setDetailTicket(null);
                loadAll(canViewAll ? undefined : currentUser?.id);
              },
            });
          }}
          onClose2={async (id) => {
            setStatusCommentState({
              title: 'Close Ticket',
              targetStatus: 'Closed',
              ticketIds: [id],
              onConfirm: async (comment) => {
                await closeTicket(id);
                await addComment(id, comment, currentUser.name);
                toast.success(t('itServices.ticketClosed'));
                setStatusCommentState(null);
                setDetailTicket(null);
                loadAll(canViewAll ? undefined : currentUser?.id);
              },
            });
          }}
          onAssign={assignTicket}
          onAddComment={addComment}
          onUpdateStatus={async (id, status) => {
            if (STATUSES_REQUIRING_COMMENT.has(status)) {
              setStatusCommentState({
                title: `Update Status → ${STATUS_LABELS[status] ?? status}`,
                targetStatus: status,
                ticketIds: [id],
                onConfirm: async (comment) => {
                  await updateTicket(id, { status });
                  await addComment(id, comment, currentUser.name);
                  toast.success(t('itServices.statusUpdated'));
                  setStatusCommentState(null);
                  loadAll(canViewAll ? undefined : currentUser?.id);
                },
              });
            } else {
              await updateTicket(id, { status });
              toast.success(t('itServices.statusUpdated'));
              loadAll(canViewAll ? undefined : currentUser?.id);
            }
          }}
          onRefresh={() => loadAll(canViewAll ? undefined : currentUser?.id)}
        />
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

      {statusCommentState && (
        <StatusCommentDialog
          title={statusCommentState.title}
          targetStatus={statusCommentState.targetStatus}
          ticketIds={statusCommentState.ticketIds}
          onConfirm={statusCommentState.onConfirm}
          onCancel={() => setStatusCommentState(null)}
        />
      )}

      {/* KB Slide-Over */}
      {kbSlideOver !== null && (
        <KBArticleSlideOver
          article={kbSlideOver.article}
          onClose={() => setKbSlideOver(null)}
          onSave={async (saved) => {
            const isEdit = !!kbSlideOver.article;
            try {
              if (isEdit) {
                await fetch(`${API_BASE}/it-services/kb-articles/${saved.id}`, {
                  method: 'PUT',
                  headers: { ...apiHeaders(userEmail), 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: saved.title,
                    category: saved.category,
                    excerpt: saved.excerpt,
                    content: saved.content,
                    status: saved.status,
                  }),
                });
              } else {
                await fetch(`${API_BASE}/it-services/kb-articles`, {
                  method: 'POST',
                  headers: { ...apiHeaders(userEmail), 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: saved.title,
                    category: saved.category,
                    excerpt: saved.excerpt,
                    content: saved.content,
                    status: saved.status,
                    authorName: currentUser?.name ?? '',
                  }),
                });
              }
              setKbSlideOver(null);
              toast.success(t('itServices.articleSaved'));
              loadKBArticles();
            } catch {
              toast.error(t('itServices.articleSaveFailed'));
            }
          }}
        />
      )}

      {/* KB Article Detail Modal */}
      {kbDetailArticle && (
        <KBArticleDetailModal
          article={kbDetailArticle}
          voted={kbVotes[kbDetailArticle.id] ?? false}
          onClose={() => setKbDetailArticle(null)}
          onVote={(id, helpful) => {
            if (helpful) {
              const alreadyVoted = kbVotes[id];
              setKbVotes(v => ({ ...v, [id]: !alreadyVoted }));
              setKbArticles(arts => arts.map(a =>
                a.id === id ? { ...a, helpfulVotes: a.helpfulVotes + (alreadyVoted ? -1 : 1) } : a
              ));
              setKbDetailArticle(prev => prev ? { ...prev, helpfulVotes: prev.helpfulVotes + (alreadyVoted ? -1 : 1) } : null);
            }
          }}
        />
      )}
    </div>
  );
}
