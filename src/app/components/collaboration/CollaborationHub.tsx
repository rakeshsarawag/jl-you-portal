import { useState, useEffect, useRef, useCallback } from 'react';
import { t } from '../../../i18n';
import { AppLayout } from '../apps/AppLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import { useChatData, ChatChannel, ChatMessage, AppUser } from './useChatData';
import {
  MessageSquare,
  Hash,
  Send,
  Plus,
  Search,
  Users,
  Smile,
  Paperclip,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  File as FileIcon,
  Activity,
  MessageCircle,
  X,
  ChevronRight,
  Lock,
  Pin,
  Settings,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Code,
  List,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CollaborationHubProps {
  accessToken: string;
  onLogout: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMOJI_QUICK = ['👍', '❤️', '😊', '🎉', '🚀', '👏', '🔥', '💯'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - msgDay.getTime();
  if (diff === 0) return t('collaborationHub.today');
  if (diff === 86400000) return t('collaborationHub.yesterday');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function sameGroup(a: ChatMessage, b: ChatMessage) {
  if (a.sender_id !== b.sender_id) return false;
  const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return diff < 5 * 60 * 1000;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function presenceColor(status?: string) {
  if (status === 'online') return 'bg-green-500';
  if (status === 'away') return 'bg-yellow-400';
  return 'bg-gray-400';
}

// ── Markdown renderer (simple) ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      // Code block
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
          <code>{blockLines.join('\n')}</code>
        </pre>
      );
      i++;
    } else if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className="border-l-4 border-gray-300 pl-3 my-1 text-gray-600 italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++;
    } else {
      nodes.push(<span key={i}>{renderInline(line)}{i < lines.length - 1 ? <br /> : null}</span>);
      i++;
    }
  }
  return <>{nodes}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    const italicMatch = remaining.match(/^(.*?)_(.*?)_(.*)/s);
    const urlMatch = remaining.match(/^(.*?)(https?:\/\/[^\s]+)(.*)/s);
    const mentionMatch = remaining.match(/^(.*?)(@\w[\w.]*)(.*)/s);

    const candidates = [
      boldMatch && { type: 'bold', m: boldMatch, pos: boldMatch[1].length },
      codeMatch && { type: 'code', m: codeMatch, pos: codeMatch[1].length },
      italicMatch && { type: 'italic', m: italicMatch, pos: italicMatch[1].length },
      urlMatch && { type: 'url', m: urlMatch, pos: urlMatch[1].length },
      mentionMatch && { type: 'mention', m: mentionMatch, pos: mentionMatch[1].length },
    ].filter(Boolean) as { type: string; m: RegExpMatchArray; pos: number }[];

    if (candidates.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const best = candidates.reduce((a, b) => (a.pos <= b.pos ? a : b));
    const [, before, inner, after] = best.m;

    if (before) parts.push(<span key={key++}>{before}</span>);

    if (best.type === 'bold') {
      parts.push(<strong key={key++}>{inner}</strong>);
    } else if (best.type === 'code') {
      parts.push(<code key={key++} className="bg-gray-100 rounded px-1 font-mono text-sm">{inner}</code>);
    } else if (best.type === 'italic') {
      parts.push(<em key={key++}>{inner}</em>);
    } else if (best.type === 'url') {
      parts.push(<a key={key++} href={inner} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{inner}</a>);
    } else if (best.type === 'mention') {
      parts.push(<span key={key++} className="bg-indigo-100 text-indigo-700 rounded px-1">{inner}</span>);
    }

    remaining = after;
  }

  return <>{parts}</>;
}

// ── Attachment display ────────────────────────────────────────────────────────

function AttachmentDisplay({ attachment, getSignedUrl }: {
  attachment: { file_name: string; file_size_bytes: number; mime_type: string; storage_path: string };
  getSignedUrl: (path: string) => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getSignedUrl(attachment.storage_path).then(setUrl);
  }, [attachment.storage_path]);

  if (isImageMime(attachment.mime_type) && url) {
    return (
      <img
        src={url}
        alt={attachment.file_name}
        loading="lazy"
        className="max-w-[400px] rounded-xl mt-2 cursor-pointer"
        onClick={() => window.open(url, '_blank')}
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 mt-2 bg-white">
      <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
      <span className="text-sm font-medium truncate max-w-[200px]">{attachment.file_name}</span>
      <span className="text-xs text-gray-400">·</span>
      <span className="text-xs text-gray-500">{formatFileSize(attachment.file_size_bytes)}</span>
      {url && (
        <a href={url} download={attachment.file_name} className="text-indigo-600 text-xs hover:underline flex items-center gap-1">
          <Download className="h-3 w-3" />
          {t('collaborationHub.download')}
        </a>
      )}
    </div>
  );
}

// ── Formatting Toolbar ────────────────────────────────────────────────────────

interface FormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
}

function FormattingToolbar({ textareaRef, value, onChange }: FormattingToolbarProps) {
  const wrap = (before: string, after: string, multiLine?: boolean) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);

    let replacement: string;
    if (multiLine && before === '• ') {
      replacement = selected
        ? selected.split('\n').map(l => `• ${l}`).join('\n')
        : '• ';
    } else {
      replacement = `${before}${selected}${after}`;
    }

    const newVal = value.slice(0, start) + replacement + value.slice(end);
    onChange(newVal);

    // Restore cursor
    requestAnimationFrame(() => {
      ta.focus();
      const newCursor = start + replacement.length;
      ta.setSelectionRange(newCursor, newCursor);
    });
  };

  const buttons = [
    { label: 'B', title: t('collaborationHub.formatBold'), action: () => wrap('**', '**'), className: 'font-bold' },
    { label: 'I', title: t('collaborationHub.formatItalic'), action: () => wrap('_', '_'), className: 'italic' },
    { label: '`', title: t('collaborationHub.formatCode'), action: () => wrap('`', '`'), className: 'font-mono text-xs' },
    { label: '```', title: t('collaborationHub.formatCodeBlock'), action: () => wrap('```\n', '\n```'), className: 'font-mono text-xs' },
    { label: '•', title: t('collaborationHub.formatList'), action: () => wrap('• ', '', true), className: '' },
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 bg-gray-50">
      {buttons.map(btn => (
        <button
          key={btn.label}
          type="button"
          title={btn.title}
          onClick={btn.action}
          className={`px-2 py-0.5 rounded text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors ${btn.className}`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

// ── Message Item ──────────────────────────────────────────────────────────────

interface MessageItemProps {
  msg: ChatMessage;
  isGrouped: boolean;
  currentEmployeeId: string | null;
  isManagerOrAdmin?: boolean;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void;
  onReply: (msg: ChatMessage) => void;
  onPin: (msgId: string, currentlyPinned: boolean) => void;
  getSignedUrl: (path: string) => Promise<string | null>;
  highlight?: boolean;
}

function MessageItem({ msg, isGrouped, currentEmployeeId, isManagerOrAdmin, onReact, onEdit, onDelete, onReply, onPin, getSignedUrl, highlight }: MessageItemProps) {
  const [hovering, setHovering] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isOwn = msg.sender_id === currentEmployeeId;
  const isPinned = !!(msg.metadata as Record<string, unknown> | null)?.is_pinned;

  return (
    <div
      className={`relative group flex gap-3 px-2 py-1 rounded-lg transition-colors ${isGrouped ? 'mt-0.5' : 'mt-4'} ${highlight ? 'bg-yellow-100' : 'hover:bg-gray-50'}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      <div className="w-9 flex-shrink-0">
        {!isGrouped && (
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium select-none">
            {(msg.sender_name ?? 'U')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm text-gray-900">{msg.sender_name}</span>
            <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
            {msg.is_edited && <span className="text-xs text-gray-400">{t('collaborationHub.edited')}</span>}
            {isPinned && <span className="text-xs text-amber-600 flex items-center gap-0.5">📌</span>}
          </div>
        )}

        <div className="text-sm text-gray-800 break-words leading-relaxed">
          {renderMarkdown(msg.content)}
        </div>

        {/* Attachments */}
        {(msg.attachments ?? []).map(att => (
          <AttachmentDisplay key={att.id} attachment={att} getSignedUrl={getSignedUrl} />
        ))}

        {/* Reactions */}
        {(msg.reactions ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(msg.reactions ?? []).map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg.id, r.emoji)}
                className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 transition-colors ${
                  r.reacted_by_me
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread chip */}
        {(msg.reply_count ?? 0) > 0 && (
          <button
            onClick={() => onReply(msg)}
            className="mt-1 text-xs text-indigo-600 hover:underline flex items-center gap-1"
          >
            <MessageCircle className="h-3 w-3" />
            {msg.reply_count} {msg.reply_count === 1 ? t('collaborationHub.replyCount') : t('collaborationHub.threadReplies')}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {hovering && (
        <div className="absolute right-2 top-0 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-0.5 px-1 py-0.5 z-10">
          {EMOJI_QUICK.slice(0, 3).map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(msg.id, emoji)}
              className="text-sm hover:scale-125 transition-transform px-0.5"
            >
              {emoji}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <button
            onClick={() => onReply(msg)}
            title={t('collaborationHub.reply')}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MessageCircle className="h-3.5 w-3.5 text-gray-500" />
          </button>
          {isManagerOrAdmin && (
            <button
              onClick={() => onPin(msg.id, isPinned)}
              title={isPinned ? t('collaborationHub.unpinMessage') : t('collaborationHub.pinMessage')}
              className={`p-1 hover:bg-gray-100 rounded ${isPinned ? 'text-amber-500' : 'text-gray-500'}`}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && (
            <>
              <button
                onClick={() => onEdit(msg)}
                title={t('collaborationHub.editMessage')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Edit className="h-3.5 w-3.5 text-gray-500" />
              </button>
              <button
                onClick={() => onDelete(msg.id)}
                title={t('collaborationHub.deleteMessage')}
                className="p-1 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pinned Messages Bar ───────────────────────────────────────────────────────

function PinnedBar({
  pinnedMessages,
  onOpenDrawer,
}: {
  pinnedMessages: ChatMessage[];
  onOpenDrawer: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (pinnedMessages.length === 0) return null;
  const latest = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm flex-shrink-0">
      <Pin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
      <button
        onClick={onOpenDrawer}
        className="flex-1 text-left truncate text-amber-900 hover:underline"
      >
        <span className="font-semibold">{pinnedMessages.length} {t('collaborationHub.pinnedMessages')}</span>
        {!collapsed && latest && (
          <span className="text-amber-700 ml-2 truncate">{latest.content.slice(0, 60)}{latest.content.length > 60 ? '…' : ''}</span>
        )}
      </button>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="p-0.5 rounded hover:bg-amber-100 text-amber-600"
      >
        {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Pinned Messages Drawer ────────────────────────────────────────────────────

function PinnedDrawer({
  pinnedMessages,
  onClose,
  onUnpin,
  isManagerOrAdmin,
}: {
  pinnedMessages: ChatMessage[];
  onClose: () => void;
  onUnpin: (msgId: string) => void;
  isManagerOrAdmin: boolean;
}) {
  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Pin className="h-4 w-4 text-amber-500" />
          {t('collaborationHub.pinnedMessages')}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pinnedMessages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">{t('collaborationHub.noPinnedMessages')}</p>
        )}
        {pinnedMessages.map(msg => (
          <div key={msg.id} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-900">{msg.sender_name}</span>
              <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
              {isManagerOrAdmin && (
                <button
                  onClick={() => onUnpin(msg.id)}
                  className="ml-auto text-xs text-gray-500 hover:text-red-500"
                  title={t('collaborationHub.unpinMessage')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-700 line-clamp-3">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Global Search Modal ───────────────────────────────────────────────────────

function GlobalSearchModal({
  channels,
  onClose,
  onNavigate,
}: {
  channels: ChatChannel[];
  onClose: () => void;
  onNavigate: (channelId: string, msgId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(ChatMessage & { channel_name?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const memberChannels = channels.map(c => c.id);
      if (memberChannels.length === 0) { setResults([]); setSearching(false); return; }

      // Parse filter syntax
      let baseQuery = query;
      let senderFilter: string | null = null;
      let channelFilter: string | null = null;

      const fromMatch = query.match(/from:@(\S+)/i);
      const inMatch = query.match(/in:#(\S+)/i);
      if (fromMatch) { senderFilter = fromMatch[1]; baseQuery = baseQuery.replace(fromMatch[0], '').trim(); }
      if (inMatch) { channelFilter = inMatch[1]; baseQuery = baseQuery.replace(inMatch[0], '').trim(); }

      let q = supabase
        .from('chat_messages')
        .select('*, chat_channels(name)')
        .eq('is_deleted', false)
        .in('channel_id', memberChannels)
        .limit(20);

      if (baseQuery.trim()) {
        q = q.textSearch('content', baseQuery.trim());
      }

      if (channelFilter) {
        const matchedChannel = channels.find(c => c.name.toLowerCase().includes(channelFilter!.toLowerCase()));
        if (matchedChannel) q = q.eq('channel_id', matchedChannel.id);
      }

      const { data } = await q;
      let msgs = (data ?? []) as (ChatMessage & { chat_channels?: { name: string }; channel_name?: string })[];

      // Enrich with channel name
      msgs = msgs.map(m => ({
        ...m,
        channel_name: (m.chat_channels as { name: string } | undefined)?.name ?? channels.find(c => c.id === m.channel_id)?.name ?? '',
      }));

      // Filter by sender name if specified
      if (senderFilter) {
        msgs = msgs.filter(m => m.sender_name?.toLowerCase().includes(senderFilter!.toLowerCase()));
      }

      setResults(msgs as (ChatMessage & { channel_name?: string })[]);
      setSearching(false);
    }, 300);
  }, [query, channels]);

  // Group by channel
  const grouped: Record<string, (ChatMessage & { channel_name?: string })[]> = {};
  for (const msg of results) {
    const key = msg.channel_name ?? msg.channel_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(msg);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-20 z-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm outline-none placeholder-gray-400"
            placeholder={t('collaborationHub.globalSearchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {searching && (
            <p className="text-xs text-gray-400 text-center py-6">{t('common.loading')}</p>
          )}
          {!searching && query && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">{t('collaborationHub.noSearchResults')}</p>
          )}
          {!searching && Object.entries(grouped).map(([channelName, msgs]) => (
            <div key={channelName}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  #{channelName}
                </span>
              </div>
              {msgs.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => { onNavigate(msg.channel_id, msg.id); onClose(); }}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">{msg.sender_name}</span>
                    <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>
                </button>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Channel Settings Panel ────────────────────────────────────────────────────

interface ChannelMember {
  employee_id: string;
  role: string;
  name?: string;
}

function ChannelSettingsPanel({
  channel,
  currentEmployeeId,
  allUsers,
  onClose,
  onChannelUpdated,
}: {
  channel: ChatChannel;
  currentEmployeeId: string | null;
  allUsers: AppUser[];
  onClose: () => void;
  onChannelUpdated: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'members' | 'advanced'>('overview');
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? '');
  const [isPrivate, setIsPrivate] = useState(channel.is_private);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const isCreator = channel.created_by === currentEmployeeId;

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from('chat_channel_members')
      .select('employee_id, role')
      .eq('channel_id', channel.id);
    if (data) {
      const enriched = data.map(m => ({
        ...m,
        name: allUsers.find(u => u.employee_id === m.employee_id)?.name ?? m.employee_id,
      }));
      setMembers(enriched);
    }
    setLoadingMembers(false);
  }, [channel.id, allUsers]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
  }, [tab, loadMembers]);

  const handleSaveOverview = async () => {
    if (!name.trim()) return;
    setSaving(true);
    void supabase.from('chat_channels')
      .update({ name: name.trim(), description: description.trim() || null, is_private: isPrivate })
      .eq('id', channel.id);
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
    toast.success(t('common.success'));
    onChannelUpdated();
  };

  const handleRemoveMember = (memberId: string) => {
    void supabase.from('chat_channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('employee_id', memberId);
    setMembers(prev => prev.filter(m => m.employee_id !== memberId));
    toast.success(t('collaborationHub.memberRemoved'));
  };

  const handleChangeRole = (memberId: string, newRole: string) => {
    void supabase.from('chat_channel_members')
      .update({ role: newRole })
      .eq('channel_id', channel.id)
      .eq('employee_id', memberId);
    setMembers(prev => prev.map(m => m.employee_id === memberId ? { ...m, role: newRole } : m));
  };

  const handleAddMember = (user: AppUser) => {
    if (!user.employee_id) return;
    void supabase.from('chat_channel_members')
      .insert([{ channel_id: channel.id, employee_id: user.employee_id, role: 'member' }]);
    setMembers(prev => [...prev, { employee_id: user.employee_id!, role: 'member', name: user.name }]);
    setMemberSearch('');
    toast.success(t('collaborationHub.memberAdded'));
  };

  const handleArchive = async () => {
    if (!confirm(t('collaborationHub.archiveConfirm'))) return;
    void supabase.from('chat_channels').update({ is_archived: true }).eq('id', channel.id);
    toast.success(t('collaborationHub.channelArchived'));
    onClose();
    onChannelUpdated();
  };

  const handleLeave = async () => {
    if (!confirm(t('collaborationHub.leaveConfirm'))) return;
    if (!currentEmployeeId) return;
    void supabase.from('chat_channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('employee_id', currentEmployeeId);
    onClose();
    onChannelUpdated();
  };

  const availableToAdd = allUsers.filter(u =>
    u.employee_id &&
    !members.find(m => m.employee_id === u.employee_id) &&
    u.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{t('collaborationHub.channelSettings')}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['overview', 'members', 'advanced'] as const).map(tabId => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === tabId ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t(`collaborationHub.settings${tabId.charAt(0).toUpperCase() + tabId.slice(1)}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div>
              <Label>{t('collaborationHub.channelName')}</Label>
              <Input value={name} onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())} className="mt-1" />
            </div>
            <div>
              <Label>{t('collaborationHub.description')}</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="settings-private"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="settings-private" className="text-sm text-gray-700">{t('collaborationHub.channelPrivate')}</label>
            </div>
            <Button onClick={handleSaveOverview} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {saving ? t('common.loading') : t('collaborationHub.saveSettings')}
            </Button>
          </div>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <div className="space-y-3">
            <div>
              <Label>{t('collaborationHub.addMember')}</Label>
              <Input
                placeholder={t('collaborationHub.searchUsers')}
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="mt-1"
              />
              {memberSearch && (
                <div className="mt-1 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                  {availableToAdd.slice(0, 5).map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAddMember(u)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {loadingMembers && <p className="text-xs text-gray-400 text-center">{t('common.loading')}</p>}
              {members.map(m => (
                <div key={m.employee_id} className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    {(m.name ?? '?')[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 flex-1 truncate">{m.name}</span>
                  <Badge className={`text-xs ${m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {m.role}
                  </Badge>
                  {m.employee_id !== currentEmployeeId && (
                    <>
                      <button
                        onClick={() => handleChangeRole(m.employee_id, m.role === 'admin' ? 'member' : 'admin')}
                        title={m.role === 'admin' ? t('collaborationHub.demoteToMember') : t('collaborationHub.promoteToAdmin')}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                      >
                        <Users className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.employee_id)}
                        title={t('collaborationHub.removeMember')}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced tab */}
        {tab === 'advanced' && (
          <div className="space-y-3">
            {isCreator && (
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {t('collaborationHub.archiveChannel')}
              </button>
            )}
            {!isCreator && (
              <button
                onClick={handleLeave}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <X className="h-4 w-4" />
                {t('collaborationHub.leaveChannel')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Browse Channels Modal ─────────────────────────────────────────────────────

function BrowseChannelsModal({
  currentEmployeeId,
  joinedChannelIds,
  onJoin,
  onClose,
}: {
  currentEmployeeId: string | null;
  joinedChannelIds: string[];
  onJoin: (channelId: string) => void;
  onClose: () => void;
}) {
  const [allChannels, setAllChannels] = useState<(ChatChannel & { member_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'channel')
      .eq('is_private', false)
      .order('name')
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        // Get member counts
        const enriched = await Promise.all(data.map(async ch => {
          const { count } = await supabase
            .from('chat_channel_members')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id);
          return { ...ch, member_count: count ?? 0 };
        }));
        setAllChannels(enriched as (ChatChannel & { member_count?: number })[]);
        setLoading(false);
      });
  }, []);

  const handleJoin = async (channelId: string) => {
    if (!currentEmployeeId) return;
    setJoining(channelId);
    void supabase.from('chat_channel_members')
      .insert([{ channel_id: channelId, employee_id: currentEmployeeId, role: 'member' }]);
    await new Promise(r => setTimeout(r, 400));
    onJoin(channelId);
    setJoining(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{t('collaborationHub.browseChannels')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <p className="text-sm text-gray-400 text-center py-8">{t('common.loading')}</p>}
          {!loading && allChannels.map(ch => {
            const joined = joinedChannelIds.includes(ch.id);
            return (
              <div key={ch.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-sm text-gray-900">{ch.name}</span>
                  </div>
                  {ch.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{ch.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Users className="h-3 w-3 inline mr-0.5" />
                    {ch.member_count} members
                  </p>
                </div>
                {joined ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">{t('collaborationHub.channelJoined')}</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={joining === ch.id}
                    onClick={() => handleJoin(ch.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs"
                  >
                    {joining === ch.id ? '...' : t('collaborationHub.joinChannel')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ typingNames }: { typingNames: string[] }) {
  if (typingNames.length === 0) return null;
  let text = '';
  if (typingNames.length === 1) text = `${typingNames[0]} ${t('collaborationHub.typingOne')}`;
  else if (typingNames.length === 2) text = `${typingNames[0]} ${t('collaborationHub.typingTwo')} ${typingNames[1]} ${t('collaborationHub.areTyping')}`;
  else text = `${typingNames[0]} ${t('collaborationHub.typingTwo')} ${typingNames.length - 1} ${t('collaborationHub.typingMany')}`;

  return (
    <div className="text-xs text-gray-400 italic px-4 pb-1 flex items-center gap-1">
      <span>{text}</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
            className="inline-block w-1 h-1 rounded-full bg-gray-400"
          />
        ))}
      </span>
    </div>
  );
}

// ── Sidebar Channel Item ──────────────────────────────────────────────────────

function ChannelItem({
  channel,
  isSelected,
  onClick,
  presenceStatus,
  dmOtherName,
}: {
  channel: ChatChannel;
  isSelected: boolean;
  onClick: () => void;
  presenceStatus?: string;
  dmOtherName?: string;
}) {
  const isDM = channel.type === 'dm' || channel.type === 'group_dm';
  const displayName = isDM && dmOtherName ? dmOtherName : channel.name;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 group ${
        isSelected
          ? 'bg-indigo-100 text-indigo-900'
          : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      {isDM ? (
        <div className="relative flex-shrink-0">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-300 to-purple-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
          {presenceStatus && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${presenceColor(presenceStatus)} rounded-full border-2 border-white`} />
          )}
        </div>
      ) : channel.is_private ? (
        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      ) : (
        <Hash className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      )}
      <span className={`text-sm truncate flex-1 ${(channel.unread_count ?? 0) > 0 ? 'font-semibold' : 'font-medium'}`}>
        {displayName}
      </span>
      {(channel.unread_count ?? 0) > 0 && (
        <Badge className="bg-indigo-500 text-white text-xs px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
          {(channel.unread_count ?? 0) > 99 ? '99+' : channel.unread_count}
        </Badge>
      )}
    </button>
  );
}

// ── New DM Modal ──────────────────────────────────────────────────────────────

function NewDMModal({
  allUsers,
  currentEmployeeId,
  presenceMap,
  onSelect,
  onClose,
}: {
  allUsers: AppUser[];
  currentEmployeeId: string | null;
  presenceMap: Record<string, { status: string }>;
  onSelect: (user: AppUser) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = allUsers.filter(u =>
    u.employee_id !== currentEmployeeId &&
    (
      (u.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (u.department ?? '').toLowerCase().includes(query.toLowerCase())
    )
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">{t('collaborationHub.newDM')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-3">
          <Input
            autoFocus
            placeholder={t('collaborationHub.searchUsers')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t('collaborationHub.noUsersFound')}</p>
            )}
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => onSelect(u)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {u.name[0]}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${presenceColor(u.employee_id ? presenceMap[u.employee_id]?.status : undefined)} rounded-full border-2 border-white`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.department && <p className="text-xs text-gray-400">{u.department}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create Channel Modal ──────────────────────────────────────────────────────

function CreateChannelModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string, isPrivate: boolean) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error(t('collaborationHub.channelNameRequired')); return; }
    setCreating(true);
    await onCreate(name, desc, isPrivate);
    setCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{t('collaborationHub.createChannel')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label>{t('collaborationHub.channelName')}</Label>
            <Input
              autoFocus
              placeholder={t('collaborationHub.channelNamePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t('collaborationHub.description')}</Label>
            <Textarea
              placeholder={t('collaborationHub.channelDescPlaceholder')}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="private-toggle"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="private-toggle" className="text-sm text-gray-700">
              {t('collaborationHub.channelPrivate')}
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {creating ? t('common.loading') : t('collaborationHub.createChannel')}
            </Button>
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Thread Panel ──────────────────────────────────────────────────────────────

function ThreadPanel({
  parent,
  replies,
  currentEmployeeId,
  onClose,
  onSendReply,
  onReact,
  onEdit,
  onDelete,
  getSignedUrl,
}: {
  parent: ChatMessage;
  replies: ChatMessage[];
  currentEmployeeId: string | null;
  onClose: () => void;
  onSendReply: (content: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void;
  getSignedUrl: (path: string) => Promise<string | null>;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendReply(input);
    setInput('');
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{t('collaborationHub.thread')}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="mx-3 my-3 bg-gray-50 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {(parent.sender_name ?? 'U')[0]}
          </div>
          <span className="text-xs font-semibold text-gray-900">{parent.sender_name}</span>
          <span className="text-xs text-gray-400">{formatTime(parent.created_at)}</span>
        </div>
        <p className="text-xs text-gray-700 line-clamp-3">{parent.content}</p>
      </div>

      <div className="flex items-center gap-2 mx-3 my-1">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400">
          {replies.length} {replies.length === 1 ? t('collaborationHub.replyCount') : t('collaborationHub.threadReplies')}
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-1">
        {replies.map((msg, i) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            isGrouped={i > 0 && sameGroup(replies[i - 1], msg)}
            currentEmployeeId={currentEmployeeId}
            onReact={onReact}
            onEdit={onEdit}
            onDelete={onDelete}
            onReply={() => {}}
            onPin={() => {}}
            getSignedUrl={getSignedUrl}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-3 border-t border-gray-100">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <FormattingToolbar textareaRef={textareaRef} value={input} onChange={setInput} />
          <Textarea
            ref={textareaRef}
            placeholder={t('collaborationHub.replyPlaceholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={2}
            className="resize-none text-sm border-0 rounded-none focus-visible:ring-0"
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Search overlay (channel-scoped) ───────────────────────────────────────────

function SearchOverlay({
  channelId,
  onClose,
  searchMessages,
  onSelectMessage,
}: {
  channelId: string;
  onClose: () => void;
  searchMessages: (q: string, channelId?: string) => Promise<ChatMessage[]>;
  onSelectMessage: (msg: ChatMessage) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchMessages(query, channelId);
      setResults(res);
      setSearching(false);
    }, 300);
  }, [query, channelId]);

  return (
    <div className="absolute inset-x-0 top-0 bg-white border-b border-gray-200 shadow-lg z-20 p-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          className="flex-1 text-sm outline-none"
          placeholder={t('collaborationHub.searchMessages')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      {(results.length > 0 || searching) && (
        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {searching && <p className="text-xs text-gray-400 text-center py-2">{t('common.loading')}</p>}
          {results.map(msg => (
            <button
              key={msg.id}
              onClick={() => { onSelectMessage(msg); onClose(); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
            >
              <p className="text-xs font-semibold text-gray-700">{msg.sender_name} · {formatTime(msg.created_at)}</p>
              <p className="text-sm text-gray-600 truncate">{msg.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CollaborationHub({ accessToken, onLogout }: CollaborationHubProps) {
  const { currentUser } = useUser();
  const employeeId = currentUser?.employeeId ?? null;
  const userRole = (currentUser as { role?: string } | null)?.role;
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager' || userRole === 'hr_admin';

  const {
    channels,
    selectedChannel,
    messages,
    threadMessages,
    threadParent,
    presenceMap,
    allUsers,
    loadingChannels,
    loadingMessages,
    selectChannel,
    openThread,
    closeThread,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    createChannel,
    findOrCreateDM,
    uploadFile,
    getSignedUrl,
    searchMessages,
    loadChannels,
  } = useChatData(currentUser);

  // UI state
  const [messageInput, setMessageInput] = useState('');
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileCaption, setFileCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // New feature state
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showBrowseChannels, setShowBrowseChannels] = useState(false);
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load pinned messages when channel changes
  useEffect(() => {
    if (!selectedChannel) { setPinnedMessages([]); return; }
    supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', selectedChannel.id)
      .eq('is_deleted', false)
      .then(async ({ data }) => {
        if (!data) return;
        const pinned = data.filter(m => (m.metadata as Record<string, unknown> | null)?.is_pinned);
        if (pinned.length === 0) { setPinnedMessages([]); return; }
        // Enrich with sender names
        const senderIds = [...new Set(pinned.map(m => m.sender_id))];
        const { data: users } = await supabase.from('app_users').select('id, name').in('id', senderIds);
        const userMap: Record<string, string> = {};
        for (const u of users ?? []) userMap[u.id] = u.name;
        setPinnedMessages(pinned.map(m => ({ ...m, sender_name: userMap[m.sender_id] ?? 'Unknown' })) as ChatMessage[]);
      });
  }, [selectedChannel?.id]);

  // Cmd+K global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Presence/typing per channel
  useEffect(() => {
    if (!selectedChannel || !currentUser) return;

    if (presenceChannelRef.current) {
      void presenceChannelRef.current.unsubscribe();
    }

    const ch = supabase.channel(`presence:${selectedChannel.id}`);
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ user_id: string; name: string; isTyping: boolean }>();
      const typers = Object.values(state)
        .flat()
        .filter(u => u.isTyping && u.user_id !== employeeId)
        .map(u => u.name);
      setTypingNames(typers);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: employeeId, name: currentUser.name, isTyping: false });
      }
    });

    presenceChannelRef.current = ch;
    return () => { void ch.unsubscribe(); };
  }, [selectedChannel?.id, currentUser, employeeId]);

  // Realtime postgres_changes subscription for messages in selected channel
  useEffect(() => {
    if (!selectedChannel) return;

    const sub = supabase
      .channel(`collab-messages-${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        // useChatData already handles this; guard against duplicates
        void newMsg;
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
        const updated = payload.new as ChatMessage;
        // useChatData already handles UPDATE; guard against duplicates
        void updated;
      })
      .subscribe();

    return () => { void supabase.removeChannel(sub); };
  }, [selectedChannel?.id]);

  // Typing indicator
  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (!presenceChannelRef.current || !currentUser) return;
    void presenceChannelRef.current.track({ user_id: employeeId, name: currentUser.name, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void presenceChannelRef.current?.track({ user_id: employeeId, name: currentUser.name, isTyping: false });
    }, 3000);
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChannel) return;
    const content = messageInput;
    setMessageInput('');
    if (presenceChannelRef.current) {
      void presenceChannelRef.current.track({ user_id: employeeId, name: currentUser?.name, isTyping: false });
    }
    await sendMessage(content, selectedChannel.id);
  };

  const handleSendReply = async (content: string) => {
    if (!selectedChannel || !threadParent) return;
    await sendMessage(content, selectedChannel.id, threadParent.id);
  };

  const handleEditSave = async () => {
    if (!editingMsg) return;
    await editMessage(editingMsg.id, editContent);
    setEditingMsg(null);
    setEditContent('');
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm(t('collaborationHub.deleteConfirm'))) return;
    await deleteMessage(msgId);
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditContent(msg.content);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = '';
  };

  const handleFileUploadSend = async () => {
    if (!pendingFile || !selectedChannel) return;
    setUploading(true);

    const caption = fileCaption.trim() || pendingFile.name;
    const { data: msgRow } = await supabase.from('chat_messages').insert([{
      channel_id: selectedChannel.id,
      sender_id: employeeId,
      content: caption,
      message_type: 'file',
      is_edited: false,
      is_deleted: false,
    }]).select().single();

    if (msgRow) {
      await uploadFile(pendingFile, selectedChannel.id, msgRow.id);
    }

    setPendingFile(null);
    setFileCaption('');
    setUploading(false);
  };

  const handleNewDMSelect = async (user: AppUser) => {
    setShowNewDM(false);
    if (!user.employee_id) return;
    const ch = await findOrCreateDM(user.employee_id);
    if (ch) await selectChannel(ch);
  };

  const handleCreateChannel = async (name: string, desc: string, isPrivate: boolean) => {
    const ch = await createChannel(name, desc, isPrivate);
    if (ch) await selectChannel(ch);
  };

  // Pin / unpin message
  const handlePin = async (msgId: string, currentlyPinned: boolean) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const existingMeta = (msg.metadata as Record<string, unknown> | null) ?? {};
    const newMeta = { ...existingMeta, is_pinned: !currentlyPinned };
    void supabase.from('chat_messages').update({ metadata: newMeta }).eq('id', msgId);

    // Optimistic update
    const updateMsg = (m: ChatMessage) => m.id === msgId ? { ...m, metadata: newMeta } : m;
    // Re-load pinned messages
    if (!currentlyPinned) {
      const updated = { ...msg, metadata: newMeta, sender_name: msg.sender_name };
      setPinnedMessages(prev => [...prev, updated as ChatMessage]);
    } else {
      setPinnedMessages(prev => prev.filter(m => m.id !== msgId));
    }
  };

  // Navigate to message from global search
  const handleNavigateToMessage = async (channelId: string, msgId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;
    if (selectedChannel?.id !== channelId) {
      await selectChannel(channel);
    }
    // Wait for messages to load, then highlight
    setTimeout(() => {
      const el = messageRefs.current[msgId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightMsgId(msgId);
      setTimeout(() => setHighlightMsgId(null), 2500);
    }, 600);
  };

  // Channel grouping
  const publicChannels = channels.filter(c => c.type === 'channel');
  const dmChannels = channels.filter(c => c.type === 'dm');
  const groupDMs = channels.filter(c => c.type === 'group_dm');

  const getDMDisplayName = (ch: ChatChannel): string => {
    if (ch.type !== 'dm') return ch.name;
    const otherEmpId = (ch.member_employee_ids ?? []).find(id => id !== employeeId);
    if (!otherEmpId) return ch.name;
    const user = allUsers.find(u => u.employee_id === otherEmpId);
    return user?.name ?? ch.name;
  };

  const getDMPresenceStatus = (ch: ChatChannel): string | undefined => {
    if (ch.type !== 'dm') return undefined;
    const otherEmpId = (ch.member_employee_ids ?? []).find(id => id !== employeeId);
    if (!otherEmpId) return undefined;
    return presenceMap[otherEmpId]?.status;
  };

  const channelDisplayName = selectedChannel
    ? (selectedChannel.type === 'dm' ? getDMDisplayName(selectedChannel) : selectedChannel.name)
    : '';

  const userPresenceStatus = employeeId ? presenceMap[employeeId]?.status : undefined;

  const isChannelAdminOrCreator = selectedChannel
    ? (selectedChannel.member_role === 'admin' || selectedChannel.created_by === employeeId || isManagerOrAdmin)
    : false;

  return (
    <AppLayout
      title={t('collaborationHub.title')}
      icon={<MessageSquare className="h-6 w-6" />}
      onLogout={onLogout}
    >
      <div className="h-[calc(100vh-120px)] flex gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <div className="w-60 bg-[#1e1b4b] flex flex-col flex-shrink-0">

          {/* User status bar */}
          <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {(currentUser?.name ?? 'U')[0].toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${presenceColor(userPresenceStatus)} rounded-full border-2 border-[#1e1b4b]`} />
            </div>
            <span className="text-white/80 text-sm font-medium truncate flex-1">{currentUser?.name}</span>
          </div>

          {/* Global search trigger */}
          <div className="px-3 py-2">
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Search className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
              <span className="text-white/40 text-xs flex-1 text-left">{t('collaborationHub.searchPlaceholder')}</span>
              <span className="ml-auto text-white/30 text-xs">⌘K</span>
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">

            {/* CHANNELS */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1 group">
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                  {t('collaborationHub.channels')}
                </span>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5 text-white/50" />
                </button>
              </div>
              {loadingChannels && (
                <p className="text-white/30 text-xs px-3 py-1">{t('collaborationHub.loadingChannels')}</p>
              )}
              {publicChannels.map(ch => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isSelected={selectedChannel?.id === ch.id}
                  onClick={() => selectChannel(ch)}
                />
              ))}
            </div>

            {/* DIRECT MESSAGES */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1 group">
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                  {t('collaborationHub.directMessages')}
                </span>
                <button
                  onClick={() => setShowNewDM(true)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5 text-white/50" />
                </button>
              </div>
              {dmChannels.map(ch => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isSelected={selectedChannel?.id === ch.id}
                  onClick={() => selectChannel(ch)}
                  presenceStatus={getDMPresenceStatus(ch)}
                  dmOtherName={getDMDisplayName(ch)}
                />
              ))}
              <button
                onClick={() => setShowNewDM(true)}
                className="w-full text-left px-3 py-1 text-indigo-400 text-xs hover:underline"
              >
                {t('collaborationHub.newMessage')}
              </button>
            </div>

            {/* GROUP DMs */}
            {groupDMs.length > 0 && (
              <div>
                <div className="flex items-center px-1 mb-1">
                  <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                    {t('collaborationHub.groupDMs')}
                  </span>
                </div>
                {groupDMs.map(ch => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isSelected={selectedChannel?.id === ch.id}
                    onClick={() => selectChannel(ch)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar footer — Browse Channels */}
          <div className="px-3 py-2 border-t border-white/10">
            <button
              onClick={() => setShowBrowseChannels(true)}
              className="w-full flex items-center gap-2 text-white/50 hover:text-white/80 text-xs py-1.5 px-2 rounded hover:bg-white/10 transition-colors"
            >
              <Hash className="h-3.5 w-3.5" />
              {t('collaborationHub.browseChannels')}
            </button>
          </div>
        </div>

        {/* ── MAIN AREA ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedChannel ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Message area */}
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Channel header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedChannel.type === 'dm' ? (
                      <span className="text-gray-900 font-semibold truncate">{channelDisplayName}</span>
                    ) : (
                      <>
                        {selectedChannel.is_private ? (
                          <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <Hash className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        )}
                        <span className="text-gray-900 font-semibold truncate">{channelDisplayName}</span>
                      </>
                    )}
                    {selectedChannel.description && (
                      <>
                        <span className="text-gray-300 mx-1">|</span>
                        <span className="text-gray-500 text-sm truncate hidden md:block">{selectedChannel.description}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setShowSearch(s => !s)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      title={t('collaborationHub.searchMessages')}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {isChannelAdminOrCreator && selectedChannel.type === 'channel' && (
                      <button
                        onClick={() => setShowChannelSettings(s => !s)}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${showChannelSettings ? 'bg-gray-100 text-indigo-600' : 'text-gray-500'}`}
                        title={t('collaborationHub.channelSettings')}
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search overlay */}
                <div className="relative flex-shrink-0">
                  <AnimatePresence>
                    {showSearch && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <SearchOverlay
                          channelId={selectedChannel.id}
                          onClose={() => setShowSearch(false)}
                          searchMessages={searchMessages}
                          onSelectMessage={() => setShowSearch(false)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pinned messages bar */}
                <PinnedBar
                  pinnedMessages={pinnedMessages}
                  onOpenDrawer={() => setShowPinnedDrawer(true)}
                />

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  {loadingMessages && (
                    <div className="flex justify-center py-8">
                      <span className="text-sm text-gray-400">{t('collaborationHub.loadingMessages')}</span>
                    </div>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="h-12 w-12 text-gray-200 mb-3" />
                      <p className="text-gray-400 text-sm">{t('collaborationHub.noMessages')}</p>
                    </div>
                  )}

                  {messages.map((msg, i) => {
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showDateSep = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at);
                    const grouped = !showDateSep && prevMsg ? sameGroup(prevMsg, msg) : false;

                    if (editingMsg?.id === msg.id) {
                      return (
                        <div key={msg.id} className="mt-4 mx-2">
                          <Textarea
                            autoFocus
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                              if (e.key === 'Escape') { setEditingMsg(null); }
                            }}
                            rows={2}
                            className="text-sm mb-1 resize-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleEditSave} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs">
                              {t('common.save')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingMsg(null)} className="h-7 text-xs">
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        ref={el => { messageRefs.current[msg.id] = el; }}
                      >
                        {showDateSep && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                            <div className="flex-1 border-t border-gray-200" />
                          </div>
                        )}
                        <MessageItem
                          msg={msg}
                          isGrouped={grouped}
                          currentEmployeeId={employeeId}
                          isManagerOrAdmin={isManagerOrAdmin || isChannelAdminOrCreator}
                          onReact={toggleReaction}
                          onEdit={handleStartEdit}
                          onDelete={handleDelete}
                          onReply={openThread}
                          onPin={handlePin}
                          getSignedUrl={getSignedUrl}
                          highlight={highlightMsgId === msg.id}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing indicator */}
                <TypingIndicator typingNames={typingNames} />

                {/* File upload modal */}
                <AnimatePresence>
                  {pendingFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mx-4 mb-2 p-3 border border-indigo-200 rounded-xl bg-indigo-50"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <FileIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{pendingFile.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(pendingFile.size)}</p>
                        </div>
                        <button onClick={() => setPendingFile(null)} className="p-1 rounded hover:bg-indigo-100">
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                      <Input
                        placeholder={t('collaborationHub.addCaption')}
                        value={fileCaption}
                        onChange={e => setFileCaption(e.target.value)}
                        className="mb-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleFileUploadSend}
                          disabled={uploading}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          {uploading ? t('collaborationHub.uploadProgress') : t('collaborationHub.uploadSend')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingFile(null)}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message input */}
                <div className="px-4 pb-4 pt-2 border-t border-gray-200 flex-shrink-0 bg-white">
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <FormattingToolbar
                      textareaRef={mainTextareaRef}
                      value={messageInput}
                      onChange={handleInputChange}
                    />
                    <Textarea
                      ref={mainTextareaRef}
                      placeholder={`${t('collaborationHub.messagePlaceholder')} ${selectedChannel.type === 'dm' ? getDMDisplayName(selectedChannel) : '#' + selectedChannel.name}`}
                      value={messageInput}
                      onChange={e => handleInputChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      className="resize-none border-0 rounded-none px-4 py-3 text-sm focus-visible:ring-0 min-h-[44px] max-h-[160px]"
                    />
                    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors">
                          <Smile className="h-4 w-4" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleFileSelect}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt,.md"
                        />
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={!messageInput.trim()}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 h-8 px-4"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thread panel */}
              <AnimatePresence>
                {threadParent && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ThreadPanel
                      parent={threadParent}
                      replies={threadMessages}
                      currentEmployeeId={employeeId}
                      onClose={closeThread}
                      onSendReply={handleSendReply}
                      onReact={toggleReaction}
                      onEdit={handleStartEdit}
                      onDelete={handleDelete}
                      getSignedUrl={getSignedUrl}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pinned messages drawer */}
              <AnimatePresence>
                {showPinnedDrawer && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 288, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <PinnedDrawer
                      pinnedMessages={pinnedMessages}
                      onClose={() => setShowPinnedDrawer(false)}
                      onUnpin={(msgId) => handlePin(msgId, true)}
                      isManagerOrAdmin={isManagerOrAdmin || isChannelAdminOrCreator}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Channel settings panel */}
              <AnimatePresence>
                {showChannelSettings && isChannelAdminOrCreator && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ChannelSettingsPanel
                      channel={selectedChannel}
                      currentEmployeeId={employeeId}
                      allUsers={allUsers}
                      onClose={() => setShowChannelSettings(false)}
                      onChannelUpdated={loadChannels}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* No channel selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="h-16 w-16 text-gray-200 mb-4" />
              <p className="text-lg font-medium text-gray-500">{t('collaborationHub.selectChannel')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('collaborationHub.selectChannelHint')}</p>
              <Button
                onClick={() => setShowNewDM(true)}
                className="mt-6 bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('collaborationHub.newMessage')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateChannel && (
          <CreateChannelModal
            onClose={() => setShowCreateChannel(false)}
            onCreate={handleCreateChannel}
          />
        )}
        {showNewDM && (
          <NewDMModal
            allUsers={allUsers}
            currentEmployeeId={employeeId}
            presenceMap={presenceMap}
            onSelect={handleNewDMSelect}
            onClose={() => setShowNewDM(false)}
          />
        )}
        {showBrowseChannels && (
          <BrowseChannelsModal
            currentEmployeeId={employeeId}
            joinedChannelIds={channels.map(c => c.id)}
            onJoin={(channelId) => {
              setShowBrowseChannels(false);
              loadChannels();
            }}
            onClose={() => setShowBrowseChannels(false)}
          />
        )}
        {globalSearchOpen && (
          <GlobalSearchModal
            channels={channels}
            onClose={() => setGlobalSearchOpen(false)}
            onNavigate={handleNavigateToMessage}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

export default CollaborationHub;
