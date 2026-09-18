import { useState, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { SLA_HOURS } from '../../constants/apps/it-services';

const IT_URL = `${API_BASE}/it-services`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  ticketId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Pending User' | 'Resolved' | 'Closed';
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  assignedToName?: string;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ITStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  avgResolutionHours: number;
}

export interface SLAStatus {
  hoursElapsed: number;
  slaHours: number;
  breached: boolean;
  urgencyColor: string;
}

// ── API Helper ───────────────────────────────────────────────────────────────

async function api(path: string, options: RequestInit = {}, userEmail?: string) {
  const res = await fetch(`${IT_URL}${path}`, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return data;
}

// ── Normalizer ───────────────────────────────────────────────────────────────

function normalizeTicket(t: any): Ticket {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber ?? t.ticket_number ?? '',
    title: t.title ?? '',
    description: t.description ?? '',
    category: t.category ?? 'General',
    priority: t.priority ?? 'Medium',
    status: t.status ?? 'Open',
    createdBy: t.createdBy ?? t.created_by ?? '',
    createdByName: t.createdByName ?? t.created_by_name ?? '',
    assignedTo: t.assignedTo ?? t.assigned_to,
    assignedToName: t.assignedToName ?? t.assigned_to_name,
    comments: (t.comments ?? t.ticket_comments ?? []).map((c: any) => ({
      id: c.id,
      ticketId: c.ticketId ?? c.ticket_id,
      author: c.author ?? c.author_name ?? '',
      content: c.content ?? '',
      createdAt: c.createdAt ?? c.created_at ?? '',
    })),
    createdAt: t.createdAt ?? t.created_at ?? '',
    updatedAt: t.updatedAt ?? t.updated_at ?? '',
    resolvedAt: t.resolvedAt ?? t.resolved_at,
  };
}

// ── SLA Helper ───────────────────────────────────────────────────────────────

export function getSLAStatus(ticket: Ticket): SLAStatus {
  const slaHours = SLA_HOURS[ticket.priority] ?? 24;
  const start = new Date(ticket.createdAt).getTime();
  const end = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : Date.now();
  const hoursElapsed = (end - start) / (1000 * 60 * 60);
  const breached = hoursElapsed > slaHours;
  const pct = hoursElapsed / slaHours;

  let urgencyColor = 'green';
  if (breached) urgencyColor = 'red';
  else if (pct >= 0.9) urgencyColor = 'red';
  else if (pct >= 0.5) urgencyColor = 'orange';

  return { hoursElapsed, slaHours, breached, urgencyColor };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useITServicesData(userEmail?: string) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<ITStats>({
    total: 0, open: 0, inProgress: 0, resolved: 0, critical: 0, avgResolutionHours: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);

    const ticketPath = userId
      ? `/tickets?createdBy=${encodeURIComponent(userId)}`
      : '/tickets';

    const [ticketsResult, statsResult] = await Promise.allSettled([
      api(ticketPath),
      api('/stats', {}, userEmail),
    ]);

    if (ticketsResult.status === 'fulfilled') {
      const d = ticketsResult.value;
      const raw: any[] = Array.isArray(d) ? d : (d.data ?? []);
      setTickets(raw.map(normalizeTicket));
    } else {
      setError(ticketsResult.reason?.message ?? 'Failed to load tickets');
    }

    if (statsResult.status === 'fulfilled') {
      const s = (statsResult.value?.data ?? statsResult.value) as any;
      setStats({
        total: s.total ?? s.totalTickets ?? 0,
        open: s.open ?? s.openTickets ?? 0,
        inProgress: s.inProgress ?? s.inProgressTickets ?? 0,
        resolved: s.resolved ?? s.resolvedTickets ?? 0,
        critical: s.critical ?? s.criticalTickets ?? 0,
        avgResolutionHours: s.avgResolutionHours ?? 0,
      });
    }

    setLoading(false);
  }, []);

  const createTicket = useCallback(async (payload: Partial<Ticket>) => {
    const data = await api('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, userEmail);
    const ticket = normalizeTicket(data.data ?? data);
    setTickets(prev => [ticket, ...prev]);
    return ticket;
  }, []);

  const updateTicket = useCallback(async (id: string, updates: Partial<Ticket>) => {
    const data = await api(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    const updated = normalizeTicket(data.data ?? data);
    setTickets(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  }, []);

  const closeTicket = useCallback(async (id: string) => {
    return updateTicket(id, { status: 'Closed' });
  }, [updateTicket]);

  const resolveTicket = useCallback(async (id: string) => {
    return updateTicket(id, {
      status: 'Resolved',
      resolvedAt: new Date().toISOString(),
    });
  }, [updateTicket]);

  const deleteTicket = useCallback(async (id: string, confirm: boolean) => {
    if (!confirm) return;
    await api(`/tickets/${id}`, { method: 'DELETE' }, userEmail);
    setTickets(prev => prev.filter(t => t.id !== id));
  }, []);

  const assignTicket = useCallback(async (id: string, agentId: string, agentName: string) => {
    return updateTicket(id, { assignedTo: agentId, assignedToName: agentName });
  }, [updateTicket]);

  const addComment = useCallback(async (ticketId: string, content: string, author: string) => {
    const data = await api(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, author }),
    }, userEmail);
    const updated: Ticket = data.data ?? data;
    if (updated && updated.id) {
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
    }
    return updated;
  }, []);

  return {
    tickets,
    stats,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createTicket,
    updateTicket,
    closeTicket,
    resolveTicket,
    deleteTicket,
    assignTicket,
    addComment,
    getSLAStatus,
  };
}
