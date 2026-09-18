import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useCommunicationsData } from '../../hooks/useCommunicationsData';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { toast } from 'sonner';
import { t } from '../../../i18n/index';
import { supabase, API_BASE, publicAnonKey, safeJson } from '../../utils/constants';
import { ATTACHMENT_TYPES, AUDIENCE_OPTIONS } from '../../../constants/apps/communications';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useDepartmentOptions } from '../../hooks/useSharedData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const COMMS_API = `${API_BASE}/communications`;

// ─── Badge Types ──────────────────────────────────────────────────────────────

const BADGE_TYPES = [
  { key: 'hero_of_month', label: 'Hero of the Month', emoji: '🏆', color: 'amber' },
  { key: 'above_beyond', label: 'Above & Beyond', emoji: '⭐', color: 'blue' },
  { key: 'team_player', label: 'Team Player', emoji: '🤝', color: 'indigo' },
  { key: 'innovation_award', label: 'Innovation Award', emoji: '💡', color: 'violet' },
  { key: 'customer_champion', label: 'Customer Champion', emoji: '🌟', color: 'teal' },
  { key: 'learning_champion', label: 'Learning Champion', emoji: '📚', color: 'green' },
  { key: 'leadership_excellence', label: 'Leadership Excellence', emoji: '👑', color: 'purple' },
  { key: 'mentor_of_quarter', label: 'Mentor of the Quarter', emoji: '🎓', color: 'emerald' },
] as const;

type BadgeKey = (typeof BADGE_TYPES)[number]['key'];

function badgeInfo(key: string) {
  return BADGE_TYPES.find((b) => b.key === key) ?? BADGE_TYPES[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnouncementComment {
  id: string;
  announcement_id: string;
  author_id?: string;
  author_name?: string;
  content: string;
  created_at: string;
}

interface AttachmentMeta { name: string; size: number; type: string; url?: string; }

interface Employee { id: string; name: string; designation?: string; department?: string; }

interface Recognition {
  id: string;
  from_employee_id: string;
  to_employee_id: string;
  badge_type: string;
  message: string;
  is_public: boolean;
  post_id?: string;
  created_at: string;
  from_name?: string;
  to_name?: string;
}

interface RsvpCounts { going: number; not_going: number; maybe: number; myRsvp: string | null; }

interface CommunicationsEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
}

interface PostReader {
  id: string;
  post_id: string;
  employee_id: string;
  read_at: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
  employees?: { name: string; profile_picture?: string | null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isPast(iso: string | undefined) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function priorityBadge(priority: string) {
  if (priority === 'high') return 'bg-red-100 text-red-700';
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
}

function audienceLabel(audience: string | undefined) {
  return AUDIENCE_OPTIONS.find((o) => o.value === (audience ?? 'all'))?.label ?? 'All Employees';
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return '🖼';
  if (type === 'application/pdf') return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  return '📎';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

// ─── ICS Calendar helpers ─────────────────────────────────────────────────────

function generateICS(event: CommunicationsEvent): string {
  const startIso = event.start_date ?? event.date ?? new Date().toISOString();
  const start = new Date(startIso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = event.end_date
    ? new Date(event.end_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : start;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HRPortal//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@hrportal`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description ?? '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location ?? ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

function downloadICS(event: CommunicationsEvent) {
  const blob = new Blob([generateICS(event)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${event.title}.ics`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Priority border map ──────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-gray-300',
};

// ─── Video Embed ──────────────────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (ytMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        className="w-full aspect-video rounded-lg mt-3"
        allowFullScreen
        title="YouTube video"
      />
    );
  }
  if (vmMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vmMatch[1]}`}
        className="w-full aspect-video rounded-lg mt-3"
        allowFullScreen
        title="Vimeo video"
      />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline text-sm mt-2 block">
      {url}
    </a>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

interface ModalProps { onClose: () => void; children: React.ReactNode; title: string; }

function Modal({ onClose, children, title }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Attachments Display ──────────────────────────────────────────────────────

function AttachmentsDisplay({ attachments }: { attachments: AttachmentMeta[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-indigo-600 transition-colors"
      >
        <span>📎</span>
        <span>{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
        <span className="text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
              <span className="text-base flex-shrink-0">{fileIcon(att.type)}</span>
              <span className="flex-1 truncate font-medium">{att.name}</span>
              <span className="text-muted-foreground flex-shrink-0">{formatBytes(att.size)}</span>
              {att.url && (
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 flex-shrink-0">
                  ⬇
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Attachment Cards ────────────────────────────────────────────────────

function FileAttachmentCards({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {urls.map((url, i) => {
        const filename = url.split('/').pop() ?? `file-${i + 1}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
        return (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            <span className="text-base flex-shrink-0">{isImage ? '🖼' : '📎'}</span>
            <span className="flex-1 truncate font-medium">{filename}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 flex-shrink-0 text-xs font-medium">
              Download
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ─── Image Grid ───────────────────────────────────────────────────────────────

function ImageGrid({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt="Post image"
        className="mt-3 w-full max-h-64 object-cover rounded-xl"
      />
    );
  }
  return (
    <div className={`mt-3 grid gap-2 ${urls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <img key={i} src={url} alt={`Image ${i + 1}`} className="w-full h-32 object-cover rounded-lg" />
      ))}
    </div>
  );
}

// ─── Create Announcement Modal ────────────────────────────────────────────────

function CreateAnnouncementModal({ onClose, onCreate }: { onClose: () => void; onCreate: (a: any) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('medium');
  const [audience, setAudience] = useState('all');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const { options: departments = [] } = useDepartmentOptions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = ATTACHMENT_TYPES.MAX_FILES - attachments.length;
    if (remaining <= 0) { toast.error(`Maximum ${ATTACHMENT_TYPES.MAX_FILES} files allowed`); return; }
    const toAdd: AttachmentMeta[] = [];
    for (const file of files.slice(0, remaining)) {
      if (file.size > ATTACHMENT_TYPES.MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${ATTACHMENT_TYPES.MAX_SIZE_MB}MB limit`);
        continue;
      }
      toAdd.push({ name: file.name, size: file.size, type: file.type });
    }
    setAttachments((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  const submit = () => {
    if (!title.trim()) { toast.error(t('validation.announcement.title')); return; }
    if (!body.trim()) { toast.error(t('validation.announcement.body')); return; }
    onCreate({ id: crypto.randomUUID(), title, body, priority, audience, attachments });
    onClose();
  };

  return (
    <Modal title={t('communications.announcement.modalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.announcement.labelTitle')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={t('communications.announcement.placeholderTitle')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.announcement.labelBody')}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder={t('communications.announcement.placeholderBody')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.announcement.labelPriority')}</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <SelectOptions entity="communication" field="priority" fallback={['high', 'medium', 'low']} />
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.announcement.labelAudience')}</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <SelectOptions entity="communication" field="audience" fallback={['All Staff', 'Managers', 'New Joiners']} />
            {departments.map((d) => (
              <option key={`dept:${d.value}`} value={`dept:${d.value}`}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('communications.announcement.labelAttachments')}
            <span className="ml-1 text-xs font-normal text-muted-foreground">({attachments.length}/{ATTACHMENT_TYPES.MAX_FILES})</span>
          </label>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs text-foreground">
                  <span>{fileIcon(att.type)}</span>
                  <span className="max-w-[140px] truncate">{att.name}</span>
                  <span className="text-muted-foreground">{formatBytes(att.size)}</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500 ml-0.5">&times;</button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.pptx" onChange={handleFileSelect} className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-border rounded-lg" />
        </div>
        <button onClick={submit} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">{t('communications.announcement.postButton')}</button>
      </div>
    </Modal>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({ onClose, onCreate }: { onClose: () => void; onCreate: (e: any) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');

  const submit = () => {
    if (!title.trim()) { toast.error(t('validation.event.title')); return; }
    if (!date) { toast.error(t('validation.event.date')); return; }
    if (new Date(date) <= new Date()) { toast.error(t('validation.event.date.future')); return; }
    onCreate({ id: crypto.randomUUID(), title, description, date, location });
    onClose();
  };

  return (
    <Modal title={t('communications.event.modalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.event.labelTitle')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={t('communications.event.placeholderTitle')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.event.labelDateTime')}</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.event.labelLocation')}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={t('communications.event.placeholderLocation')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.event.labelDescription')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder={t('communications.event.placeholderDescription')} />
        </div>
        <button onClick={submit} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">{t('communications.event.createButton')}</button>
      </div>
    </Modal>
  );
}

// ─── Create Poll Modal ────────────────────────────────────────────────────────

function CreatePollModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: any) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const addOption = () => setOptions((prev) => [...prev, '']);
  const setOption = (i: number, val: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const submit = () => {
    if (!question.trim()) { toast.error(t('validation.poll.question')); return; }
    const filled = options.filter((o) => o.trim());
    if (filled.length < 2) { toast.error(t('validation.poll.options')); return; }
    onCreate({ id: crypto.randomUUID(), question, options: filled.map((text) => ({ text, votes: 0 })), voters: [] });
    onClose();
  };

  return (
    <Modal title={t('communications.poll.modalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.poll.labelQuestion')}</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={t('communications.poll.placeholderQuestion')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t('communications.poll.labelOptions')}</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <input key={i} value={opt} onChange={(e) => setOption(i, e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={`Option ${i + 1}`} />
            ))}
          </div>
          <button onClick={addOption} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">{t('communications.poll.addOption')}</button>
        </div>
        <button onClick={submit} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">{t('communications.poll.createButton')}</button>
      </div>
    </Modal>
  );
}

// ─── Create Channel Modal ─────────────────────────────────────────────────────

function CreateChannelModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = () => {
    if (!name.trim()) { toast.error(t('validation.channel.name')); return; }
    onCreate({ id: crypto.randomUUID(), name: name.startsWith('#') ? name : `#${name}`, description });
    onClose();
  };

  return (
    <Modal title={t('communications.channel.modalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.channel.labelName')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="#channel-name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.channel.labelDescription')}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={t('communications.channel.placeholderDescription')} />
        </div>
        <button onClick={submit} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">{t('communications.channel.createButton')}</button>
      </div>
    </Modal>
  );
}

// ─── Give Recognition Modal ───────────────────────────────────────────────────

interface GiveRecognitionModalProps {
  onClose: () => void;
  onSubmit: (data: { toEmployeeId: string; badgeType: string; message: string; isPublic: boolean }) => Promise<void>;
  employees: Employee[];
  currentUserId: string;
}

function GiveRecognitionModal({ onClose, onSubmit, employees, currentUserId }: GiveRecognitionModalProps) {
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Employee | null>(null);
  const [badgeType, setBadgeType] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredEmployees = useMemo(() => {
    if (!recipientSearch.trim()) return [];
    return employees
      .filter((e) => e.id !== currentUserId && e.name.toLowerCase().includes(recipientSearch.toLowerCase()))
      .slice(0, 8);
  }, [employees, recipientSearch, currentUserId]);

  const handleSubmit = async () => {
    if (!selectedRecipient) { toast.error(t('communications.recognition.errorRecipient')); return; }
    if (!badgeType) { toast.error(t('communications.recognition.errorBadge')); return; }
    if (message.length < 10 || message.length > 500) { toast.error(t('communications.recognition.errorMessage')); return; }
    setSubmitting(true);
    try {
      await onSubmit({ toEmployeeId: selectedRecipient.id, badgeType, message, isPublic });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={t('communications.recognition.modalTitle')} onClose={onClose}>
      <div className="space-y-4">
        {/* Recipient */}
        <div className="relative">
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.recognition.labelRecipient')}</label>
          {selectedRecipient ? (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <div className="w-7 h-7 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 text-xs font-semibold">
                {selectedRecipient.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-medium text-foreground">{selectedRecipient.name}</span>
              {selectedRecipient.designation && <span className="text-xs text-muted-foreground">{selectedRecipient.designation}</span>}
              <button onClick={() => { setSelectedRecipient(null); setRecipientSearch(''); }} className="text-muted-foreground hover:text-red-500">&times;</button>
            </div>
          ) : (
            <>
              <input
                value={recipientSearch}
                onChange={(e) => { setRecipientSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('communications.recognition.placeholderRecipient')}
              />
              {showDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      onMouseDown={() => { setSelectedRecipient(emp); setRecipientSearch(''); setShowDropdown(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors"
                    >
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                        {emp.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{emp.name}</p>
                        {emp.designation && <p className="text-xs text-muted-foreground">{emp.designation}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Badge Type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t('communications.recognition.labelBadge')}</label>
          <div className="grid grid-cols-2 gap-2">
            {BADGE_TYPES.map((badge) => (
              <button
                key={badge.key}
                onClick={() => setBadgeType(badge.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                  badgeType === badge.key
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium'
                    : 'border-border text-foreground hover:border-indigo-300 hover:bg-muted'
                }`}
              >
                <span className="text-base">{badge.emoji}</span>
                <span className="leading-tight">{badge.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('communications.recognition.labelMessage')}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder={t('communications.recognition.placeholderMessage')}
          />
          <p className={`text-xs mt-0.5 text-right ${message.length < 10 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {message.length} / 500
          </p>
        </div>

        {/* Public toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t('communications.recognition.labelPublic')}</label>
          <button
            onClick={() => setIsPublic((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-indigo-600' : 'bg-muted'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? '...' : t('communications.recognition.submitButton')}
        </button>
      </div>
    </Modal>
  );
}

// ─── @Mention Textarea ────────────────────────────────────────────────────────

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  employees: Employee[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

function MentionTextarea({ value, onChange, employees, placeholder, rows = 3, className = '' }: MentionTextareaProps) {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionResults = useMemo(() => {
    if (!mentionQuery && !showMentionDropdown) return [];
    return employees.filter((e) => e.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);
  }, [mentionQuery, employees, showMentionDropdown]);

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const text = ta.value.substring(0, cursor);
    const atMatch = text.match(/@(\w*)$/);
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setMentionQuery(atMatch[1]);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const selectMention = (emp: Employee) => {
    if (mentionStart < 0) return;
    const before = value.substring(0, mentionStart);
    const after = value.substring(textareaRef.current?.selectionStart ?? mentionStart);
    onChange(`${before}@${emp.name} ${after}`);
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={handleKeyUp}
        onBlur={() => setTimeout(() => setShowMentionDropdown(false), 150)}
        rows={rows}
        className={className}
        placeholder={placeholder}
      />
      {showMentionDropdown && mentionResults.length > 0 && (
        <div className="absolute z-20 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {mentionResults.map((emp) => (
            <button
              key={emp.id}
              onMouseDown={() => selectMention(emp)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors"
            >
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                {emp.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{emp.name}</p>
                {emp.designation && <p className="text-xs text-muted-foreground">{emp.designation}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Post Read Tracker ────────────────────────────────────────────────────────

function PostReadTracker({
  postId,
  acknowledgementRequired,
  alreadyRead,
  alreadyAcknowledged,
  onRead,
  onAcknowledge,
}: {
  postId: string;
  acknowledgementRequired?: boolean;
  alreadyRead: boolean;
  alreadyAcknowledged: boolean;
  onRead: (postId: string) => void;
  onAcknowledge: (postId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (alreadyRead || firedRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timerRef.current = setTimeout(() => {
            if (!firedRef.current) {
              firedRef.current = true;
              onRead(postId);
            }
          }, 3000);
        } else {
          if (timerRef.current) clearTimeout(timerRef.current);
        }
      },
      { threshold: 0.5 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [postId, alreadyRead, onRead]);

  return (
    <div ref={containerRef}>
      {acknowledgementRequired && !alreadyAcknowledged && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => onAcknowledge(postId)}
            className="w-full py-2 text-sm font-medium border-2 border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            {t('communications.post.acknowledge')}
          </button>
        </div>
      )}
      {acknowledgementRequired && alreadyAcknowledged && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
            ✓ {t('communications.post.acknowledged')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Readers Drawer ───────────────────────────────────────────────────────────

interface ReadersDrawerProps {
  postId: string;
  postTitle: string;
  audienceSize?: number;
  onClose: () => void;
}

function ReadersDrawer({ postId, postTitle, audienceSize, onClose }: ReadersDrawerProps) {
  const [readers, setReaders] = useState<PostReader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('communications_post_reads')
      .select('*, employees(name, profile_picture)')
      .eq('post_id', postId)
      .order('read_at', { ascending: false })
      .then(({ data }) => {
        setReaders((data as PostReader[]) ?? []);
        setLoading(false);
      });
  }, [postId]);

  const readCount = readers.length;
  const ackCount = readers.filter((r) => r.acknowledged).length;
  const totalAudience = audienceSize ?? readCount;
  const pct = totalAudience > 0 ? Math.min(100, Math.round((readCount / totalAudience) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('communications.viewReaders')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{postTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
        </div>

        {/* Progress */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground font-medium">{readCount} / {totalAudience} readers</span>
            <span className="text-sm font-semibold text-indigo-600">{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {ackCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{ackCount} acknowledged</p>
          )}
        </div>

        {/* Reader list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : readers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No reads yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {readers.map((r) => {
                const name = r.employees?.name ?? r.employee_id;
                const initials = name[0]?.toUpperCase() ?? '?';
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                      {r.employees?.profile_picture ? (
                        <img src={r.employees.profile_picture} className="w-full h-full rounded-full object-cover" alt={name} />
                      ) : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.read_at)}</p>
                    </div>
                    {r.acknowledged && (
                      <span className="flex-shrink-0 text-xs bg-green-50 text-green-700 font-medium px-2 py-0.5 rounded-full">
                        ✓ Ack
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = ['Feed', 'Announcements', 'Events', 'Polls', 'Recognition', 'Channels', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

function tabLabel(tab: Tab): string {
  const map: Record<Tab, string> = {
    Feed: t('communications.tab.feed'),
    Announcements: t('communications.tab.announcements'),
    Events: t('communications.tab.events'),
    Polls: t('communications.tab.polls'),
    Recognition: t('communications.tab.recognition'),
    Channels: t('communications.tab.channels'),
    Analytics: t('communications.tab.analytics'),
  };
  return map[tab];
}

// ─── RSVP Button Group ────────────────────────────────────────────────────────

interface RsvpButtonsProps {
  eventId: string;
  counts: RsvpCounts;
  isPast: boolean;
  onRsvp: (eventId: string, status: 'going' | 'not_going' | 'maybe') => void;
}

function RsvpButtons({ eventId, counts, isPast: past, onRsvp }: RsvpButtonsProps) {
  if (past) {
    return (
      <p className="text-xs text-muted-foreground italic mt-2">{t('communications.event.rsvp.past')}</p>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex gap-2">
        {(['going', 'not_going', 'maybe'] as const).map((status) => {
          const labels: Record<string, string> = {
            going: t('communications.event.rsvp.going'),
            not_going: t('communications.event.rsvp.notGoing'),
            maybe: t('communications.event.rsvp.maybe'),
          };
          const active = counts.myRsvp === status;
          const colors: Record<string, string> = {
            going: active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-300',
            not_going: active ? 'bg-gray-600 text-white border-gray-600' : 'border-border text-muted-foreground hover:border-gray-400',
            maybe: active ? 'bg-amber-500 text-white border-amber-500' : 'border-border text-muted-foreground hover:border-amber-300',
          };
          const count = status === 'going' ? counts.going : status === 'not_going' ? counts.not_going : counts.maybe;
          return (
            <button
              key={status}
              onClick={() => onRsvp(eventId, status)}
              className={`flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-xs font-medium transition-colors ${colors[status]}`}
            >
              {labels[status]} {count > 0 && <span className="ml-0.5 opacity-80">({count})</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {counts.going} going · {counts.maybe} maybe · {counts.not_going} not going
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { accessToken?: string; onLogout?: () => void; }

export function InternalCommunicationsHub(_props: Props) {
  const { currentUser } = useUser();
  const {
    posts, announcements, polls, events, channels,
    loading,
    createPost, deletePost, updatePost,
    createAnnouncement, updateAnnouncement, deleteAnnouncement,
    createEvent, deleteEvent,
    createPoll, vote,
    createChannel,
    refresh,
  } = useCommunicationsData();

  const userId = currentUser?.id;
  const canSendAnnouncements = useSectionPermission('communications', 'create');
  const canManageChannels = useSectionPermission('communications', 'manage_channels');
  const canViewAnalytics = useSectionPermission('communications', 'view');

  // ── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('Feed');
  const [postContent, setPostContent] = useState('');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showRecognitionModal, setShowRecognitionModal] = useState(false);

  // ── Employees ────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    supabase.from('employees').select('id, name, designation, department').then(({ data }) => {
      if (data) setEmployees(data as Employee[]);
    });
  }, []);

  // ── Employee name lookup ─────────────────────────────────────────────────
  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[e.id] = e.name;
    return m;
  }, [employees]);

  // ── Recognitions ─────────────────────────────────────────────────────────
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [recFilter, setRecFilter] = useState<'all' | 'given' | 'received' | 'team'>('all');

  const loadRecognitions = useCallback(async () => {
    const { data } = await supabase
      .from('communications_recognitions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setRecognitions(data as Recognition[]);
  }, []);

  useEffect(() => {
    loadRecognitions();
  }, [loadRecognitions]);

  const filteredRecognitions = useMemo(() => {
    if (!userId) return recognitions;
    if (recFilter === 'given') return recognitions.filter((r) => r.from_employee_id === userId);
    if (recFilter === 'received') return recognitions.filter((r) => r.to_employee_id === userId);
    if (recFilter === 'team') {
      const myDept = currentUser?.department;
      if (!myDept) return recognitions;
      return recognitions.filter((r) => {
        const fromEmp = employees.find((e) => e.id === r.from_employee_id);
        const toEmp = employees.find((e) => e.id === r.to_employee_id);
        return fromEmp?.department === myDept || toEmp?.department === myDept;
      });
    }
    return recognitions;
  }, [recognitions, recFilter, userId, employees, currentUser]);

  // Leaderboard
  const thisMonthRecognitions = useMemo(() => {
    const now = new Date();
    return recognitions.filter((r) => {
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [recognitions]);

  const topRecognizers = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of thisMonthRecognitions) counts[r.from_employee_id] = (counts[r.from_employee_id] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count, name: empMap[id] ?? id }));
  }, [thisMonthRecognitions, empMap]);

  const topRecognized = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of thisMonthRecognitions) counts[r.to_employee_id] = (counts[r.to_employee_id] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count, name: empMap[id] ?? id }));
  }, [thisMonthRecognitions, empMap]);

  const handleGiveRecognition = useCallback(async (data: { toEmployeeId: string; badgeType: string; message: string; isPublic: boolean }) => {
    if (!userId) return;
    if (data.toEmployeeId === userId) { toast.error(t('communications.recognition.errorSelf')); return; }
    const rec = {
      from_employee_id: userId,
      to_employee_id: data.toEmployeeId,
      badge_type: data.badgeType,
      message: data.message,
      is_public: data.isPublic,
    };
    const { error } = await supabase.from('communications_recognitions').insert([rec]);
    if (error) { toast.error(error.message); return; }
    toast.success(t('communications.recognition.success'));
    await loadRecognitions();
    // Notify recipient
    void supabase.from('notifications').insert([{
      recipient_id: data.toEmployeeId,
      type: 'recognition_received',
      title: 'You received recognition!',
      message: `${currentUser?.name ?? 'Someone'} recognized you with ${badgeInfo(data.badgeType).label}`,
      is_read: false,
      created_at: new Date().toISOString(),
    }]);
  }, [userId, currentUser, loadRecognitions]);

  // ── RSVP ────────────────────────────────────────────────────────────────
  const [rsvpData, setRsvpData] = useState<Record<string, RsvpCounts>>({});

  const loadRsvps = useCallback(async (eventIds: string[]) => {
    if (!eventIds.length) return;
    const { data } = await supabase
      .from('communications_event_rsvps')
      .select('event_id, user_id, status')
      .in('event_id', eventIds);
    if (!data) return;
    const result: Record<string, RsvpCounts> = {};
    for (const eid of eventIds) {
      const rows = data.filter((r: any) => r.event_id === eid);
      result[eid] = {
        going: rows.filter((r: any) => r.status === 'going').length,
        not_going: rows.filter((r: any) => r.status === 'not_going').length,
        maybe: rows.filter((r: any) => r.status === 'maybe').length,
        myRsvp: rows.find((r: any) => r.user_id === userId)?.status ?? null,
      };
    }
    setRsvpData((prev) => ({ ...prev, ...result }));
  }, [userId]);

  useEffect(() => {
    if (events.length > 0) loadRsvps(events.map((e: any) => e.id));
  }, [events, loadRsvps]);

  const handleRsvp = useCallback(async (eventId: string, status: 'going' | 'not_going' | 'maybe') => {
    if (!userId) return;
    // Optimistic update
    setRsvpData((prev) => {
      const cur = prev[eventId] ?? { going: 0, not_going: 0, maybe: 0, myRsvp: null };
      const updated = { ...cur };
      if (cur.myRsvp) {
        updated[cur.myRsvp as 'going' | 'not_going' | 'maybe'] = Math.max(0, updated[cur.myRsvp as 'going' | 'not_going' | 'maybe'] - 1);
      }
      if (cur.myRsvp !== status) {
        updated[status] += 1;
        updated.myRsvp = status;
      } else {
        updated.myRsvp = null;
      }
      return { ...prev, [eventId]: updated };
    });
    void supabase.from('communications_event_rsvps').upsert([{ event_id: eventId, user_id: userId, status }], { onConflict: 'event_id,user_id' });
    toast.success(t('communications.event.rsvp.saved'));
  }, [userId]);

  // ── Post Read Tracking ───────────────────────────────────────────────────
  const [readPostIds, setReadPostIds] = useState<Set<string>>(new Set());
  const [acknowledgedPostIds, setAcknowledgedPostIds] = useState<Set<string>>(new Set());

  const handlePostRead = useCallback((postId: string) => {
    if (!userId || readPostIds.has(postId)) return;
    setReadPostIds((prev) => new Set([...prev, postId]));
    void supabase.from('communications_post_reads').upsert([{
      post_id: postId,
      employee_id: userId,
      read_at: new Date().toISOString(),
    }], { onConflict: 'post_id,employee_id' });
  }, [userId, readPostIds]);

  const handleAcknowledge = useCallback(async (postId: string) => {
    if (!userId) return;
    const now = new Date().toISOString();
    setAcknowledgedPostIds((prev) => new Set([...prev, postId]));
    await supabase.from('communications_post_reads').upsert([{
      post_id: postId,
      employee_id: userId,
      read_at: now,
      acknowledged: true,
      acknowledged_at: now,
    }], { onConflict: 'post_id,employee_id' });
  }, [userId]);

  // ── Scheduled Posts ──────────────────────────────────────────────────────
  const publishScheduled = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('communications_posts')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);
    if (data && data.length > 0) {
      for (const p of data) {
        void supabase.from('communications_posts').update({ status: 'published', published_at: now }).eq('id', p.id);
      }
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    publishScheduled();
    const interval = setInterval(publishScheduled, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [publishScheduled]);

  const scheduledPosts = useMemo(() => posts.filter((p: any) => p.status === 'scheduled'), [posts]);

  // ── Post Composer State ──────────────────────────────────────────────────
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (postId: string, files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const path = `${postId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('communications-attachments').upload(path, file);
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data: urlData } = supabase.storage.from('communications-attachments').getPublicUrl(data.path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  }, []);

  const parseMentions = (content: string): string[] => {
    const mentions: string[] = [];
    const re = /@(\w[\w\s]*?)(?=\s|$|@)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1].trim();
      const emp = employees.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (emp) mentions.push(emp.id);
    }
    return [...new Set(mentions)];
  };

  const handlePost = useCallback(async () => {
    if (!postContent.trim()) { toast.error(t('validation.post.content')); return; }
    if (scheduleEnabled) {
      if (!scheduledAt) { toast.error(t('validation.post.scheduledAt')); return; }
      const minTime = new Date(Date.now() + 30 * 60 * 1000);
      if (new Date(scheduledAt) < minTime) { toast.error(t('validation.post.scheduledAt')); return; }
    }

    setUploading(true);
    try {
      const postId = crypto.randomUUID();
      let fileUrls: string[] = [];
      if (composerFiles.length > 0) {
        fileUrls = await uploadFiles(postId, composerFiles);
      }

      const mentionedIds = parseMentions(postContent);

      const imageUrls = fileUrls.filter((u) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u));
      const docUrls = fileUrls.filter((u) => !imageUrls.includes(u));

      if (scheduleEnabled) {
        const { error } = await supabase.from('communications_posts').insert([{
          id: postId,
          content: postContent.trim(),
          author_id: userId,
          author_name: currentUser?.name ?? 'Unknown',
          status: 'scheduled',
          scheduled_at: new Date(scheduledAt).toISOString(),
          image_urls: imageUrls,
          file_attachment_urls: docUrls,
        }]);
        if (error) throw error;
        toast.success(`Post scheduled for ${formatDateTime(scheduledAt)}`);
      } else {
        await createPost(postContent.trim());
        // Update with file URLs if any
        if (fileUrls.length > 0) {
          void supabase.from('communications_posts')
            .update({ image_urls: imageUrls, file_attachment_urls: docUrls })
            .eq('author_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      }

      // Insert mentions
      if (mentionedIds.length > 0) {
        const mentionRows = mentionedIds.map((mid) => ({ post_id: postId, mentioned_employee_id: mid }));
        void supabase.from('communications_post_mentions').insert(mentionRows);
        // Notify mentioned employees
        for (const mid of mentionedIds) {
          void supabase.from('notifications').insert([{
            recipient_id: mid,
            type: 'post_mention',
            title: 'You were mentioned in a post',
            message: `${currentUser?.name ?? 'Someone'} mentioned you in a post`,
            is_read: false,
            created_at: new Date().toISOString(),
          }]);
        }
      }

      setPostContent('');
      setComposerFiles([]);
      setScheduleEnabled(false);
      setScheduledAt('');
      setComposerExpanded(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to post');
    } finally {
      setUploading(false);
    }
  }, [postContent, scheduleEnabled, scheduledAt, composerFiles, userId, currentUser, createPost, uploadFiles, refresh, employees]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const MAX = 5;
    const remaining = MAX - composerFiles.length;
    if (remaining <= 0) { toast.error('Maximum 5 files allowed'); return; }
    const toAdd: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} exceeds 10MB`); continue; }
      toAdd.push(file);
    }
    setComposerFiles((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Emoji reactions ──────────────────────────────────────────────────────
  type ReactionType = 'like' | 'love' | 'celebrate';
  const REACTION_EMOJIS: Record<ReactionType, string> = { like: '👍', love: '❤️', celebrate: '🎉' };
  const [rxnCounts, setRxnCounts] = useState<Record<string, Record<ReactionType, number>>>({});
  const [userRxns, setUserRxns] = useState<Record<string, ReactionType | null>>({});

  const loadReactions = useCallback(async (announcementId: string) => {
    try {
      const res = await fetch(`${COMMS_API}/announcements/${announcementId}/reactions?userId=${userId ?? ''}`, {
        headers: { apikey: publicAnonKey },
      });
      const json = await safeJson(res);
      if (json.success) {
        setRxnCounts((prev) => ({ ...prev, [announcementId]: json.counts }));
        setUserRxns((prev) => ({ ...prev, [announcementId]: json.userReaction }));
      }
    } catch { /* ignore */ }
  }, [userId]);

  function getRxnCounts(postId: string): Record<ReactionType, number> {
    return rxnCounts[postId] ?? { like: 0, love: 0, celebrate: 0 };
  }
  function getUserRxn(postId: string): ReactionType | null {
    return userRxns[postId] ?? null;
  }

  const toggleReaction = useCallback(async (postId: string, type: ReactionType) => {
    const current = getUserRxn(postId);
    const counts = { ...getRxnCounts(postId) };
    if (current === type) {
      counts[type] = Math.max(0, (counts[type] ?? 0) - 1);
      setUserRxns((prev) => ({ ...prev, [postId]: null }));
    } else {
      if (current) counts[current] = Math.max(0, (counts[current] ?? 0) - 1);
      counts[type] = (counts[type] ?? 0) + 1;
      setUserRxns((prev) => ({ ...prev, [postId]: type }));
    }
    setRxnCounts((prev) => ({ ...prev, [postId]: counts }));
    try {
      await fetch(`${COMMS_API}/announcements/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: publicAnonKey },
        body: JSON.stringify({ userId, type }),
      });
    } catch { /* optimistic */ }
  }, [userId, rxnCounts, userRxns]);

  // ── Announcement comments ────────────────────────────────────────────────
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<Record<string, AnnouncementComment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  const fetchComments = useCallback(async (announcementId: string) => {
    if (loadedRef.current.has(announcementId)) return;
    loadedRef.current.add(announcementId);
    try {
      const res = await fetch(`${COMMS_API}/announcements/${announcementId}/comments`, {
        headers: { apikey: publicAnonKey },
      });
      const json = await safeJson(res);
      setCommentsCache((prev) => ({ ...prev, [announcementId]: json.data ?? [] }));
    } catch {
      setCommentsCache((prev) => ({ ...prev, [announcementId]: [] }));
    }
  }, []);

  const toggleComments = useCallback((id: string) => {
    setExpandedComments((prev) => {
      const next = !prev[id];
      if (next) fetchComments(id);
      return { ...prev, [id]: next };
    });
  }, [fetchComments]);

  const postComment = useCallback(async (announcementId: string) => {
    const content = (commentInput[announcementId] ?? '').trim();
    if (!content) return;
    setCommentPosting((prev) => ({ ...prev, [announcementId]: true }));
    try {
      const res = await fetch(`${COMMS_API}/announcements/${announcementId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: publicAnonKey },
        body: JSON.stringify({ authorId: currentUser?.id, authorName: currentUser?.name ?? 'You', content }),
      });
      const json = await safeJson(res);
      const newComment: AnnouncementComment = json.data ?? {
        id: crypto.randomUUID(),
        announcement_id: announcementId,
        author_id: currentUser?.id,
        author_name: currentUser?.name ?? 'You',
        content,
        created_at: new Date().toISOString(),
      };
      setCommentsCache((prev) => ({ ...prev, [announcementId]: [...(prev[announcementId] ?? []), newComment] }));
      setCommentInput((prev) => ({ ...prev, [announcementId]: '' }));
    } catch {
      toast.error(t('communications.toast.failedComment'));
    } finally {
      setCommentPosting((prev) => ({ ...prev, [announcementId]: false }));
    }
  }, [commentInput, currentUser]);

  const rxnLoadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!announcements?.length) return;
    for (const a of announcements) {
      if (!rxnLoadedRef.current.has(a.id)) {
        rxnLoadedRef.current.add(a.id);
        loadReactions(a.id);
      }
    }
  }, [announcements, loadReactions]);

  // ── Pinned post toggle ───────────────────────────────────────────────────
  const togglePinPost = useCallback(async (postId: string, currentPinned: boolean) => {
    void supabase.from('communications_posts').update({ is_pinned: !currentPinned }).eq('id', postId);
    updatePost(postId, { is_pinned: !currentPinned });
    toast.success(currentPinned ? t('communications.unpinnedToast') : t('communications.pinnedToast'));
  }, [updatePost]);

  const handleLike = (post: any) => {
    updatePost(post.id, { likes: (post.likes ?? 0) + 1 });
  };

  // ── Events view toggle & calendar navigation ─────────────────────────────
  const [eventsView, setEventsView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedEventDetail, setSelectedEventDetail] = useState<any | null>(null);

  // ── RSVP going avatars ───────────────────────────────────────────────────
  const [goingAvatars, setGoingAvatars] = useState<Record<string, any[]>>({});
  useEffect(() => {
    if (activeTab !== 'Events' || events.length === 0) return;
    for (const ev of events) {
      supabase
        .from('communications_event_rsvps')
        .select('*, employees(name, profile_picture)')
        .eq('event_id', (ev as any).id)
        .eq('status', 'going')
        .limit(6)
        .then(({ data }) => {
          if (data) setGoingAvatars((prev) => ({ ...prev, [(ev as any).id]: data }));
        });
    }
  }, [activeTab, events]);

  // ── Readers drawer ───────────────────────────────────────────────────────
  const [readersDrawerPost, setReadersDrawerPost] = useState<{ id: string; title: string; audience_size?: number } | null>(null);

  // ── Real analytics read rate ─────────────────────────────────────────────
  const [readRateTrend, setReadRateTrend] = useState<{ week: string; readRate: number }[]>([]);
  useEffect(() => {
    if (activeTab !== 'Analytics') return;
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 3600 * 1000).toISOString();
    supabase
      .from('communications_posts')
      .select('read_count, created_at, audience_size')
      .gte('created_at', eightWeeksAgo)
      .then(({ data }) => {
        const now = new Date();
        const buckets: Record<string, { total: number; count: number }> = {};
        for (let i = 7; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i * 7);
          const key = `W${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          buckets[key] = { total: 0, count: 0 };
        }
        for (const p of data ?? []) {
          const d = new Date((p as any).created_at);
          const daysAgo = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
          if (daysAgo >= 0 && daysAgo < 8) {
            const weekD = new Date(now);
            weekD.setDate(weekD.getDate() - daysAgo * 7);
            const key = `W${weekD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            if (buckets[key]) {
              const audience = (p as any).audience_size ?? 100;
              const rate = Math.min(100, Math.round(((p as any).read_count ?? 0) / audience * 100));
              buckets[key].total += rate;
              buckets[key].count += 1;
            }
          }
        }
        setReadRateTrend(
          Object.entries(buckets).map(([week, { total, count }]) => ({
            week,
            readRate: count > 0 ? Math.round(total / count) : 0,
          }))
        );
      });
  }, [activeTab]);

  // ── Analytics data ───────────────────────────────────────────────────────
  const postsPerWeek = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = `W${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weeks[key] = 0;
    }
    for (const p of [...posts, ...announcements]) {
      const d = new Date((p as any).created_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
      if (daysAgo >= 0 && daysAgo < 8) {
        const weekD = new Date(now);
        weekD.setDate(weekD.getDate() - daysAgo * 7);
        const key = `W${weekD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        if (weeks[key] !== undefined) weeks[key]++;
      }
    }
    return Object.entries(weeks).map(([week, count]) => ({ week, count }));
  }, [posts, announcements]);

  const rsvpChartData = useMemo(() => {
    let going = 0, notGoing = 0, maybe = 0;
    for (const counts of Object.values(rsvpData)) {
      going += counts.going;
      notGoing += counts.not_going;
      maybe += counts.maybe;
    }
    return [
      { name: t('communications.event.rsvp.going'), value: going, color: '#6366f1' },
      { name: t('communications.event.rsvp.notGoing'), value: notGoing, color: '#9ca3af' },
      { name: t('communications.event.rsvp.maybe'), value: maybe, color: '#f59e0b' },
    ].filter((d) => d.value > 0);
  }, [rsvpData]);

  const topReadPosts = useMemo(() => {
    return [...announcements]
      .sort((a: any, b: any) => (b.read_count ?? 0) - (a.read_count ?? 0))
      .slice(0, 5)
      .map((p: any) => ({ name: (p.title ?? '').slice(0, 30), reads: p.read_count ?? 0 }));
  }, [announcements]);

  const recognitionChartData = useMemo(() => {
    return topRecognized.map((r) => ({ name: r.name.split(' ')[0], times: r.count }));
  }, [topRecognized]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">{t('communications.title')}</span>
            </div>
            <button onClick={refresh} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('communications.refresh')}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.filter((tab) => tab !== 'Analytics' || canViewAnalytics).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════
                FEED TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Feed' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Composer */}
                <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
                  <div onClick={() => setComposerExpanded(true)}>
                    <MentionTextarea
                      value={postContent}
                      onChange={setPostContent}
                      employees={employees}
                      rows={composerExpanded ? 4 : 2}
                      placeholder={t('communications.post.placeholder')}
                      className="w-full text-sm text-foreground resize-none focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {composerExpanded && (
                    <div className="mt-3 space-y-3">
                      {/* File previews */}
                      {composerFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {composerFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs">
                              <span>{fileIcon(f.type)}</span>
                              <span className="max-w-[120px] truncate">{f.name}</span>
                              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                              <button onClick={() => setComposerFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500">&times;</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Schedule picker */}
                      {scheduleEnabled && (
                        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">{t('communications.post.scheduledFor')}</span>
                          <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)}
                            className="flex-1 text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-card"
                          />
                        </div>
                      )}

                      {/* Toolbar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Attach */}
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm"
                            title={t('communications.post.attachFile')}
                          >
                            📎
                          </button>
                          {/* Schedule */}
                          <button
                            onClick={() => setScheduleEnabled((v) => !v)}
                            className={`p-1.5 rounded-lg transition-colors text-sm ${scheduleEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title={t('communications.post.scheduleToggle')}
                          >
                            🗓
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xlsx,.pptx"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <span className="text-xs text-muted-foreground ml-1">
                            {postContent.length} / 5000
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setComposerExpanded(false); setPostContent(''); setComposerFiles([]); setScheduleEnabled(false); }}
                            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={handlePost}
                            disabled={!postContent.trim() || uploading}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {uploading ? t('communications.post.uploading') : scheduleEnabled ? t('communications.post.scheduleToggle') : t('communications.post.button')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!composerExpanded && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => { if (postContent.trim()) handlePost(); else setComposerExpanded(true); }}
                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        {t('communications.post.button')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Scheduled posts (admin/author view) */}
                {scheduledPosts.length > 0 && (
                  <details className="bg-card rounded-2xl border border-border shadow-sm">
                    <summary className="px-5 py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none">
                      🗓 {t('communications.post.scheduledPosts')} ({scheduledPosts.length})
                    </summary>
                    <div className="p-4 pt-0 space-y-2">
                      {scheduledPosts.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                          <p className="text-foreground truncate flex-1">{p.content}</p>
                          <span className="text-xs text-muted-foreground ml-3 flex-shrink-0">
                            {formatDateTime(p.scheduled_at)}
                          </span>
                          <button
                            onClick={() => deletePost(p.id)}
                            className="ml-2 text-red-400 hover:text-red-600 text-xs"
                          >
                            {t('communications.post.cancelSchedule')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Posts list */}
                {posts.filter((p: any) => p.status !== 'scheduled').length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-lg font-medium">{t('communications.post.empty')}</p>
                    <p className="text-sm mt-1">{t('communications.post.emptyHint')}</p>
                  </div>
                ) : (
                  (() => {
                    const publishedPosts = posts.filter((p: any) => p.status !== 'scheduled');
                    const pinned = publishedPosts.filter((p: any) => p.is_pinned);
                    const regular = publishedPosts.filter((p: any) => !p.is_pinned);

                    const renderPost = (post: any) => (
                      <div
                        key={post.id}
                        className={`group rounded-2xl shadow-sm border p-5 ${
                          post.is_pinned
                            ? 'bg-purple-50 border-purple-200'
                            : 'bg-card border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                              {(post.author_name ?? 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{post.author_name ?? 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(post.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {post.is_pinned && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                📌 {t('communications.pinned')}
                              </span>
                            )}
                            {canSendAnnouncements && (
                              <button
                                onClick={() => togglePinPost(post.id, post.is_pinned)}
                                className="sm:opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-700 transition-opacity text-sm px-1.5 py-1 rounded"
                                title={post.is_pinned ? t('communications.unpin') : t('communications.pin')}
                              >
                                📌
                              </button>
                            )}
                            {(canSendAnnouncements || post.author_id === userId) && (
                              <button
                                onClick={() => deletePost(post.id)}
                                className="sm:opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs px-2 py-1 rounded hover:bg-red-50"
                              >
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>

                        {/* Video embed */}
                        {post.video_url && <VideoEmbed url={post.video_url} />}

                        {/* Images */}
                        {Array.isArray(post.image_urls) && post.image_urls.length > 0 && (
                          <ImageGrid urls={post.image_urls} />
                        )}

                        {/* File attachments */}
                        {Array.isArray(post.file_attachment_urls) && post.file_attachment_urls.length > 0 && (
                          <FileAttachmentCards urls={post.file_attachment_urls} />
                        )}

                        {/* Like button */}
                        <div className="mt-4 flex items-center gap-4 pt-3 border-t border-gray-50">
                          <button
                            onClick={() => handleLike(post)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {post.likes ?? 0}
                          </button>
                        </div>

                        {/* Read tracking */}
                        <PostReadTracker
                          postId={post.id}
                          acknowledgementRequired={post.acknowledgement_required}
                          alreadyRead={readPostIds.has(post.id)}
                          alreadyAcknowledged={acknowledgedPostIds.has(post.id)}
                          onRead={handlePostRead}
                          onAcknowledge={handleAcknowledge}
                        />
                      </div>
                    );

                    return (
                      <>
                        {pinned.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide px-1">📌 {t('communications.pinned')}</p>
                            {pinned.map(renderPost)}
                          </div>
                        )}
                        {regular.length > 0 && (
                          <div className="space-y-3">
                            {pinned.length > 0 && (
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{t('communications.recent')}</p>
                            )}
                            {regular.map(renderPost)}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                ANNOUNCEMENTS TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Announcements' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {canSendAnnouncements && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowAnnouncementModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <span>+</span> {t('communications.announcement.newButton')}
                    </button>
                  </div>
                )}

                {announcements.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-lg font-medium">{t('communications.announcement.empty')}</p>
                  </div>
                ) : (
                  (() => {
                    const pinned = announcements.filter((a: any) => a.pinned);
                    const regular = announcements.filter((a: any) => !a.pinned);

                    const renderCard = (a: any) => {
                      const counts = getRxnCounts(a.id);
                      const myRxn = getUserRxn(a.id);
                      const isPinned = !!a.pinned;
                      const priorityKey = a.priority ?? 'medium';
                      const borderColor = isPinned
                        ? 'border-l-amber-400'
                        : (PRIORITY_BORDER[priorityKey] ?? 'border-l-gray-300');
                      return (
                        <div
                          key={a.id}
                          className={`group rounded-2xl shadow-sm border border-l-4 p-5 ${
                            isPinned
                              ? `bg-amber-50 border-amber-200 ${borderColor}`
                              : `bg-card border-border ${borderColor}`
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isPinned && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                                    📌 {t('communications.pinned')}
                                  </span>
                                )}
                                <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge(priorityKey)}`}>
                                  {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {audienceLabel(a.audience)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {canSendAnnouncements && (
                                <button
                                  onClick={() => setReadersDrawerPost({ id: a.id, title: a.title, audience_size: a.audience_size })}
                                  className="sm:opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 transition-opacity text-xs px-2 py-1 rounded hover:bg-indigo-50"
                                >
                                  {t('communications.viewReaders')}
                                </button>
                              )}
                              {canSendAnnouncements && (
                                <button
                                  onClick={() => {
                                    updateAnnouncement(a.id, { pinned: !a.pinned });
                                    toast.success(a.pinned ? t('communications.unpinnedToast') : t('communications.pinnedToast'));
                                  }}
                                  title={a.pinned ? t('communications.unpin') : t('communications.pin')}
                                  className="sm:opacity-0 group-hover:opacity-100 text-amber-500 hover:text-amber-700 transition-opacity text-sm px-2 py-1 rounded hover:bg-amber-50"
                                >
                                  📌
                                </button>
                              )}
                              {canSendAnnouncements && (
                                <button
                                  onClick={() => deleteAnnouncement(a.id)}
                                  className="sm:opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs px-2 py-1 rounded hover:bg-red-50"
                                >
                                  {t('common.delete')}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a.body}</p>

                          {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                            <AttachmentsDisplay attachments={a.attachments} />
                          )}

                          {/* Emoji reactions */}
                          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                            {(Object.entries(REACTION_EMOJIS) as [ReactionType, string][]).map(([type, emoji]) => {
                              const count = counts[type] ?? 0;
                              const active = myRxn === type;
                              return (
                                <button
                                  key={type}
                                  onClick={() => toggleReaction(a.id, type)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
                                    active
                                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                                      : 'border-border text-muted-foreground hover:border-border hover:bg-muted'
                                  }`}
                                >
                                  {emoji} {count > 0 && <span>{count}</span>}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => toggleComments(a.id)}
                              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border text-muted-foreground hover:bg-muted transition-colors"
                            >
                              💬 {(commentsCache[a.id] ?? []).length} comment{(commentsCache[a.id] ?? []).length !== 1 ? 's' : ''}
                            </button>
                          </div>

                          {/* Acknowledgement */}
                          <PostReadTracker
                            postId={a.id}
                            acknowledgementRequired={a.acknowledgement_required}
                            alreadyRead={readPostIds.has(a.id)}
                            alreadyAcknowledged={acknowledgedPostIds.has(a.id)}
                            onRead={handlePostRead}
                            onAcknowledge={handleAcknowledge}
                          />

                          {/* Comments */}
                          {expandedComments[a.id] && (
                            <div className="border-t border-border pt-2 mt-2 space-y-2">
                              {(commentsCache[a.id] ?? []).length === 0 && (
                                <p className="text-xs text-muted-foreground px-1">{t('communications.comment.empty')}</p>
                              )}
                              {(commentsCache[a.id] ?? []).map((comment) => (
                                <div key={comment.id} className="flex items-start gap-2">
                                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                                    {(comment.author_name ?? 'U')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 bg-muted rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-foreground">{comment.author_name ?? 'User'}</span>
                                      <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                                    </div>
                                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-start gap-2 pt-1">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                                  {(currentUser?.name ?? 'U')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 flex gap-2">
                                  <textarea
                                    rows={1}
                                    value={commentInput[a.id] ?? ''}
                                    onChange={(e) => setCommentInput((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(a.id); } }}
                                    placeholder={t('communications.comment.placeholder')}
                                    className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                  />
                                  <button
                                    onClick={() => postComment(a.id)}
                                    disabled={commentPosting[a.id] || !(commentInput[a.id] ?? '').trim()}
                                    className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                  >
                                    {t('communications.post.button')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {pinned.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">📌 {t('communications.pinned')}</p>
                            {pinned.map(renderCard)}
                          </div>
                        )}
                        {regular.length > 0 && (
                          <div className="space-y-3">
                            {pinned.length > 0 && (
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{t('communications.recent')}</p>
                            )}
                            {regular.map(renderCard)}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                EVENTS TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Events' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* View toggle */}
                  <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                    <button
                      onClick={() => setEventsView('list')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${eventsView === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t('communications.eventsListView')}
                    </button>
                    <button
                      onClick={() => setEventsView('calendar')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${eventsView === 'calendar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t('communications.eventsCalendarView')}
                    </button>
                  </div>
                  {canManageChannels && (
                    <button
                      onClick={() => setShowEventModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <span>+</span> {t('communications.event.newButton')}
                    </button>
                  )}
                </div>

                {events.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-lg font-medium">{t('communications.event.empty')}</p>
                  </div>
                ) : eventsView === 'calendar' ? (
                  (() => {
                    const year = calendarDate.getFullYear();
                    const month = calendarDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
                      i < firstDay ? null : i - firstDay + 1
                    );
                    // pad to complete last row
                    while (cells.length % 7 !== 0) cells.push(null);

                    const eventsOnDay = (day: number) => {
                      return events.filter((ev: any) => {
                        const d = new Date(ev.date ?? ev.start_date ?? '');
                        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
                      });
                    };

                    return (
                      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                        {/* Month nav */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                          <button
                            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                            className="text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                          >
                            ‹
                          </button>
                          <h3 className="text-sm font-semibold text-foreground">
                            {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </h3>
                          <button
                            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                            className="text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                          >
                            ›
                          </button>
                        </div>
                        {/* Day headers */}
                        <div className="grid grid-cols-7 border-b border-border">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                          ))}
                        </div>
                        {/* Day cells */}
                        <div className="grid grid-cols-7">
                          {cells.map((day, idx) => {
                            const dayEvents = day ? eventsOnDay(day) : [];
                            const isToday = day !== null && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                            return (
                              <div
                                key={idx}
                                className={`min-h-[72px] p-1.5 border-r border-b border-border text-xs ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                              >
                                {day && (
                                  <>
                                    <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-muted-foreground'}`}>
                                      {day}
                                    </span>
                                    <div className="space-y-0.5">
                                      {(dayEvents as any[]).map((ev: any) => (
                                        <button
                                          key={ev.id}
                                          onClick={() => setSelectedEventDetail(ev)}
                                          className="w-full text-left truncate bg-indigo-100 text-indigo-700 rounded px-1 py-0.5 text-[10px] font-medium hover:bg-indigo-200 transition-colors"
                                        >
                                          {ev.title}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (events as any[]).map((ev: any) => {
                    const past = isPast(ev.date);
                    const rsvp = rsvpData[ev.id] ?? { going: 0, not_going: 0, maybe: 0, myRsvp: null };
                    const avatars = goingAvatars[ev.id] ?? [];
                    return (
                      <div key={ev.id} className={`group bg-card rounded-2xl shadow-sm border p-5 ${past ? 'opacity-60 border-border' : 'border-border'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-4 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 rounded-xl flex flex-col items-center justify-center">
                              <span className="text-xs font-medium text-indigo-500 uppercase">
                                {ev.date ? new Date(ev.date).toLocaleString('en-US', { month: 'short' }) : '-'}
                              </span>
                              <span className="text-lg font-bold text-indigo-700 leading-none">
                                {ev.date ? new Date(ev.date).getDate() : '-'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">{ev.title}</h3>
                              {ev.location && <p className="text-xs text-muted-foreground mt-0.5">{ev.location}</p>}
                              {ev.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{ev.description}</p>}
                              {past && <span className="text-xs text-muted-foreground mt-1 block">{t('communications.event.past')}</span>}

                              {/* RSVP */}
                              <RsvpButtons
                                eventId={ev.id}
                                counts={rsvp}
                                isPast={past}
                                onRsvp={handleRsvp}
                              />

                              {/* Going avatar row */}
                              {avatars.length > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <div className="flex -space-x-1.5">
                                    {avatars.slice(0, 5).map((r: any, i: number) => {
                                      const name = r.employees?.name ?? '';
                                      const initials = name[0]?.toUpperCase() ?? '?';
                                      return (
                                        <div
                                          key={i}
                                          className="w-6 h-6 rounded-full border-2 border-card bg-indigo-100 flex items-center justify-center text-indigo-700 text-[9px] font-semibold overflow-hidden flex-shrink-0"
                                          title={name}
                                        >
                                          {r.employees?.profile_picture ? (
                                            <img src={r.employees.profile_picture} alt={name} className="w-full h-full object-cover" />
                                          ) : initials}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {avatars.length > 5 && (
                                    <span className="text-xs text-muted-foreground">
                                      {t('communications.goingAvatars').replace('{n}', String(avatars.length - 5))}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Add to Calendar */}
                              <button
                                onClick={() => downloadICS(ev as CommunicationsEvent)}
                                className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                              >
                                📅 {t('communications.addToCalendar')}
                              </button>
                            </div>
                          </div>
                          {canManageChannels && (
                            <button
                              onClick={() => deleteEvent(ev.id)}
                              className="sm:opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs px-2 py-1 rounded hover:bg-red-50 flex-shrink-0"
                            >
                              {t('common.delete')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Event detail modal (calendar view click) */}
                {selectedEventDetail && (
                  <Modal title={selectedEventDetail.title} onClose={() => setSelectedEventDetail(null)}>
                    <div className="space-y-3">
                      {selectedEventDetail.date && (
                        <p className="text-sm text-muted-foreground">{formatDateTime(selectedEventDetail.date)}</p>
                      )}
                      {selectedEventDetail.location && (
                        <p className="text-sm text-foreground">📍 {selectedEventDetail.location}</p>
                      )}
                      {selectedEventDetail.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedEventDetail.description}</p>
                      )}
                      <button
                        onClick={() => downloadICS(selectedEventDetail as CommunicationsEvent)}
                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        📅 {t('communications.addToCalendar')}
                      </button>
                    </div>
                  </Modal>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                POLLS TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Polls' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {canManageChannels && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowPollModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <span>+</span> {t('communications.poll.newButton')}
                    </button>
                  </div>
                )}

                {polls.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-lg font-medium">{t('communications.poll.empty')}</p>
                  </div>
                ) : (
                  polls.map((poll: any) => {
                    const options: any[] = poll.options ?? [];
                    const totalVotes = options.reduce((sum: number, o: any) => sum + (o.votes ?? 0), 0);
                    const hasVoted = (poll.voters ?? []).includes(userId ?? '');
                    return (
                      <div key={poll.id} className="bg-card rounded-2xl shadow-sm border border-border p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-4">{poll.question}</h3>
                        <div className="space-y-3">
                          {options.map((opt: any, i: number) => {
                            const pct = totalVotes > 0 ? Math.round(((opt.votes ?? 0) / totalVotes) * 100) : 0;
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <button
                                    onClick={() => !hasVoted && vote(poll.id, i)}
                                    disabled={hasVoted}
                                    className={`text-sm text-left ${hasVoted ? 'text-muted-foreground cursor-default' : 'text-indigo-600 hover:text-indigo-800 font-medium'}`}
                                  >
                                    {opt.text}
                                  </button>
                                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{opt.votes ?? 0} vote{(opt.votes ?? 0) !== 1 ? 's' : ''} ({pct}%)</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                          {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                          {hasVoted && <span className="ml-2 text-indigo-500 font-medium">{t('communications.poll.youVoted')}</span>}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                RECOGNITION TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Recognition' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-lg font-semibold text-foreground">{t('communications.recognition.title')}</h2>
                  <button
                    onClick={() => setShowRecognitionModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    🏅 {t('communications.recognition.give')}
                  </button>
                </div>

                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'given', 'received', 'team'] as const).map((filter) => {
                    const labels: Record<string, string> = {
                      all: t('communications.recognition.filterAll'),
                      given: t('communications.recognition.filterGiven'),
                      received: t('communications.recognition.filterReceived'),
                      team: t('communications.recognition.filterTeam'),
                    };
                    return (
                      <button
                        key={filter}
                        onClick={() => setRecFilter(filter)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          recFilter === filter
                            ? 'bg-indigo-600 text-white'
                            : 'bg-card border border-border text-muted-foreground hover:border-indigo-300'
                        }`}
                      >
                        {labels[filter]}
                      </button>
                    );
                  })}
                </div>

                {/* Recognition feed */}
                {filteredRecognitions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-3xl mb-2">🏅</p>
                    <p className="text-lg font-medium">{t('communications.recognition.empty')}</p>
                    <p className="text-sm mt-1">{t('communications.recognition.emptyHint')}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRecognitions.map((rec) => {
                      const badge = badgeInfo(rec.badge_type);
                      const fromName = rec.from_name ?? empMap[rec.from_employee_id] ?? 'Someone';
                      const toName = rec.to_name ?? empMap[rec.to_employee_id] ?? 'Someone';
                      const colorMap: Record<string, string> = {
                        amber: 'from-amber-400 to-orange-400',
                        blue: 'from-blue-400 to-indigo-400',
                        indigo: 'from-indigo-400 to-purple-400',
                        violet: 'from-violet-400 to-purple-400',
                        teal: 'from-teal-400 to-cyan-400',
                        green: 'from-green-400 to-emerald-400',
                        purple: 'from-purple-400 to-pink-400',
                        emerald: 'from-emerald-400 to-teal-400',
                      };
                      const gradient = colorMap[badge.color] ?? 'from-indigo-400 to-purple-400';
                      return (
                        <div key={rec.id} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                          <div className={`h-1 bg-gradient-to-r ${gradient}`} />
                          <div className="p-4">
                            <div className="flex flex-col items-center text-center pt-2">
                              <div className="text-4xl mb-2">{badge.emoji}</div>
                              <p className="text-sm font-semibold text-indigo-700">{badge.label}</p>
                              <p className="text-sm text-foreground mt-1">
                                <span className="font-medium">{fromName}</span>
                                {' '}{t('communications.recognition.recognized')}{' '}
                                <span className="font-medium">{toName}</span>
                              </p>
                            </div>
                            <hr className="my-3 border-border" />
                            <p className="text-sm italic text-muted-foreground text-center line-clamp-3">
                              &ldquo;{rec.message}&rdquo;
                            </p>
                            <p className="text-xs text-muted-foreground text-right mt-2">{timeAgo(rec.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Leaderboards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Top Recognizers */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      🏆 {t('communications.recognition.topRecognizers')}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">— {t('communications.recognition.thisMonth')}</span>
                    </h3>
                    {topRecognizers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('communications.recognition.empty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {topRecognizers.map((r, i) => (
                          <div key={r.id} className="flex items-center gap-3">
                            <span className="w-5 text-xs font-bold text-muted-foreground text-right">#{i + 1}</span>
                            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-semibold">
                              {r.name[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="flex-1 text-sm text-foreground truncate">{r.name}</span>
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Recognized */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      ⭐ {t('communications.recognition.topRecognized')}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">— {t('communications.recognition.thisMonth')}</span>
                    </h3>
                    {topRecognized.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('communications.recognition.empty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {topRecognized.map((r, i) => (
                          <div key={r.id} className="flex items-center gap-3">
                            <span className="w-5 text-xs font-bold text-muted-foreground text-right">#{i + 1}</span>
                            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-xs font-semibold">
                              {r.name[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="flex-1 text-sm text-foreground truncate">{r.name}</span>
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                CHANNELS TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Channels' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {canManageChannels && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowChannelModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <span>+</span> {t('communications.channel.newButton')}
                    </button>
                  </div>
                )}

                {channels.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                    <p className="text-lg font-medium">{t('communications.channel.empty')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {channels.map((ch: any) => (
                      <div key={ch.id} className="bg-card rounded-2xl shadow-sm border border-border p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0">
                            #
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">{ch.name}</h3>
                            {ch.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ch.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{ch.member_count ?? 0} member{(ch.member_count ?? 0) !== 1 ? 's' : ''}</p>
                            <a
                              href={`/collaboration?channel=${ch.id}`}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              {t('communications.channel.openCollab')} ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                ANALYTICS TAB
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'Analytics' && canViewAnalytics && (
              <div className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: t('communications.analytics.postsThisMonth'), value: posts.filter((p: any) => { const d = new Date((p as any).created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, color: 'text-indigo-700' },
                    { label: t('communications.analytics.totalReactions'), value: Object.values(rxnCounts).reduce((sum, c) => sum + Object.values(c).reduce((s, v) => s + v, 0), 0), color: 'text-pink-700' },
                    { label: 'Total Events', value: events.length, color: 'text-teal-700' },
                    { label: 'Total Recognitions', value: recognitions.length, color: 'text-violet-700' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card rounded-2xl shadow-sm border border-border p-5">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Row 1: Posts per week + RSVP pie */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Posts per week bar chart */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">{t('communications.analytics.postsPerWeek')}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={postsPerWeek} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Posts" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* RSVP distribution pie */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">{t('communications.analytics.rsvpDistribution')}</h3>
                    {rsvpChartData.length === 0 ? (
                      <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                        No RSVP data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={rsvpChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                            labelLine={false}
                          >
                            {rsvpChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Row 2: Top read posts + Recognition leaderboard */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Top most-read posts */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">{t('communications.analytics.topMostRead')}</h3>
                    {topReadPosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('communications.analytics.noAnnouncements')}</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={topReadPosts} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                          <Tooltip />
                          <Bar dataKey="reads" fill="#6366f1" radius={[0, 4, 4, 0]} name="Reads" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Recognition leaderboard */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">{t('communications.analytics.recognitionLeaderboard')}</h3>
                    {recognitionChartData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('communications.recognition.empty')}</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={recognitionChartData} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                          <Tooltip />
                          <Bar dataKey="times" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Times Recognized" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Read Rate Trend (Line Chart) */}
                <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">{t('communications.analytics.readRateTrend')}</h3>
                  {readRateTrend.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      Loading read rate data...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={readRateTrend} margin={{ top: 4, right: 20, left: -20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip formatter={(v: any) => `${v}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="readRate" stroke="#6366f1" strokeWidth={2} dot={false} name="Read Rate %" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Critical announcement read receipt table */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t('communications.analytics.readReceiptPanel')}</h3>
                  </div>
                  {(() => {
                    const critical = announcements.filter((a: any) => a.priority === 'critical' || a.acknowledgement_required);
                    if (critical.length === 0) {
                      return <p className="text-sm text-muted-foreground p-5">{t('communications.analytics.noAnnouncements')}</p>;
                    }
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <tr>
                              <th className="px-5 py-3">{t('communications.analytics.colTitle')}</th>
                              <th className="px-5 py-3 hidden sm:table-cell">{t('communications.analytics.colAudience')}</th>
                              <th className="px-5 py-3 text-right">{t('communications.analytics.colRead')}</th>
                              <th className="px-5 py-3 text-right">{t('communications.analytics.colAcknowledged')}</th>
                              <th className="px-5 py-3 text-right">{t('communications.analytics.colPctAck')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {critical.map((a: any) => {
                              const readCount = a.read_count ?? 0;
                              const ackCount = a.acknowledged_count ?? 0;
                              const pct = readCount > 0 ? Math.round((ackCount / readCount) * 100) : 0;
                              const rowBg = pct >= 95 ? 'bg-green-50' : pct >= 80 ? 'bg-amber-50' : 'bg-red-50';
                              return (
                                <tr key={a.id} className={`${rowBg} transition-colors`}>
                                  <td className="px-5 py-3 font-medium text-foreground max-w-[200px] truncate">{a.title}</td>
                                  <td className="px-5 py-3 hidden sm:table-cell">
                                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{audienceLabel(a.audience)}</span>
                                  </td>
                                  <td className="px-5 py-3 text-right text-foreground">{readCount}</td>
                                  <td className="px-5 py-3 text-right text-foreground">{ackCount}</td>
                                  <td className="px-5 py-3 text-right">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${pct >= 95 ? 'bg-green-100 text-green-700' : pct >= 80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                      {pct}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAnnouncementModal && (
        <CreateAnnouncementModal
          onClose={() => setShowAnnouncementModal(false)}
          onCreate={createAnnouncement}
        />
      )}
      {showEventModal && (
        <CreateEventModal
          onClose={() => setShowEventModal(false)}
          onCreate={createEvent}
        />
      )}
      {showPollModal && (
        <CreatePollModal
          onClose={() => setShowPollModal(false)}
          onCreate={createPoll}
        />
      )}
      {showChannelModal && (
        <CreateChannelModal
          onClose={() => setShowChannelModal(false)}
          onCreate={createChannel}
        />
      )}
      {showRecognitionModal && (
        <GiveRecognitionModal
          onClose={() => setShowRecognitionModal(false)}
          onSubmit={handleGiveRecognition}
          employees={employees}
          currentUserId={userId ?? ''}
        />
      )}
      {readersDrawerPost && (
        <ReadersDrawer
          postId={readersDrawerPost.id}
          postTitle={readersDrawerPost.title}
          audienceSize={readersDrawerPost.audience_size}
          onClose={() => setReadersDrawerPost(null)}
        />
      )}
    </div>
  );
}

export { InternalCommunicationsHub as CommunicationsHubDB };
export default InternalCommunicationsHub;
