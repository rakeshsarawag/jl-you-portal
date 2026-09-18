/**
 * useChatData — Supabase data layer for CollaborationHub.
 * All persistence is server-side; no localStorage.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, API_BASE, apiHeaders } from '../../utils/constants';
import { CurrentUser } from '../../context/UserContext';
import { toast } from 'sonner';
import { t } from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  type: 'channel' | 'dm' | 'group_dm';
  is_private: boolean;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  // Joined fields
  member_role?: string;
  last_read_at?: string | null;
  muted?: boolean;
  unread_count?: number;
  member_employee_ids?: string[];
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  thread_parent_id: string | null;
  content: string;
  message_type: string;
  is_edited: boolean;
  is_deleted: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined
  sender_name?: string;
  sender_avatar?: string;
  reactions?: ReactionGroup[];
  attachments?: ChatAttachment[];
  reply_count?: number;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
  user_ids: string[];
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  thumbnail_path: string | null;
}

export interface PresenceUser {
  employee_id: string;
  status: 'online' | 'away' | 'offline';
  last_seen_at: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  employee_id?: string | null;
  department?: string;
  avatar_url?: string;
}

// ── Helper ──────────────────────────────────────────────────────────────────

function groupReactions(
  rawReactions: { emoji: string; employee_id: string }[],
  currentEmployeeId: string | null
): ReactionGroup[] {
  const map: Record<string, { count: number; user_ids: string[] }> = {};
  for (const r of rawReactions) {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, user_ids: [] };
    map[r.emoji].count++;
    map[r.emoji].user_ids.push(r.employee_id);
  }
  return Object.entries(map).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    user_ids: data.user_ids,
    reacted_by_me: currentEmployeeId ? data.user_ids.includes(currentEmployeeId) : false,
  }));
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useChatData(currentUser: CurrentUser | null) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannelState] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceUser>>({});
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const employeeId = currentUser?.employeeId ?? null;
  const userId = currentUser?.id ?? null;
  // localId is used for all chat DB operations — employee UUID when available, auth UUID otherwise
  const localId = employeeId ?? userId;

  const realtimeSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Presence setup ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!employeeId) return;

    // Set online on mount
    void supabase.from('user_presence').upsert(
      { employee_id: employeeId, status: 'online', last_seen_at: new Date().toISOString() },
      { onConflict: 'employee_id' }
    );

    heartbeatRef.current = setInterval(() => {
      void supabase.from('user_presence')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('employee_id', employeeId);
    }, 30000);

    const handleVisibility = () => {
      const status = document.hidden ? 'away' : 'online';
      void supabase.from('user_presence')
        .update({ status, last_seen_at: new Date().toISOString() })
        .eq('employee_id', employeeId);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleUnload = () => {
      navigator.sendBeacon(
        `https://${window.location.host}`,
        JSON.stringify({ type: 'presence_offline', employee_id: employeeId })
      );
      void supabase.from('user_presence')
        .update({ status: 'offline' })
        .eq('employee_id', employeeId);
    };
    window.addEventListener('beforeunload', handleUnload);

    // Subscribe to all presence changes
    const presenceSub = supabase
      .channel('global-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload) => {
        const row = payload.new as PresenceUser;
        if (row?.employee_id) {
          setPresenceMap(prev => ({ ...prev, [row.employee_id]: row }));
        }
      })
      .subscribe();
    presenceSubRef.current = presenceSub;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      void presenceSub.unsubscribe();
      void supabase.from('user_presence')
        .update({ status: 'offline' })
        .eq('employee_id', employeeId);
    };
  }, [localId]);

  // ── Load initial presence snapshot ───────────────────────────────────────

  useEffect(() => {
    supabase.from('user_presence').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, PresenceUser> = {};
        for (const row of data) map[row.employee_id] = row;
        setPresenceMap(map);
      }
    });
  }, []);

  // ── Load all users (for DM search) ───────────────────────────────────────

  useEffect(() => {
    void (async () => {
      // Primary: fetch from directory API (uses service role, always has data)
      try {
        const res = await fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() });
        if (res.ok) {
          const json = await res.json();
          const emps: any[] = json.data ?? json ?? [];
          if (emps.length > 0) {
            setAllUsers(emps.map(e => ({
              id: e.id,
              name: e.name ?? '',
              email: e.email ?? '',
              employee_id: e.id,
              department: e.department ?? null,
            })) as AppUser[]);
            return;
          }
        }
      } catch (_) {
        // fall through to Supabase fallback
      }

      // Fallback: app_users with active status
      const { data: appUsers, error } = await supabase
        .from('app_users')
        .select('id, name, email, employee_id, department')
        .eq('status', 'active')
        .order('name');

      if (appUsers && appUsers.length > 0) {
        setAllUsers(appUsers as AppUser[]);
        return;
      }

      // Last resort: pull from employees table directly
      if (error || !appUsers?.length) {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, name, email, department')
          .eq('status', 'Active')
          .order('name');

        if (emps && emps.length > 0) {
          setAllUsers(emps.map(e => ({
            id: e.id,
            name: e.name ?? '',
            email: e.email ?? '',
            employee_id: e.id,
            department: e.department,
          })) as AppUser[]);
        }
      }
    })();
  }, []);

  // ── Load channels ─────────────────────────────────────────────────────────

  const loadChannels = useCallback(async () => {
    if (!localId) return;
    setLoadingChannels(true);
    try {
      // Query by user_id first (post-migration column), fall back to employee_id
      let memberships: any[] | null = null;
      const { data: byUserId } = await supabase
        .from('chat_channel_members')
        .select('channel_id, role, last_read_at, muted, user_id, employee_id')
        .eq('user_id', localId);
      if (byUserId && byUserId.length > 0) {
        memberships = byUserId;
      } else {
        const { data: byEmpId, error } = await supabase
          .from('chat_channel_members')
          .select('channel_id, role, last_read_at, muted, user_id, employee_id')
          .eq('employee_id', localId);
        if (error) {
          toast.error(t('collaborationHub.errorLoadingChannels'));
          return;
        }
        memberships = byEmpId ?? [];
      }
      const error = null;

      const channelIds = memberships.map(m => m.channel_id);
      if (channelIds.length === 0) {
        setChannels([]);
        return;
      }

      const { data: channelRows, error: chErr } = await supabase
        .from('chat_channels')
        .select('*')
        .in('id', channelIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (chErr || !channelRows) return;

      // Count unread for each channel
      const enriched: ChatChannel[] = await Promise.all(
        channelRows.map(async (ch) => {
          const mem = memberships.find(m => m.channel_id === ch.id);
          let unread_count = 0;
          if (mem?.last_read_at) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('channel_id', ch.id)
              .eq('is_deleted', false)
              .gt('created_at', mem.last_read_at)
              .neq('sender_id', localId);
            unread_count = count ?? 0;
          }

          // For DMs, get the other member's employee_id
          let member_employee_ids: string[] = [];
          if (ch.type === 'dm' || ch.type === 'group_dm') {
            const { data: allMem } = await supabase
              .from('chat_channel_members')
              .select('employee_id')
              .eq('channel_id', ch.id);
            member_employee_ids = (allMem ?? []).map((m: { employee_id: string }) => m.employee_id);
          }

          return {
            ...ch,
            member_role: mem?.role,
            last_read_at: mem?.last_read_at,
            muted: mem?.muted,
            unread_count,
            member_employee_ids,
          } as ChatChannel;
        })
      );

      setChannels(enriched);
    } finally {
      setLoadingChannels(false);
    }
  }, [localId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // ── Load messages for a channel ───────────────────────────────────────────

  const loadMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId)
        .is('thread_parent_id', null)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !data) {
        toast.error(t('collaborationHub.errorLoadingMessages'));
        return;
      }

      // Enrich with sender info + reactions + reply counts
      const enriched = await enrichMessages(data, localId);
      setMessages(enriched);
    } finally {
      setLoadingMessages(false);
    }
  }, [localId]);

  // ── Enrich messages with sender + reactions ───────────────────────────────

  async function enrichMessages(rows: ChatMessage[], eid: string | null): Promise<ChatMessage[]> {
    if (rows.length === 0) return [];

    const senderIds = [...new Set(rows.map(m => m.sender_id))];
    const msgIds = rows.map(m => m.id);

    const [{ data: users }, { data: reactions }, { data: attachments }, { data: replyCounts }] =
      await Promise.all([
        supabase.from('app_users').select('id, name, employee_id').in('id', senderIds),
        supabase.from('chat_message_reactions').select('message_id, emoji, employee_id').in('message_id', msgIds),
        supabase.from('chat_message_attachments').select('*').in('message_id', msgIds),
        supabase.from('chat_messages').select('thread_parent_id').in('thread_parent_id', msgIds).eq('is_deleted', false),
      ]);

    const userMap: Record<string, { name: string; employee_id: string | null }> = {};
    for (const u of users ?? []) userMap[u.id] = { name: u.name, employee_id: u.employee_id };

    // Group reply counts
    const replyCountMap: Record<string, number> = {};
    for (const r of replyCounts ?? []) {
      if (r.thread_parent_id) replyCountMap[r.thread_parent_id] = (replyCountMap[r.thread_parent_id] ?? 0) + 1;
    }

    return rows.map(msg => {
      const sender = userMap[msg.sender_id];
      const msgReactions = (reactions ?? []).filter(r => r.message_id === msg.id);
      const msgAttachments = (attachments ?? []).filter(a => a.message_id === msg.id) as ChatAttachment[];
      return {
        ...msg,
        sender_name: sender?.name ?? 'Unknown',
        reactions: groupReactions(msgReactions, eid),
        attachments: msgAttachments,
        reply_count: replyCountMap[msg.id] ?? 0,
      };
    });
  }

  // ── Select channel ────────────────────────────────────────────────────────

  const selectChannel = useCallback(async (channel: ChatChannel) => {
    setSelectedChannelState(channel);
    setThreadParent(null);
    setThreadMessages([]);

    // Unsubscribe previous realtime
    if (realtimeSubRef.current) {
      await realtimeSubRef.current.unsubscribe();
      realtimeSubRef.current = null;
    }

    await loadMessages(channel.id);

    // Mark as read
    if (localId) {
      void supabase.from('chat_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channel.id)
        .or(`user_id.eq.${localId},employee_id.eq.${localId}`);
    }

    // Realtime subscription
    const sub = supabase
      .channel(`chat:${channel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channel.id}` },
        async (payload) => {
          const raw = payload.new as ChatMessage;
          if (raw.thread_parent_id) {
            // It's a thread reply — update thread if open
            setThreadParent(prev => {
              if (prev && prev.id === raw.thread_parent_id) {
                loadThreadReplies(raw.thread_parent_id!);
              }
              return prev;
            });
            // Update reply count on parent
            setMessages(prev => prev.map(m =>
              m.id === raw.thread_parent_id ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m
            ));
            return;
          }
          if (raw.is_deleted) return;
          const enriched = await enrichMessages([raw], localId);
          setMessages(prev => {
            if (prev.find(m => m.id === raw.id)) return prev;
            return [...prev, ...enriched];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channel.id}` },
        async (payload) => {
          const updated = payload.new as ChatMessage;
          const enriched = await enrichMessages([updated], localId);
          setMessages(prev => prev.map(m => m.id === updated.id ? enriched[0] : m));
        }
      )
      .subscribe();

    realtimeSubRef.current = sub;
  }, [localId, loadMessages]);

  // ── Load thread replies ───────────────────────────────────────────────────

  const loadThreadReplies = useCallback(async (parentId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_parent_id', parentId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const enriched = await enrichMessages(data, localId);
      setThreadMessages(enriched);
    }
  }, [localId]);

  const openThread = useCallback(async (msg: ChatMessage) => {
    setThreadParent(msg);
    await loadThreadReplies(msg.id);
  }, [loadThreadReplies]);

  const closeThread = useCallback(() => {
    setThreadParent(null);
    setThreadMessages([]);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    content: string,
    channelId: string,
    parentId?: string
  ) => {
    if (!localId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    const { error } = await supabase.from('chat_messages').insert([{
      channel_id: channelId,
      sender_id: localId,
      thread_parent_id: parentId ?? null,
      content: trimmed,
      message_type: 'text',
      is_edited: false,
      is_deleted: false,
    }]);

    if (error) {
      toast.error(t('collaborationHub.messageSendError'));
      return;
    }

    // Update channel last_message_at
    void supabase.from('chat_channels')
      .update({ last_message_at: new Date().toISOString(), last_message_preview: trimmed.slice(0, 100) })
      .eq('id', channelId);
  }, [localId]);

  // ── Edit message ──────────────────────────────────────────────────────────

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!localId) return;
    const { error } = await supabase.from('chat_messages')
      .update({ content: newContent.trim(), is_edited: true })
      .eq('id', messageId)
      .eq('sender_id', localId);
    if (error) toast.error(t('collaborationHub.messageSendError'));
    else {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: newContent.trim(), is_edited: true } : m
      ));
      setThreadMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: newContent.trim(), is_edited: true } : m
      ));
    }
  }, [localId]);

  // ── Delete message ────────────────────────────────────────────────────────

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!localId) return;
    const { error } = await supabase.from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);
    if (error) toast.error(t('collaborationHub.messageSendError'));
    else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setThreadMessages(prev => prev.filter(m => m.id !== messageId));
    }
  }, [localId]);

  // ── Toggle reaction ───────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!localId) return;
    const { data: existing } = await supabase
      .from('chat_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('employee_id', localId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      void supabase.from('chat_message_reactions').delete().eq('id', existing.id);
    } else {
      void supabase.from('chat_message_reactions').insert([{ message_id: messageId, employee_id: localId, emoji }]);
    }

    // Optimistic update
    const updateReactions = (msgs: ChatMessage[]) =>
      msgs.map(m => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ?? [];
        const existingGroup = reactions.find(r => r.emoji === emoji);
        if (existing) {
          return {
            ...m,
            reactions: reactions.map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count - 1, reacted_by_me: false, user_ids: r.user_ids.filter(id => id !== localId) }
                : r
            ).filter(r => r.count > 0),
          };
        } else {
          if (existingGroup) {
            return {
              ...m,
              reactions: reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, reacted_by_me: true, user_ids: [...r.user_ids, employeeId] }
                  : r
              ),
            };
          }
          return { ...m, reactions: [...reactions, { emoji, count: 1, reacted_by_me: true, user_ids: [localId] }] };
        }
      });

    setMessages(updateReactions);
    setThreadMessages(updateReactions);
  }, [localId]);

  // ── Create channel ────────────────────────────────────────────────────────

  const createChannel = useCallback(async (
    name: string,
    description: string,
    isPrivate: boolean,
    memberEmployeeIds: string[] = []
  ) => {
    if (!localId) return null;
    const { data: ch, error } = await supabase.from('chat_channels').insert([{
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description: description || null,
      type: 'channel',
      is_private: isPrivate,
      created_by: localId,
      last_message_at: null,
    }]).select().single();

    if (error || !ch) {
      toast.error(t('collaborationHub.channelCreateError'));
      return null;
    }

    // Add creator as admin, additional members as member
    void supabase.from('chat_channel_members').insert([
      { channel_id: ch.id, employee_id: localId, user_id: localId, role: 'admin' },
      ...memberEmployeeIds.filter(id => id !== localId).map(id => ({
        channel_id: ch.id, employee_id: id, user_id: id, role: 'member'
      })),
    ]);

    toast.success(t('collaborationHub.channelCreated'));
    await loadChannels();
    return ch as ChatChannel;
  }, [localId, loadChannels]);

  // ── Find or create DM ─────────────────────────────────────────────────────

  const findOrCreateDM = useCallback(async (otherUserId: string): Promise<ChatChannel | null> => {
    if (!localId || otherUserId === localId) return null;

    // Check if DM already exists by looking for channel names with both IDs
    const possibleNames = [
      `dm-${localId}-${otherUserId}`,
      `dm-${otherUserId}-${localId}`,
    ];
    const { data: existingChannels } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'dm')
      .in('name', possibleNames);

    if (existingChannels && existingChannels.length > 0) {
      const existing = channels.find(c => c.id === existingChannels[0].id);
      if (existing) return existing;
      return {
        ...existingChannels[0],
        type: 'dm',
        member_employee_ids: [localId, otherUserId],
      } as ChatChannel;
    }

    // Create new DM channel
    const { data: ch, error } = await supabase.from('chat_channels').insert([{
      name: `dm-${localId}-${otherUserId}`,
      type: 'dm',
      is_private: true,
      created_by: localId,
    }]).select().single();

    if (error || !ch) {
      console.error('[findOrCreateDM] channel create error:', error);
      return null;
    }

    // Insert both members — use user_id column (post-migration 09, no FK constraint)
    const { error: memErr } = await supabase.from('chat_channel_members').insert([
      { channel_id: ch.id, employee_id: localId, user_id: localId, role: 'member' },
      { channel_id: ch.id, employee_id: otherUserId, user_id: otherUserId, role: 'member' },
    ]);
    if (memErr) console.error('[findOrCreateDM] members insert error:', memErr);

    // Refresh sidebar in background
    void loadChannels();

    return {
      ...ch,
      type: 'dm',
      member_employee_ids: [localId, otherUserId],
    } as ChatChannel;
  }, [localId, channels, loadChannels]);

  // ── Upload file ───────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (
    file: File,
    channelId: string,
    messageId: string
  ): Promise<string | null> => {
    const BLOCKED = ['.exe', '.bat', '.sh', '.ps1', '.cmd', '.com', '.vbs', '.msi', '.dmg', '.app'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (BLOCKED.includes(ext)) {
      toast.error(t('collaborationHub.fileTypeBlocked'));
      return null;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('collaborationHub.fileTooBig'));
      return null;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${channelId}/${messageId}_${safeName}`;

    const { error } = await supabase.storage.from('chat-files').upload(path, file, { upsert: false });
    if (error) {
      toast.error(t('collaborationHub.fileUploadError'));
      return null;
    }

    void supabase.from('chat_message_attachments').insert([{
      message_id: messageId,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      storage_path: path,
    }]);

    toast.success(t('collaborationHub.fileUploadSuccess'));
    return path;
  }, []);

  // ── Get signed URL ────────────────────────────────────────────────────────

  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('chat-files').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  }, []);

  // ── Search messages ───────────────────────────────────────────────────────

  const searchMessages = useCallback(async (query: string, channelId?: string): Promise<ChatMessage[]> => {
    if (!query.trim()) return [];
    let q = supabase.from('chat_messages').select('*').textSearch('content', query).eq('is_deleted', false);
    if (channelId) q = q.eq('channel_id', channelId);
    const { data } = await q.limit(30);
    if (!data) return [];
    return enrichMessages(data, localId);
  }, [localId]);

  return {
    localId,
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
  };
}
