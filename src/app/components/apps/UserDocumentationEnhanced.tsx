/**
 * User Documentation - Enhanced Version with Supabase CMS
 * Comprehensive documentation for all Portal Jeshan Labs applications
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Search,
  BookOpen,
  HelpCircle,
  Video,
  FileText,
  ChevronRight,
  ChevronDown,
  Download,
  Users,
  Briefcase,
  UserPlus,
  TrendingUp,
  Settings,
  GraduationCap,
  DollarSign,
  Share2,
  Database,
  Layout,
  MessageSquare,
  Package,
  Target,
  BookMarked,
  Shield,
  Zap,
  BarChart3,
  Bot,
  GitBranch,
  Lock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Info,
  Star,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import { t } from '../../../i18n';
import { toast } from 'sonner';

// Icon map for DB icon strings
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UserPlus,
  Layout,
  Briefcase,
  TrendingUp,
  Settings,
  GraduationCap,
  DollarSign,
  Share2,
  Database,
  MessageSquare,
  Package,
  Target,
  BookMarked,
  Shield,
  Zap,
  BarChart3,
  Bot,
  GitBranch,
  Lock,
  Layers,
  Users,
  BookOpen,
  FileText,
  Star,
};

const COLOR_MAP: Record<string, string> = {
  HR: 'bg-blue-500',
  Finance: 'bg-emerald-500',
  Operations: 'bg-violet-500',
  Business: 'bg-orange-500',
  Admin: 'bg-gray-700',
  Communications: 'bg-pink-500',
};

function getAppColor(category: string, idx: number): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-emerald-500', 'bg-blue-600',
    'bg-green-600', 'bg-violet-500', 'bg-pink-500', 'bg-cyan-500',
    'bg-red-500', 'bg-slate-500', 'bg-amber-500', 'bg-gray-700',
    'bg-red-600', 'bg-blue-700', 'bg-indigo-600', 'bg-purple-600',
    'bg-emerald-600', 'bg-teal-600', 'bg-red-700', 'bg-slate-700', 'bg-zinc-600',
  ];
  return COLOR_MAP[category] || colors[idx % colors.length];
}

interface AppDocumentationProps {
  accessToken: string;
  onLogout: () => void;
}

interface DbApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  route: string;
  category: string;
  role_access: string[];
  sort_order: number;
  is_active: boolean;
}

interface DbQuickStep {
  id: string;
  app_id: string;
  step_number: number;
  title: string;
  description: string;
  screenshot_url?: string;
}

interface DbFaq {
  id: string;
  app_id: string;
  category: 'basic' | 'technical' | 'troubleshooting';
  question: string;
  answer: string;
  status: string;
}

interface DbSection {
  id: string;
  app_id: string;
  section_type: string;
  title: string;
  content: unknown;
  sort_order: number;
  status: string;
  view_count: number;
}

interface DbVideo {
  id: string;
  app_id: string;
  title: string;
  youtube_url: string;
  thumbnail_url?: string;
  duration_mins?: number;
}

interface DbVideoAdmin {
  id: string;
  app_id: string;
  title: string;
  url: string;
  duration_seconds: number;
  thumbnail_url?: string;
  created_at?: string;
}

interface AdminSection {
  id?: string;
  title: string;
  content: string;
}

interface FeedbackRow {
  faq_id: string;
  question: string;
  helpful: number;
  not_helpful: number;
}

interface SearchResult {
  type: 'faq' | 'section' | 'step';
  id: string;
  title: string;
  subtitle?: string;
  targetTab?: string;
}

const CATEGORIES = ['All', 'HR', 'Finance', 'Operations', 'Business', 'Admin', 'Communications'];

export function UserDocumentationEnhanced({ accessToken, onLogout }: AppDocumentationProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // App list state
  const [apps, setApps] = useState<DbApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [faqCountMap, setFaqCountMap] = useState<Record<string, number>>({});
  const [sectionCountMap, setSectionCountMap] = useState<Record<string, number>>({});

  // Selected app state
  const [selectedApp, setSelectedApp] = useState<DbApp | null>(null);
  const [quickSteps, setQuickSteps] = useState<DbQuickStep[]>([]);
  const [faqs, setFaqs] = useState<DbFaq[]>([]);
  const [sections, setSections] = useState<DbSection[]>([]);
  const [videos, setVideos] = useState<DbVideo[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // FAQ category filter
  const [faqCategory, setFaqCategory] = useState('all');

  // In-app search
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('quick-start');

  // Feedback state: faqId -> { voted: boolean, rating: number | null }
  const [feedbackState, setFeedbackState] = useState<Record<string, { voted: boolean; rating: number | null }>>({});
  // Vote counts per FAQ
  const [voteCounts, setVoteCounts] = useState<Record<string, { up: number; down: number }>>({});
  // Section feedback state
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, { voted: boolean; up: number; down: number }>>({});
  // Step feedback state
  const [stepFeedback, setStepFeedback] = useState<Record<string, { voted: boolean }>>({});
  // Accordion: which FAQ is open
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  // Expanded section id for view count tracking
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  // Admin state
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newFaqForm, setNewFaqForm] = useState({ category: 'basic' as DbFaq['category'], question: '', answer: '' });
  const [newStepForm, setNewStepForm] = useState({ title: '', description: '' });
  const [adminSaving, setAdminSaving] = useState(false);

  // Admin CMS sub-tab
  const [adminSubTab, setAdminSubTab] = useState<'apps' | 'videos' | 'guides' | 'feedback'>('apps');

  // Feature 1: Manage Apps
  const [adminApps, setAdminApps] = useState<DbApp[]>([]);
  const [adminAppsLoading, setAdminAppsLoading] = useState(false);

  // Feature 2: Manage Videos
  const [adminVideos, setAdminVideos] = useState<DbVideoAdmin[]>([]);
  const [adminVideosLoading, setAdminVideosLoading] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideoForm, setNewVideoForm] = useState({ app_id: '', title: '', url: '', duration_seconds: '' });

  // Feature 3: Manage Guides
  const [guidesSelectedAppId, setGuidesSelectedAppId] = useState('');
  const [adminSections, setAdminSections] = useState<AdminSection[]>([]);
  const [adminSectionsLoading, setAdminSectionsLoading] = useState(false);

  // Feature 4: Feedback Report
  const [feedbackReport, setFeedbackReport] = useState<FeedbackRow[]>([]);
  const [feedbackReportLoading, setFeedbackReportLoading] = useState(false);

  const isAdmin = currentUser?.roles?.includes('admin') ?? false;
  const canAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hr_manager' || isAdmin;

  // Load apps from DB
  useEffect(() => {
    async function loadApps() {
      setLoadingApps(true);
      const { data } = await supabase
        .from('doc_apps')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data) {
        setApps(data as DbApp[]);
        const appIds = (data as DbApp[]).map((a) => a.id);
        if (appIds.length > 0) {
          const [faqCountRes, sectionCountRes] = await Promise.all([
            supabase.from('doc_faqs').select('app_id').in('app_id', appIds).eq('is_active', true),
            supabase.from('doc_sections').select('app_id').in('app_id', appIds),
          ]);
          if (faqCountRes.data) {
            const countMap: Record<string, number> = {};
            (faqCountRes.data as { app_id: string }[]).forEach((row) => {
              countMap[row.app_id] = (countMap[row.app_id] ?? 0) + 1;
            });
            setFaqCountMap(countMap);
          }
          if (sectionCountRes.data) {
            const secMap: Record<string, number> = {};
            (sectionCountRes.data as { app_id: string }[]).forEach((row) => {
              secMap[row.app_id] = (secMap[row.app_id] ?? 0) + 1;
            });
            setSectionCountMap(secMap);
          }
        }
      }
      setLoadingApps(false);
    }
    void loadApps();
  }, []);

  // Load content when an app is selected
  useEffect(() => {
    if (!selectedApp) return;
    setLoadingContent(true);
    setFaqCategory('all');
    setAppSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setShowAddFaq(false);
    setShowAddStep(false);
    setActiveTab('quick-start');

    async function loadContent() {
      const appId = selectedApp!.id;

      const [stepsRes, faqsRes, sectionsRes, videosRes] = await Promise.all([
        supabase.from('doc_quick_steps').select('*').eq('app_id', appId).order('step_number'),
        supabase.from('doc_faqs').select('*').eq('app_id', appId).eq('status', 'published').order('id'),
        supabase.from('doc_sections').select('*').eq('app_id', appId).eq('status', 'published').order('sort_order'),
        supabase.from('doc_videos').select('*').eq('app_id', appId).eq('status', 'published').order('id'),
      ]);

      setQuickSteps((stepsRes.data as DbQuickStep[]) || []);
      setFaqs((faqsRes.data as DbFaq[]) || []);
      setSections((sectionsRes.data as DbSection[]) || []);
      setVideos((videosRes.data as DbVideo[]) || []);

      // Seed FAQs if empty
      if (!faqsRes.data || faqsRes.data.length === 0) {
        const sampleFaqs = [
          {
            app_id: appId,
            category: 'basic',
            question: `How do I get started with ${selectedApp!.name}?`,
            answer: `Navigate to ${selectedApp!.name} from the launchpad. Review the Quick Start guide for step-by-step instructions to begin using the application.`,
            status: 'published',
          },
          {
            app_id: appId,
            category: 'troubleshooting',
            question: `What should I do if I encounter an error in ${selectedApp!.name}?`,
            answer: "Take note of the error message displayed, then submit an IT support ticket with the error details and steps that led to the issue.",
            status: 'published',
          },
          {
            app_id: appId,
            category: 'technical',
            question: `Who can access ${selectedApp!.name}?`,
            answer: `Access to ${selectedApp!.name} is role-based. Contact your administrator if you believe you need access and cannot find the application in your launchpad.`,
            status: 'published',
          },
        ];
        await supabase.from('doc_faqs').insert(sampleFaqs);
        // Reload after seed
        const { data: seeded } = await supabase
          .from('doc_faqs')
          .select('*')
          .eq('app_id', appId)
          .eq('status', 'published')
          .order('id');
        setFaqs((seeded as DbFaq[]) || []);
      }

      // Load existing feedback for user
      if (currentUser?.id) {
        const faqIds = (faqsRes.data || []).map((f: DbFaq) => f.id);
        if (faqIds.length > 0) {
          const { data: fb } = await supabase
            .from('doc_feedback')
            .select('content_id, rating')
            .eq('user_id', currentUser.id)
            .eq('content_type', 'faq')
            .in('content_id', faqIds);
          if (fb) {
            const map: Record<string, { voted: boolean; rating: number | null }> = {};
            (fb as { content_id: string; rating: number }[]).forEach((row) => {
              map[row.content_id] = { voted: true, rating: row.rating };
            });
            setFeedbackState(map);
          }
        }
      }

      setLoadingContent(false);
    }

    void loadContent();
  }, [selectedApp, currentUser?.id]);

  // In-app search (debounced)
  const handleAppSearch = useCallback((query: string) => {
    setAppSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim() || !selectedApp) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const appId = selectedApp.id;
      const q = `%${query}%`;
      const [faqRes, sectionRes, stepRes] = await Promise.all([
        supabase
          .from('doc_faqs')
          .select('id, question, answer')
          .eq('app_id', appId)
          .or(`question.ilike.${q},answer.ilike.${q}`)
          .limit(5),
        supabase
          .from('doc_sections')
          .select('id, title')
          .eq('app_id', appId)
          .ilike('title', q)
          .limit(5),
        supabase
          .from('doc_quick_steps')
          .select('id, title, description, app_id')
          .eq('app_id', appId)
          .ilike('title', q)
          .limit(5),
      ]);
      const results: SearchResult[] = [];
      (faqRes.data || []).forEach((f: { id: string; question: string; answer: string }) => {
        results.push({ type: 'faq', id: f.id, title: f.question, subtitle: f.answer.slice(0, 80) + '...', targetTab: 'faqs' });
      });
      (sectionRes.data || []).forEach((s: { id: string; title: string }) => {
        results.push({ type: 'section', id: s.id, title: s.title, targetTab: 'guides' });
      });
      (stepRes.data || []).forEach((s: { id: string; title: string; description?: string }) => {
        results.push({ type: 'step', id: s.id, title: s.title, subtitle: s.description?.slice(0, 80), targetTab: 'quick-start' });
      });
      setSearchResults(results);
      setShowSearchDropdown(true);
    }, 300);
  }, [selectedApp]);

  // Escape key closes search dropdown
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAppSearchQuery(''); setShowSearchDropdown(false); } };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Click-outside closes search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle feedback vote
  const handleFeedback = useCallback(async (faqId: string, isHelpful: boolean) => {
    if (!currentUser?.id) return;
    if (feedbackState[faqId]?.voted) return;

    const rating = isHelpful ? 1 : -1;
    setFeedbackState((prev) => ({ ...prev, [faqId]: { voted: true, rating } }));

    void supabase.from('doc_feedback').upsert([{
      faq_id: faqId,
      user_id: currentUser.id,
      is_helpful: isHelpful,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'faq_id,user_id' });

    const { data: counts } = await supabase
      .from('doc_feedback')
      .select('is_helpful')
      .eq('faq_id', faqId);
    if (counts) {
      const up = (counts as { is_helpful: boolean }[]).filter((r) => r.is_helpful).length;
      const down = (counts as { is_helpful: boolean }[]).filter((r) => !r.is_helpful).length;
      setVoteCounts((prev) => ({ ...prev, [faqId]: { up, down } }));
    }
  }, [currentUser?.id, feedbackState]);

  // Section feedback handler
  const handleSectionFeedback = useCallback((sectionId: string, isHelpful: boolean) => {
    if (sectionFeedback[sectionId]?.voted) return;
    void supabase.from('doc_feedback').upsert([{
      content_type: 'section',
      content_id: sectionId,
      user_id: currentUser?.id,
      is_helpful: isHelpful,
    }], { onConflict: 'content_type,content_id,user_id' });
    setSectionFeedback((prev) => ({ ...prev, [sectionId]: { voted: true, up: 0, down: 0 } }));
  }, [sectionFeedback, currentUser?.id]);

  // Step feedback handler
  const handleStepFeedback = useCallback((stepId: string, isHelpful: boolean) => {
    if (stepFeedback[stepId]?.voted) return;
    void supabase.from('doc_feedback').upsert([{
      content_type: 'quick_step',
      content_id: stepId,
      user_id: currentUser?.id,
      is_helpful: isHelpful,
    }], { onConflict: 'content_type,content_id,user_id' });
    setStepFeedback((prev) => ({ ...prev, [stepId]: { voted: true } }));
  }, [stepFeedback, currentUser?.id]);

  // Admin: delete FAQ
  const handleDeleteFaq = useCallback(async (faqId: string) => {
    await supabase.from('doc_faqs').delete().eq('id', faqId);
    setFaqs((prev) => prev.filter((f) => f.id !== faqId));
  }, []);

  // Admin: toggle FAQ publish
  const handleToggleFaqStatus = useCallback(async (faq: DbFaq) => {
    const newStatus = faq.status === 'published' ? 'draft' : 'published';
    await supabase.from('doc_faqs').update({ status: newStatus }).eq('id', faq.id);
    setFaqs((prev) => prev.map((f) => f.id === faq.id ? { ...f, status: newStatus } : f));

    if (newStatus === 'published' && faq.status !== 'published') {
      void supabase.from('notifications').insert([{
        user_id: currentUser?.id,
        title: 'Documentation Published',
        message: "FAQ \"" + faq.question.substring(0, 50) + "...\" has been published",
        type: 'new_doc_published',
        app: 'documentation',
        created_by: currentUser?.id,
      }]);
      void supabase.from('notifications').insert([{
        role: 'all',
        title: 'New documentation available',
        message: 'New FAQ published: ' + faq.question.substring(0, 60),
        type: 'new_doc_published',
        app: 'documentation',
        created_by: currentUser?.id,
      }]);
    }
  }, [currentUser?.id]);

  // Admin: add FAQ
  const handleAddFaq = useCallback(async () => {
    if (!selectedApp || !newFaqForm.question.trim() || !newFaqForm.answer.trim()) return;
    if (newFaqForm.question.trim().length < 10) { toast.error("Question must be at least 10 characters."); return; }
    if (newFaqForm.question.trim().length > 500) { toast.error("Question cannot exceed 500 characters."); return; }
    if (newFaqForm.answer.trim().length < 20) { toast.error("Answer must be at least 20 characters."); return; }
    if (newFaqForm.answer.trim().length > 5000) { toast.error("Answer cannot exceed 5000 characters."); return; }
    setAdminSaving(true);
    const { data } = await supabase.from('doc_faqs').insert([{
      app_id: selectedApp.id,
      category: newFaqForm.category,
      question: newFaqForm.question,
      answer: newFaqForm.answer,
      status: 'published',
    }]).select();
    if (data && data[0]) {
      setFaqs((prev) => [...prev, data[0] as DbFaq]);
      // Feature 1: notify all users of newly published FAQ
      const faqQuestion = newFaqForm.question;
      const { data: allUsers } = await supabase.from('app_users').select('id').limit(100);
      const notifRows = (allUsers ?? []).slice(0, 50).map((u: { id: string }) => ({
        user_id: u.id,
        type: 'new_doc_published',
        title: 'New Documentation Published',
        message: `A new FAQ has been published: "${faqQuestion.slice(0, 80)}"`,
        severity: 'low',
        read: false,
        action_required: false,
        action_data: { doc_type: 'faq', app_name: selectedApp?.name },
      }));
      if (notifRows.length > 0) void supabase.from('notifications').insert(notifRows);
    }
    setNewFaqForm({ category: 'basic', question: '', answer: '' });
    setShowAddFaq(false);
    setAdminSaving(false);
  }, [selectedApp, newFaqForm]);

  // Admin: add quick step
  const handleAddStep = useCallback(async () => {
    if (!selectedApp || !newStepForm.title.trim()) return;
    setAdminSaving(true);
    const stepNumber = quickSteps.length + 1;
    const { data } = await supabase.from('doc_quick_steps').insert([{
      app_id: selectedApp.id,
      step_number: stepNumber,
      title: newStepForm.title,
      description: newStepForm.description,
    }]).select();
    if (data && data[0]) setQuickSteps((prev) => [...prev, data[0] as DbQuickStep]);
    setNewStepForm({ title: '', description: '' });
    setShowAddStep(false);
    setAdminSaving(false);
  }, [selectedApp, newStepForm, quickSteps.length]);

  // Admin: delete step
  const handleDeleteStep = useCallback(async (stepId: string) => {
    await supabase.from('doc_quick_steps').delete().eq('id', stepId);
    setQuickSteps((prev) => prev.filter((s) => s.id !== stepId));
  }, []);

  // ── CMS Admin loaders ──────────────────────────────────────────────────────

  const loadAdminApps = useCallback(async () => {
    setAdminAppsLoading(true);
    const { data } = await supabase.from('doc_apps').select('*').order('sort_order');
    if (data) setAdminApps(data as DbApp[]);
    setAdminAppsLoading(false);
  }, []);

  const loadAdminVideos = useCallback(async () => {
    setAdminVideosLoading(true);
    const { data } = await supabase.from('doc_videos').select('*').order('created_at', { ascending: false });
    if (data) setAdminVideos(data as DbVideoAdmin[]);
    setAdminVideosLoading(false);
  }, []);

  const loadAdminSections = useCallback(async (appId: string) => {
    if (!appId) { setAdminSections([]); return; }
    setAdminSectionsLoading(true);
    const { data } = await supabase.from('doc_sections').select('id, title, content').eq('app_id', appId).order('sort_order');
    if (data) {
      setAdminSections((data as { id: string; title: string; content: unknown }[]).map((s) => ({
        id: s.id,
        title: s.title,
        content: typeof s.content === 'string' ? s.content : (s.content as { text?: string })?.text || '',
      })));
    }
    setAdminSectionsLoading(false);
  }, []);

  const loadFeedbackReport = useCallback(async () => {
    setFeedbackReportLoading(true);
    const [helpRes, nohelpRes, faqRes] = await Promise.all([
      supabase.from('doc_feedback').select('faq_id').eq('is_helpful', true),
      supabase.from('doc_feedback').select('faq_id').eq('is_helpful', false),
      supabase.from('doc_faqs').select('id, question'),
    ]);
    const helpMap: Record<string, number> = {};
    const nohelpMap: Record<string, number> = {};
    (helpRes.data as { faq_id: string }[] || []).forEach((r) => { helpMap[r.faq_id] = (helpMap[r.faq_id] || 0) + 1; });
    (nohelpRes.data as { faq_id: string }[] || []).forEach((r) => { nohelpMap[r.faq_id] = (nohelpMap[r.faq_id] || 0) + 1; });
    const allIds = Array.from(new Set([...Object.keys(helpMap), ...Object.keys(nohelpMap)]));
    const questionMap: Record<string, string> = {};
    (faqRes.data as { id: string; question: string }[] || []).forEach((f) => { questionMap[f.id] = f.question; });
    setFeedbackReport(allIds.map((id) => ({
      faq_id: id,
      question: questionMap[id] || id,
      helpful: helpMap[id] || 0,
      not_helpful: nohelpMap[id] || 0,
    })));
    setFeedbackReportLoading(false);
  }, []);

  // Feature 1: reorder apps
  const handleAppMoveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setAdminApps((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      void supabase.from('doc_apps').upsert(next.map((a, i) => ({ id: a.id, sort_order: i })), { onConflict: 'id' });
      return next;
    });
  }, []);

  const handleAppMoveDown = useCallback((idx: number) => {
    setAdminApps((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      void supabase.from('doc_apps').upsert(next.map((a, i) => ({ id: a.id, sort_order: i })), { onConflict: 'id' });
      return next;
    });
  }, []);

  const handleAppToggleActive = useCallback((app: DbApp) => {
    void supabase.from('doc_apps').update({ is_active: !app.is_active }).eq('id', app.id);
    setAdminApps((prev) => prev.map((a) => a.id === app.id ? { ...a, is_active: !a.is_active } : a));
  }, []);

  // Feature 2: video admin
  const handleAddVideo = useCallback(async () => {
    if (!newVideoForm.title.trim() || !newVideoForm.url.trim() || !newVideoForm.app_id) return;
    const { data } = await supabase.from('doc_videos').insert([{
      app_id: newVideoForm.app_id,
      title: newVideoForm.title,
      url: newVideoForm.url,
      duration_seconds: newVideoForm.duration_seconds ? parseInt(newVideoForm.duration_seconds, 10) : 0,
    }]).select();
    if (data && data[0]) setAdminVideos((prev) => [data[0] as DbVideoAdmin, ...prev]);
    setNewVideoForm({ app_id: '', title: '', url: '', duration_seconds: '' });
    setShowAddVideo(false);
  }, [newVideoForm]);

  const handleDeleteVideo = useCallback((id: string) => {
    void supabase.from('doc_videos').delete().eq('id', id);
    setAdminVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // Feature 3: guide admin
  const handleGuidesAppChange = useCallback((appId: string) => {
    setGuidesSelectedAppId(appId);
    void loadAdminSections(appId);
  }, [loadAdminSections]);

  const handleAddAdminSection = useCallback(() => {
    setAdminSections((prev) => [...prev, { title: '', content: '' }]);
  }, []);

  const handleSaveAllSections = useCallback(() => {
    if (!guidesSelectedAppId) return;
    void supabase.from('doc_sections').upsert(
      adminSections.map((s, i) => ({
        id: s.id,
        app_id: guidesSelectedAppId,
        title: s.title,
        content: s.content,
        sort_order: i,
        status: 'published',
      })),
      { onConflict: 'id' }
    );
    toast.success("Sections saved.");
  }, [guidesSelectedAppId, adminSections]);

  const handleDeleteAdminSection = useCallback((idx: number) => {
    setAdminSections((prev) => {
      const s = prev[idx];
      if (s.id) void supabase.from('doc_sections').delete().eq('id', s.id);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // Format seconds -> MM:SS
  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Download handlers
  const handleDownloadPDF = () => {
    if (!selectedApp) return;
    const appName = selectedApp.name;
    const content = sections.map((s) => {
      const text = typeof s.content === 'string'
        ? s.content
        : (s.content as { text?: string })?.text || '';
      const stepsText = quickSteps
        .map((step, i) => `${i + 1}. ${step.title}: ${step.description}`)
        .join('\n');
      return `# ${s.title}\n\n${text}${stepsText ? '\n\n' + stepsText : ''}`;
    }).join('\n\n---\n\n');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
    <html>
      <head>
        <title>${appName} Documentation</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
          h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
          h2 { color: #374151; margin-top: 32px; }
          hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
          ol { padding-left: 20px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>${content.split('\n').map((line) => {
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        if (line === '---') return '<hr>';
        if (/^\d+\./.test(line)) return `<p>${line}</p>`;
        return line ? `<p>${line}</p>` : '';
      }).join('')}
      </body>
    </html>
  `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadMarkdown = () => {
    if (!selectedApp) return;
    const appName = selectedApp.name;
    const content = [
      `# ${appName} Documentation\n`,
      `> Generated on ${new Date().toLocaleDateString()}\n`,
      ...sections.map((s) => {
        const text = typeof s.content === 'string'
          ? s.content
          : (s.content as { text?: string })?.text || '';
        const stepsText = quickSteps
          .map((step, i) => `${i + 1}. **${step.title}**: ${step.description}`)
          .join('\n');
        return `## ${s.title}\n\n${text}${stepsText ? '\n\n' + stepsText : ''}`;
      }),
    ].join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appName.replace(/\s+/g, '-').toLowerCase()}-documentation.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Filtered apps
  const filteredApps = apps.filter((app) => {
    const matchesCategory = categoryFilter === 'All' || app.category === categoryFilter;
    const matchesSearch = !listSearchQuery
      || app.name.toLowerCase().includes(listSearchQuery.toLowerCase())
      || app.description.toLowerCase().includes(listSearchQuery.toLowerCase());
    const matchesRole = !currentUser || !currentUser.roles || currentUser.roles.includes('admin')
      || (app.role_access && app.role_access.some((r) => currentUser.roles.includes(r as never)));
    return matchesCategory && matchesSearch && matchesRole;
  });

  const filteredFaqs = faqCategory === 'all'
    ? faqs
    : faqs.filter((f) => f.category === faqCategory);

  // Feature 4: basic markdown-style rich text renderer
  const renderContent = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-3 mb-1">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium mt-2 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>;
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-indigo-300 pl-3 text-gray-600 italic text-sm my-2">{line.slice(2)}</blockquote>;
      if (line.startsWith('```')) return <code key={i} className="block bg-gray-100 p-2 rounded text-xs font-mono my-2">{line.slice(3)}</code>;
      if (!line.trim()) return <br key={i} />;
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>');
      return <p key={i} className="text-sm text-gray-700 mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  // Render app list
  const renderAppList = () => (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input
          type="text"
          placeholder={t('docs.searchPlaceholder')}
          value={listSearchQuery}
          onChange={(e) => setListSearchQuery(e.target.value)}
          className="pl-10 py-6 text-lg"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              categoryFilter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loadingApps ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app, idx) => {
            const Icon = ICON_MAP[app.icon] || BookOpen;
            const color = getAppColor(app.category, idx);
            return (
              <Card
                key={app.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedApp(app)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`${color} p-3 rounded-lg text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  <CardTitle className="mt-4">{app.name}</CardTitle>
                  <CardDescription>{app.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(app.role_access || []).slice(0, 3).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                    ))}
                    {(app.role_access || []).length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(app.role_access || []).length - 3} {t('docs.more')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    <Badge variant="outline" className="text-xs">{app.category}</Badge>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {sectionCountMap[app.id] ?? 0} guides
                    </span>
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                      {faqCountMap[app.id] ?? 0} FAQs
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loadingApps && filteredApps.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('docs.noAppsFound')}</p>
        </div>
      )}
    </div>
  );

  // Render app detail
  const renderAppDetail = () => {
    if (!selectedApp) return null;
    const Icon = ICON_MAP[selectedApp.icon] || BookOpen;
    const color = getAppColor(selectedApp.category, 0);

    const tabCount = isAdmin ? 5 : 4;
    const gridCols = tabCount === 5 ? 'grid-cols-5' : 'grid-cols-4';

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`${color} p-4 rounded-xl text-white flex-shrink-0`}>
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{selectedApp.name}</h1>
              <p className="text-gray-600 mt-1">{selectedApp.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(selectedApp.role_access || []).map((role) => (
                  <Badge key={role} variant="outline">{role}</Badge>
                ))}
              </div>
            </div>
          </div>
          <Button
            onClick={() => navigate(selectedApp.route)}
            className={`${color} text-white flex-shrink-0`}
          >
            {t('docs.openApp')}
          </Button>
        </div>

        {/* In-app search */}
        <div ref={searchRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={t('docs.searchThisApp')}
            value={appSearchQuery}
            onChange={(e) => handleAppSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
            className="pl-10"
          />
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                  onClick={() => {
                    setShowSearchDropdown(false);
                    setAppSearchQuery('');
                    setActiveTab(result.targetTab ?? (result.type === 'faq' ? 'faqs' : result.type === 'step' ? 'quick-start' : 'guides'));
                  }}
                >
                  <div className="flex items-center gap-2">
                    {result.type === 'faq'
                      ? <HelpCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      : <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    }
                    <span className="font-medium text-sm text-gray-900 truncate">{result.title}</span>
                  </div>
                  {result.subtitle && (
                    <p className="text-xs text-gray-500 mt-0.5 pl-6 truncate">{result.subtitle}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingContent ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${gridCols} overflow-x-auto`}>
              <TabsTrigger value="quick-start">{t('docs.tabQuickStart')}</TabsTrigger>
              <TabsTrigger value="faqs">{t('docs.tabFaqs')}</TabsTrigger>
              <TabsTrigger value="guides">{t('docs.tabGuides')}</TabsTrigger>
              <TabsTrigger value="videos">{t('docs.tabVideos')}</TabsTrigger>
              {isAdmin && <TabsTrigger value="admin">{t('docs.tabAdmin')}</TabsTrigger>}
            </TabsList>

            {/* Quick Start */}
            <TabsContent value="quick-start" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    {t('docs.quickStartTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('docs.quickStartDesc').replace('{app}', selectedApp.name)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {quickSteps.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">{t('docs.noContentYet')}</p>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setShowAddStep(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {t('docs.addContent')}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ol className="space-y-3">
                      {quickSteps.map((step, index) => (
                        <li key={step.id} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                            {step.step_number || index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{step.title}</p>
                            {step.description && (
                              <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-400">Helpful?</span>
                              <button
                                onClick={() => handleStepFeedback(step.id, true)}
                                disabled={stepFeedback[step.id]?.voted}
                                className="text-xs text-gray-400 hover:text-emerald-500 disabled:opacity-40"
                              >Yes</button>
                              <span className="text-gray-200 text-xs">|</span>
                              <button
                                onClick={() => handleStepFeedback(step.id, false)}
                                disabled={stepFeedback[step.id]?.voted}
                                className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40"
                              >No</button>
                              {stepFeedback[step.id]?.voted && <span className="text-xs text-gray-400 ml-1">✓</span>}
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteStep(step.id)}
                              className="text-gray-400 hover:text-red-500 flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}

                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowAddStep(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('docs.addQuickStep')}
                    </Button>
                  )}

                  {/* Add step form */}
                  {showAddStep && (
                    <div className="mt-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                      <h4 className="font-medium text-sm">{t('docs.addQuickStep')}</h4>
                      <Input
                        placeholder={t('docs.stepTitle')}
                        value={newStepForm.title}
                        onChange={(e) => setNewStepForm((p) => ({ ...p, title: e.target.value }))}
                      />
                      <Input
                        placeholder={t('docs.stepDescription')}
                        value={newStepForm.description}
                        onChange={(e) => setNewStepForm((p) => ({ ...p, description: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddStep} disabled={adminSaving}>
                          {t('common.save')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddStep(false)}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {currentUser && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900">{t('docs.yourAccessLevel')}</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          {t('docs.loggedInAs').replace('{role}', currentUser.primaryRole)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* FAQs */}
            <TabsContent value="faqs" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {['all', 'basic', 'technical', 'troubleshooting'].map((cat) => (
                  <Button
                    key={cat}
                    variant={faqCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFaqCategory(cat)}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </div>

              {filteredFaqs.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">{t('docs.noFaqsFound')}</p>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowAddFaq(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('docs.addFaq')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                filteredFaqs.map((faq) => {
                  const fb = feedbackState[faq.id];
                  const isOpen = openFaqId === faq.id;
                  return (
                    <Card key={faq.id} id={`faq-${faq.id}`}>
                      <CardHeader
                        className="cursor-pointer select-none"
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      >
                        <div className="flex items-start gap-3">
                          <HelpCircle className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <CardTitle className="text-lg font-semibold text-gray-900">
                              {faq.question}
                            </CardTitle>
                            <Badge variant="outline" className="mt-2 text-xs">{faq.category}</Badge>
                          </div>
                          <ChevronDown
                            className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </CardHeader>
                      <div className={isOpen ? 'block' : 'hidden'}>
                        <CardContent className="space-y-4">
                          <p className="text-gray-700">{faq.answer}</p>

                          {/* Feedback */}
                          <div className="border-t pt-3">
                            {fb?.voted ? (
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-green-600 font-medium">
                                  {t('docs.feedbackThanks')}
                                </p>
                                {voteCounts[faq.id] && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    👍 {voteCounts[faq.id].up} · 👎 {voteCounts[faq.id].down}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">{t('docs.wasHelpful')}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); void handleFeedback(faq.id, true); }}
                                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  {t('common.yes')}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); void handleFeedback(faq.id, false); }}
                                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-500 transition-colors"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                  {t('common.no')}
                                </button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  );
                })
              )}

              {isAdmin && (
                <Button variant="outline" onClick={() => setShowAddFaq(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('docs.addFaq')}
                </Button>
              )}

              {showAddFaq && (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">{t('docs.addFaq')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newFaqForm.category}
                      onChange={(e) => setNewFaqForm((p) => ({ ...p, category: e.target.value as DbFaq['category'] }))}
                    >
                      <option value="basic">Basic</option>
                      <option value="technical">Technical</option>
                      <option value="troubleshooting">Troubleshooting</option>
                    </select>
                    <Input
                      placeholder={t('docs.faqQuestion')}
                      value={newFaqForm.question}
                      onChange={(e) => setNewFaqForm((p) => ({ ...p, question: e.target.value }))}
                    />
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                      rows={3}
                      placeholder={t('docs.faqAnswer')}
                      value={newFaqForm.answer}
                      onChange={(e) => setNewFaqForm((p) => ({ ...p, answer: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddFaq} disabled={adminSaving}>
                        {t('common.save')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddFaq(false)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Guides / Sections */}
            <TabsContent value="guides" className="space-y-4">
              {sections.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('docs.noContentYet')}</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      {t('docs.detailedDocs')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sections.map((section) => {
                      const isExpanded = expandedSectionId === section.id;
                      const contentText = typeof section.content === 'string'
                        ? section.content
                        : (section.content as { text?: string })?.text || '';
                      return (
                        <div key={section.id} id={`section-${section.id}`} className="border rounded-lg hover:bg-gray-50">
                          <button
                            className="w-full p-4 text-left flex items-start gap-3"
                            onClick={() => {
                              const opening = expandedSectionId !== section.id;
                              setExpandedSectionId(opening ? section.id : null);
                              if (opening) {
                                // Feature 2: increment view count
                                void supabase.from('doc_sections').update({ view_count: (section.view_count || 0) + 1 }).eq('id', section.id);
                                setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, view_count: (s.view_count || 0) + 1 } : s));
                              }
                            }}
                          >
                            <FileText className="h-5 w-5 text-gray-600 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900">{section.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">{section.section_type}</Badge>
                                {section.view_count > 0 && (
                                  <span className="text-xs text-gray-400">{section.view_count} views</span>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              {/* Feature 4: rich text rendering */}
                              {contentText ? (
                                <div className="prose-sm">{renderContent(contentText)}</div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">No content available.</p>
                              )}
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                                <span className="text-xs text-gray-500">Was this helpful?</span>
                                <button
                                  onClick={() => handleSectionFeedback(section.id, true)}
                                  disabled={sectionFeedback[section.id]?.voted}
                                  className="text-gray-400 hover:text-emerald-500 disabled:opacity-50"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleSectionFeedback(section.id, false)}
                                  disabled={sectionFeedback[section.id]?.voted}
                                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                                {sectionFeedback[section.id]?.voted && <span className="text-xs text-gray-400">Thanks!</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-green-500" />
                    {t('docs.downloadableResources')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={handleDownloadPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      {selectedApp.name} {t('docs.userGuide')} (PDF)
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={handleDownloadMarkdown}>
                      <FileText className="h-4 w-4 mr-2" />
                      {t('docs.quickReferenceCard')} (Markdown)
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      {t('docs.bestPracticesGuide')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Videos */}
            <TabsContent value="videos" className="space-y-4">
              {videos.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Video className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('docs.noVideosYet')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videos.map((video) => (
                    <Card key={video.id} className="overflow-hidden">
                      {video.thumbnail_url && (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-40 object-cover"
                        />
                      )}
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Video className="h-4 w-4 text-red-500" />
                          {video.title}
                        </CardTitle>
                        {video.duration_mins && (
                          <CardDescription>{video.duration_mins} {t('docs.mins')}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <a
                          href={video.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          {t('docs.watchVideo')}
                          <ChevronRight className="h-3 w-3" />
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Admin Tab */}
            {isAdmin && (
              <TabsContent value="admin" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-gray-600" />
                      {t('docs.adminContentManagement')}
                    </CardTitle>
                    <CardDescription>{t('docs.adminDesc')}</CardDescription>
                  </CardHeader>
                </Card>

                {/* Admin sub-tab pills */}
                <div className="flex gap-2 flex-wrap">
                  {(['apps', 'videos', 'guides', 'feedback'] as const).map((tab) => {
                    const labels: Record<string, string> = {
                      apps: t('docs.adminTabApps'),
                      videos: t('docs.adminTabVideos'),
                      guides: t('docs.adminTabGuides'),
                      feedback: t('docs.adminTabFeedback'),
                    };
                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          setAdminSubTab(tab);
                          if (tab === 'apps' && adminApps.length === 0) void loadAdminApps();
                          if (tab === 'videos' && adminVideos.length === 0) void loadAdminVideos();
                          if (tab === 'feedback') void loadFeedbackReport();
                        }}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          adminSubTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* ── Sub-tab: Apps ── */}
                {adminSubTab === 'apps' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('docs.manageApps')}</CardTitle>
                      <CardDescription>{t('docs.manageAppsDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {adminAppsLoading ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('common.loading')}</p>
                      ) : adminApps.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('docs.noContentYet')}</p>
                      ) : (
                        adminApps.map((app, idx) => (
                          <div key={app.id} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                disabled={idx === 0}
                                onClick={() => handleAppMoveUp(idx)}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                title={t('docs.moveUp')}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                disabled={idx === adminApps.length - 1}
                                onClick={() => handleAppMoveDown(idx)}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                title={t('docs.moveDown')}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{app.name}</p>
                              <Badge variant="outline" className="text-xs mt-0.5">{app.category}</Badge>
                            </div>
                            <button
                              onClick={() => handleAppToggleActive(app)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                app.is_active
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {app.is_active ? t('docs.active') : t('docs.inactive')}
                            </button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Sub-tab: Videos ── */}
                {adminSubTab === 'videos' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{t('docs.manageVideos')}</CardTitle>
                        <Button size="sm" variant="outline" onClick={() => { setShowAddVideo(true); if (adminApps.length === 0) void loadAdminApps(); }}>
                          <Plus className="h-4 w-4 mr-1" />
                          {t('docs.addVideo')}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {showAddVideo && (
                        <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                          <h4 className="font-medium text-sm">{t('docs.addVideo')}</h4>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            value={newVideoForm.app_id}
                            onChange={(e) => setNewVideoForm((p) => ({ ...p, app_id: e.target.value }))}
                          >
                            <option value="">{t('docs.selectApp')}</option>
                            {adminApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <Input
                            placeholder={t('docs.videoTitle')}
                            value={newVideoForm.title}
                            onChange={(e) => setNewVideoForm((p) => ({ ...p, title: e.target.value }))}
                          />
                          <Input
                            placeholder={t('docs.videoUrl')}
                            value={newVideoForm.url}
                            onChange={(e) => setNewVideoForm((p) => ({ ...p, url: e.target.value }))}
                          />
                          <Input
                            type="number"
                            placeholder={t('docs.videoDuration')}
                            value={newVideoForm.duration_seconds}
                            onChange={(e) => setNewVideoForm((p) => ({ ...p, duration_seconds: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void handleAddVideo()}>{t('common.save')}</Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddVideo(false)}>{t('common.cancel')}</Button>
                          </div>
                        </div>
                      )}
                      {adminVideosLoading ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('common.loading')}</p>
                      ) : adminVideos.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('docs.noVideosAdmin')}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-gray-500 text-xs">
                                <th className="pb-2 pr-3">{t('docs.colTitle')}</th>
                                <th className="pb-2 pr-3">{t('docs.colApp')}</th>
                                <th className="pb-2 pr-3">{t('docs.colUrl')}</th>
                                <th className="pb-2 pr-3">{t('docs.colDuration')}</th>
                                <th className="pb-2">{t('docs.colActions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminVideos.map((v) => {
                                const appName = adminApps.find((a) => a.id === v.app_id)?.name || v.app_id;
                                return (
                                  <tr key={v.id} className="border-b last:border-b-0">
                                    <td className="py-2 pr-3 font-medium truncate max-w-[140px]">{v.title}</td>
                                    <td className="py-2 pr-3 text-gray-500 truncate max-w-[100px]">{appName}</td>
                                    <td className="py-2 pr-3 text-blue-600 truncate max-w-[120px]">
                                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{v.url}</a>
                                    </td>
                                    <td className="py-2 pr-3 text-gray-500">{v.duration_seconds ? formatDuration(v.duration_seconds) : '—'}</td>
                                    <td className="py-2">
                                      <button onClick={() => handleDeleteVideo(v.id)} className="text-red-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Sub-tab: Guides ── */}
                {adminSubTab === 'guides' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{t('docs.manageGuides')}</CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={handleAddAdminSection}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('docs.addSection')}
                          </Button>
                          <Button size="sm" onClick={handleSaveAllSections} disabled={!guidesSelectedAppId}>
                            {t('docs.saveAll')}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={guidesSelectedAppId}
                        onChange={(e) => handleGuidesAppChange(e.target.value)}
                      >
                        <option value="">{t('docs.selectApp')}</option>
                        {(adminApps.length > 0 ? adminApps : apps).map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      {adminSectionsLoading ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('common.loading')}</p>
                      ) : (
                        adminSections.map((section, idx) => (
                          <div key={idx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Section {idx + 1}</span>
                              <button onClick={() => handleDeleteAdminSection(idx)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <Input
                              placeholder={t('docs.sectionTitle')}
                              value={section.title}
                              onChange={(e) => setAdminSections((prev) => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))}
                            />
                            <textarea
                              className="font-mono text-sm h-48 w-full border rounded p-2"
                              placeholder={"# Heading\n\n**Bold**, *italic*, `code`\n\n- Bullet"}
                              value={section.content}
                              onChange={(e) => setAdminSections((prev) => prev.map((s, i) => i === idx ? { ...s, content: e.target.value } : s))}
                            />
                          </div>
                        ))
                      )}
                      {adminSections.length === 0 && !adminSectionsLoading && guidesSelectedAppId && (
                        <p className="text-sm text-gray-500 text-center py-4">{t('docs.noContentYet')}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Sub-tab: Feedback Report ── */}
                {adminSubTab === 'feedback' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('docs.feedbackReport')}</CardTitle>
                      <CardDescription>{t('docs.feedbackReportDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {feedbackReportLoading ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('common.loading')}</p>
                      ) : feedbackReport.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('docs.noFeedbackYet')}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-gray-500 text-xs">
                                <th className="pb-2 pr-3">{t('docs.colFaqId')}</th>
                                <th className="pb-2 pr-3">{t('docs.colHelpful')}</th>
                                <th className="pb-2 pr-3">{t('docs.colNotHelpful')}</th>
                                <th className="pb-2">{t('docs.colScore')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feedbackReport.map((row) => {
                                const total = row.helpful + row.not_helpful;
                                const score = total > 0 ? Math.round((row.helpful / total) * 100) : 0;
                                return (
                                  <tr key={row.faq_id} className="border-b last:border-b-0">
                                    <td className="py-2 pr-3 truncate max-w-[200px] font-medium" title={row.question}>{row.question}</td>
                                    <td className="py-2 pr-3 text-green-600">{row.helpful}</td>
                                    <td className="py-2 pr-3 text-red-500">{row.not_helpful}</td>
                                    <td className="py-2">
                                      <span className={`font-semibold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                                        {score}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Existing: Manage Quick Steps & FAQs (always visible) ── */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t('docs.quickSteps')} ({quickSteps.length})</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowAddStep(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('docs.addQuickStep')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {quickSteps.map((step) => (
                      <div key={step.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {step.step_number}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{step.title}</p>
                            {step.description && (
                              <p className="text-xs text-gray-500">{step.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteStep(step.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {quickSteps.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">{t('docs.noContentYet')}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Manage FAQs */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t('docs.tabFaqs')} ({faqs.length})</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowAddFaq(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('docs.addFaq')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {faqs.map((faq) => (
                      <div key={faq.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{faq.question}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{faq.category}</Badge>
                            <Badge
                              variant={faq.status === 'published' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {faq.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            title={faq.status === 'published' ? t('docs.unpublish') : t('docs.publish')}
                            onClick={() => handleToggleFaqStatus(faq)}
                          >
                            {faq.status === 'published'
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteFaq(faq.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {faqs.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">{t('docs.noContentYet')}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedApp ? setSelectedApp(null) : navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {selectedApp ? t('docs.backToAllApps') : t('docs.backToLaunchpad')}
          </Button>

          {!selectedApp && (
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <BookOpen className="h-10 w-10 text-blue-600" />
                {t('docs.title')}
              </h1>
              <p className="text-lg text-gray-600">{t('docs.subtitle')}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{apps.length}</p>
                        <p className="text-sm text-gray-600">{t('docs.statsApps')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-3 rounded-lg">
                        <Star className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{CATEGORIES.length - 1}</p>
                        <p className="text-sm text-gray-600">{t('docs.statsCategories')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-3 rounded-lg">
                        <HelpCircle className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">24/7</p>
                        <p className="text-sm text-gray-600">{t('docs.statsAvailability')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {selectedApp ? renderAppDetail() : renderAppList()}
      </div>
    </div>
  );
}

export default UserDocumentationEnhanced;
