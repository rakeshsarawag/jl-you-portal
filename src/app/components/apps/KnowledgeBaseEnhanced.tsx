/**
 * Knowledge Base — Enhanced
 * Redesigned to match IT Services / Recruitment / Assets style.
 * No motion/react, no shadcn Card — plain Tailwind divs.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen, Plus, Edit, Trash2, ThumbsUp, ThumbsDown,
  Loader2, Search, X, BarChart2, RefreshCw, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useKnowledgeBaseData, Article } from '../../hooks/useKnowledgeBaseData';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { AppLayout } from './AppLayout';
import { t } from '../../../i18n';
import { API_BASE, publicAnonKey, safeJson } from '../../utils/constants';

interface KnowledgeBaseEnhancedProps {
  accessToken?: string;
  onLogout?: () => void;
}

type Tab = 'articles' | 'create' | 'stats';

// ── RBAC helpers ──────────────────────────────────────────────────────────────

function canManageAll(role?: string) {
  return ['hr', 'HR', 'admin', 'Admin', 'SuperAdmin'].includes(role ?? '');
}

function canCreate(role?: string) {
  return canManageAll(role) || ['manager', 'Manager'].includes(role ?? '');
}

// ── Data accessors ────────────────────────────────────────────────────────────

function getViewCount(a: Article) {
  return a.view_count ?? a.views ?? 0;
}

function getLikeCount(a: Article) {
  return a.like_count ?? a.likes ?? 0;
}

function getArticleDate(a: Article) {
  return a.updated_at ?? a.updatedAt ?? a.created_at ?? a.createdAt ?? '';
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Article Detail Modal ──────────────────────────────────────────────────────

interface KnowledgeComment {
  id: string;
  article_id: string;
  author_id?: string;
  author_name: string;
  content: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CommentAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

interface KnowledgeVersion {
  id: string;
  article_id: string;
  title: string;
  edited_by: string;
  edited_at: string;
  created_at: string;
  content_snapshot?: string;
}

interface ArticleModalProps {
  article: Article;
  onClose: () => void;
  onLike: (id: string) => void;
  onEdit?: (article: Article) => void;
  onDelete?: (id: string) => void;
  canEdit: boolean;
  userId?: string;
  userName?: string;
}

function ArticleModal({ article, onClose, onLike, onEdit, onDelete, canEdit, userId, userName }: ArticleModalProps) {
  // Version history state
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<KnowledgeVersion | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function loadVersions() {
    if (versionsLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/knowledge/articles/${article.id}/versions`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const d = await safeJson(res);
      if (d?.success) setVersions(d?.data ?? []);
    } catch {
      // best effort
    } finally {
      setVersionsLoaded(true);
    }
  }

  async function loadVersionContent(v: KnowledgeVersion) {
    if (v.content_snapshot !== undefined) { setSelectedVersion(v); return; }
    setVersionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/knowledge/articles/${article.id}/versions/${v.id}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const d = await safeJson(res);
      if (d?.success) setSelectedVersion(d?.data);
    } catch {
      toast.error('Failed to load version');
    } finally {
      setVersionLoading(false);
    }
  }

  async function handleRestore(v: KnowledgeVersion) {
    if (!v.content_snapshot) { toast.error('No content to restore'); return; }
    const confirmed = await new Promise<boolean>(resolve => {
      toast(`Restore version from ${fmtDate(v.edited_at)}?`, {
        description: 'Current content will be replaced.',
        action: { label: 'Restore', onClick: () => resolve(true) },
        onDismiss: () => resolve(false),
        duration: 8000,
      });
    });
    if (!confirmed) return;
    setRestoring(true);
    try {
      const res = await fetch(`${API_BASE}/knowledge/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: v.title, content: v.content_snapshot }),
      });
      const d = await safeJson(res);
      if (d?.success) {
        toast.success('Version restored');
        setSelectedVersion(null);
      } else {
        toast.error('Failed to restore version');
      }
    } catch {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  }

  const [helpfulCount, setHelpfulCount] = useState<number>(
    (article as Article & { helpful_count?: number }).helpful_count ?? 0
  );
  const [notHelpfulCount, setNotHelpfulCount] = useState<number>(
    (article as Article & { not_helpful_count?: number }).not_helpful_count ?? 0
  );
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  // Comments state
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/knowledge/articles/${article.id}/comments`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    })
      .then(r => safeJson(r))
      .then(d => { if (d?.success) setComments(d?.data ?? []); })
      .catch(() => {});
  }, [article.id]);

  async function handlePostComment() {
    const content = commentText.trim();
    if (!content) { toast.error(t('validation.comment.content')); return; }
    setPostingComment(true);
    try {
      const res = await fetch(`${API_BASE}/knowledge/articles/${article.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ authorId: userId, authorName: userName ?? 'Anonymous', content }),
      });
      const d = await safeJson(res);
      if (d?.success) {
        setComments(prev => [...prev, d?.data]);
        setCommentText('');
      } else {
        toast.error('Failed to post comment');
      }
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  async function handleFeedback(positive: boolean) {
    if (feedbackGiven !== null) {
      toast.info('You have already given feedback on this article.');
      return;
    }
    // Optimistic update
    if (positive) setHelpfulCount(c => c + 1);
    else setNotHelpfulCount(c => c + 1);
    setFeedbackGiven(positive);
    toast.success(positive ? "Thanks for your feedback!" : "We'll use this to improve the article.");
    try {
      await fetch(`${API_BASE}/knowledge/${article.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ helpful: positive, userId }),
      });
    } catch {
      // Non-blocking — feedback is best-effort
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-start justify-between gap-4 rounded-t-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {article.featured && (
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  ★ Featured
                </span>
              )}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {article.category}
              </span>
              {article.status && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                  {article.status}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground leading-snug">
              {article.title}
              {comments.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({comments.length} comment{comments.length !== 1 ? 's' : ''})</span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('knowledge.author')}: <span className="font-medium text-foreground">{article.author}</span>
              {getArticleDate(article) && (
                <> &middot; {fmtDate(getArticleDate(article))}</>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 pt-4">
            {article.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 px-6 py-3 text-sm text-muted-foreground">
          <span>👁 {getViewCount(article)} views</span>
          <span>♥ {getLikeCount(article)} likes</span>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <div
            className="prose max-w-none text-foreground text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: article.content || '' }}
          />
        </div>

        {/* Discussion / Comments */}
        <div className="px-6 pb-6 border-t mt-2">
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-3">Discussion</h3>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">Be the first to comment.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <CommentAvatar name={c.author_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              placeholder="Write a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostComment(); }}
            />
            <button
              onClick={handlePostComment}
              disabled={postingComment || !commentText.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed self-end"
            >
              Post
            </button>
          </div>
        </div>

        {/* Version History */}
        <div className="px-6 pb-4 border-t">
          <button
            onClick={() => { setVersionsOpen(v => !v); if (!versionsLoaded) loadVersions(); }}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mt-4 mb-2"
          >
            <span>📋 {versions.length > 0 ? `${versions.length} versions` : 'Version History'}</span>
            <span className="text-muted-foreground">{versionsOpen ? '▲' : '▼'}</span>
          </button>
          {versionsOpen && (
            <div className="space-y-2">
              {!versionsLoaded ? (
                <p className="text-xs text-muted-foreground">Loading versions...</p>
              ) : versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No version history yet.</p>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => loadVersionContent(v)}>
                    <span className="text-xs text-muted-foreground w-4 flex-shrink-0">v{versions.length - i}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{v.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(v.edited_at)} by {v.edited_by}</p>
                    </div>
                  </div>
                ))
              )}
              {/* Version diff view */}
              {selectedVersion && (
                <div className="mt-3 border rounded-xl p-4 bg-muted">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-foreground">Version from {fmtDate(selectedVersion.edited_at)}</p>
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleRestore(selectedVersion)}
                          disabled={restoring}
                          className="px-2 py-1 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {restoring ? 'Restoring…' : 'Restore this version'}
                        </button>
                      )}
                      <button onClick={() => setSelectedVersion(null)} className="px-2 py-1 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted">Close</button>
                    </div>
                  </div>
                  {versionLoading ? (
                    <p className="text-xs text-muted-foreground">Loading content...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Previous version</p>
                        <textarea
                          readOnly
                          value={selectedVersion.content_snapshot ?? '(no content)'}
                          rows={8}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-card resize-none"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Current version</p>
                        <textarea
                          readOnly
                          value={article.content ?? '(no content)'}
                          rows={8}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-card resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex items-center justify-between gap-3 flex-wrap rounded-b-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onLike(article.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium transition-colors"
            >
              ♥ <span>{getLikeCount(article)}</span>
            </button>
            <button
              onClick={() => handleFeedback(true)}
              disabled={feedbackGiven !== null}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${feedbackGiven === true ? 'bg-green-100 text-green-700' : 'hover:bg-muted text-muted-foreground hover:text-green-600'} disabled:cursor-default`}
              title="Helpful"
            >
              <ThumbsUp className="h-4 w-4" />
              {helpfulCount > 0 && <span className="text-xs">{helpfulCount}</span>}
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={feedbackGiven !== null}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${feedbackGiven === false ? 'bg-red-100 text-red-600' : 'hover:bg-muted text-muted-foreground hover:text-red-500'} disabled:cursor-default`}
              title="Not helpful"
            >
              <ThumbsDown className="h-4 w-4" />
              {notHelpfulCount > 0 && <span className="text-xs">{notHelpfulCount}</span>}
            </button>
            {helpfulCount > 0 && (
              <span className="text-xs text-muted-foreground">{helpfulCount} found this helpful</span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(article)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted text-sm transition-colors"
                >
                  <Edit className="h-4 w-4" /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(article.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Article Modal ────────────────────────────────────────────────────────

interface EditModalProps {
  article: Article;
  categories: string[];
  onSave: (id: string, data: Partial<Article>) => Promise<unknown>;
  onClose: () => void;
}

function EditModal({ article, categories, onSave, onClose }: EditModalProps) {
  const [title, setTitle] = useState(article.title);
  const [category, setCategory] = useState(article.category);
  const [tagsRaw, setTagsRaw] = useState((article.tags ?? []).join(', '));
  const [featured, setFeatured] = useState(article.featured ?? false);
  const [content, setContent] = useState(article.content ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error(t('validation.article.title')); return; }
    if (!content.trim() || content.trim().length < 10) { toast.error(t('validation.article.content')); return; }
    if (!category) { toast.error(t('validation.article.category')); return; }
    setSaving(true);
    try {
      await onSave(article.id, {
        title: title.trim(),
        category,
        tags: tagsRaw.split(',').map(s => s.trim()).filter(Boolean),
        featured,
        content,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Edit Article</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tags (comma-separated)</label>
            <input
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-featured"
              checked={featured}
              onChange={e => setFeatured(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="edit-featured" className="text-sm font-medium text-foreground">Featured</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">HTML Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Delete Article?</h3>
        <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Cards ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-full bg-muted rounded mb-1" />
      <div className="h-4 w-5/6 bg-muted rounded mb-4" />
      <div className="flex gap-1 mb-3">
        <div className="h-5 w-12 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function KnowledgeBaseEnhanced({ onLogout }: KnowledgeBaseEnhancedProps) {
  const { user } = useUser();
  const {
    articles,
    categories,
    stats,
    loading,
    createArticle,
    updateArticle,
    deleteArticle,
    likeArticle,
    refresh,
  } = useKnowledgeBaseData();

  const role = user?.role;
  const isManager = canCreate(role);
  const isAdmin = canManageAll(role);
  const userId = user?.id;
  const permCreateArticle = useSectionPermission('knowledge-base', 'create');
  const permEditArticle = useSectionPermission('knowledge-base', 'edit');
  const permDeleteArticle = useSectionPermission('knowledge-base', 'delete');
  const permManageCategories = useSectionPermission('knowledge-base', 'manage_categories');

  // ── UI state
  const [activeTab, setActiveTab] = useState<Tab>('articles');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState('');
  const [trendingSort, setTrendingSort] = useState(false);

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTagsRaw, setFormTagsRaw] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formContent, setFormContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Set default category once categories load
  useEffect(() => {
    if (categories.length && !formCategory) {
      setFormCategory(categories[0]?.name ?? '');
    }
  }, [categories, formCategory]);

  // ── Derived category name list
  const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);

  // ── All tags across articles for chip filters
  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => (a.tags ?? []).forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [articles]);

  // ── Filtered + sorted articles
  const filteredArticles = useMemo(() => {
    let list = articles;
    if (categoryFilter) list = list.filter(a => a.category === categoryFilter);
    if (activeTagFilter) list = list.filter(a => (a.tags ?? []).includes(activeTagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt ?? '').toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q)
      );
    }
    if (trendingSort) {
      list = [...list].sort((a, b) => getViewCount(b) - getViewCount(a));
    }
    return list;
  }, [articles, categoryFilter, activeTagFilter, search, trendingSort]);

  function toggleTag(tag: string) {
    setActiveTagFilter(prev => prev === tag ? '' : tag);
  }

  function openEdit(article: Article) {
    setSelectedArticle(null);
    setEditArticle(article);
  }

  function confirmDelete(id: string) {
    setSelectedArticle(null);
    setDeleteId(id);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const deletedArticle = articles.find(a => a.id === deleteId);
    await deleteArticle(deleteId);
    setDeleteId(null);
    if (deletedArticle) {
      const { id: _id, ...restArticle } = deletedArticle;
      toast('Article deleted', {
        description: 'This action can be reversed within 5 seconds.',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await fetch(`${API_BASE}/knowledge/articles`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(restArticle),
              });
              await refresh();
              toast.success('Article restored successfully');
            } catch {
              toast.error('Failed to restore article');
            }
          },
        },
        duration: 5000,
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) { toast.error(t('validation.article.title')); return; }
    if (!formContent.trim() || formContent.trim().length < 10) { toast.error(t('validation.article.content')); return; }
    if (!formCategory) { toast.error(t('validation.article.category')); return; }
    setCreating(true);
    const newArticleTitle = formTitle.trim();
    try {
      await createArticle({
        title: newArticleTitle,
        category: formCategory,
        tags: formTagsRaw.split(',').map(s => s.trim()).filter(Boolean),
        featured: formFeatured,
        content: formContent,
        status: 'Published',
        author: user?.name ?? '',
        author_id: user?.id,
      });
      setFormTitle('');
      setFormTagsRaw('');
      setFormFeatured(false);
      setFormContent('');
      setActiveTab('articles');
      toast.success('Article published!', {
        description: 'Share this article with the team?',
        duration: 8000,
        action: {
          label: 'Post to Comms',
          onClick: async () => {
            try {
              const res = await fetch(`${API_BASE}/communications/announcements`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: publicAnonKey,
                  Authorization: `Bearer ${publicAnonKey}`,
                },
                body: JSON.stringify({
                  title: `New Knowledge Article: ${newArticleTitle}`,
                  content: `A new knowledge base article "${newArticleTitle}" has been published. Check it out in the Knowledge Base.`,
                  type: 'update',
                  audience: 'all',
                  author_id: user?.id,
                }),
              });
              if (res.ok) toast.success('Posted to Communications Hub!');
            } catch {
              toast.error('Failed to post to Communications');
            }
          },
        },
      });
    } finally {
      setCreating(false);
    }
  }

  // ── Trending (top 5 by view_count, updated in last 30 days where possible)
  const trendingArticles = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recent = articles.filter(a => getArticleDate(a) >= thirtyDaysAgo);
    const pool = recent.length >= 3 ? recent : articles;
    return [...pool].sort((a, b) => getViewCount(b) - getViewCount(a)).slice(0, 5);
  }, [articles]);

  // ── Stats helpers
  const statTotalArticles = stats?.total_articles ?? stats?.totalArticles ?? articles.length;
  const statTotalViews = stats?.total_views ?? stats?.totalViews ?? articles.reduce((s, a) => s + getViewCount(a), 0);
  const statTotalLikes = stats?.total_likes ?? stats?.totalLikes ?? articles.reduce((s, a) => s + getLikeCount(a), 0);
  const statCategories = stats?.by_category ?? stats?.byCategory ?? [];
  const mostViewed = (stats?.most_viewed ?? stats?.mostViewed ?? [...articles].sort((a, b) => getViewCount(b) - getViewCount(a))).slice(0, 5);
  const mostLiked = (stats?.most_liked ?? stats?.mostLiked ?? [...articles].sort((a, b) => getLikeCount(b) - getLikeCount(a))).slice(0, 5);
  const maxCategoryCount = statCategories.reduce((m, c) => Math.max(m, c.count), 1);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'articles', label: 'Articles', icon: <BookOpen className="h-4 w-4" /> },
    ...(isManager || permCreateArticle ? [{ key: 'create' as Tab, label: 'Create Article', icon: <Plus className="h-4 w-4" /> }] : []),
    { key: 'stats', label: 'Stats', icon: <BarChart2 className="h-4 w-4" /> },
  ];

  return (
    <AppLayout
      title={t('knowledge.title') || 'Knowledge Base'}
      description={t('knowledge.description') || 'Company knowledge and documentation'}
      icon={<BookOpen className="h-6 w-6 text-blue-600" />}
      onLogout={onLogout ?? (() => {})}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* Tab bar */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* ── Articles Tab ── */}
        {activeTab === 'articles' && (
          <div>
            {/* Controls row */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={() => setTrendingSort(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  trendingSort
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                🔥 Trending
              </button>
            </div>

            {/* Tag chip filters */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeTagFilter === tag
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {activeTagFilter && (
                  <button
                    onClick={() => setActiveTagFilter('')}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:bg-muted flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            )}

            {/* Trending panel */}
            {trendingArticles.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Trending</span>
                  <span className="text-xs text-amber-500 ml-1">Top articles by views</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {trendingArticles.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedArticle(a)}
                      className="flex items-start gap-2 text-left hover:bg-amber-100 rounded-lg p-2 transition-colors"
                    >
                      <span className="text-xs font-bold text-amber-400 shrink-0 w-4">#{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-amber-900 line-clamp-2">{a.title}</p>
                        <p className="text-xs text-amber-500 mt-0.5">👁 {getViewCount(a)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-base font-medium">No articles found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map(article => (
                  <div
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="bg-card rounded-xl border border-border p-5 group relative cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {article.featured && (
                      <span className="absolute top-3 right-3 text-amber-400 text-base" title="Featured">★</span>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 truncate max-w-[120px]">
                        {article.category}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                        <span>👁 {getViewCount(article)}</span>
                        <span>♥ {getLikeCount(article)}</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{article.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {article.excerpt || article.content?.replace(/<[^>]*>/g, '').slice(0, 120) || ''}
                    </p>
                    {(article.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(article.tags ?? []).map(tag => (
                          <button
                            key={tag}
                            onClick={e => { e.stopPropagation(); toggleTag(tag); }}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              activeTagFilter === tag
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{fmtDate(getArticleDate(article))}</span>
                      {(isAdmin || isManager || permEditArticle || permDeleteArticle) && (
                        <div
                          className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          {(isAdmin || isManager || permEditArticle) && (
                            <button
                              onClick={() => openEdit(article)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-blue-600"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(isAdmin || permDeleteArticle) && (
                            <button
                              onClick={() => confirmDelete(article.id)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Create Article Tab ── */}
        {activeTab === 'create' && (
          <div>
            {!isManager ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-base font-medium text-muted-foreground">Access Restricted</p>
                <p className="text-sm mt-1">Only HR, Admin, and Manager roles can create articles.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-5">New Article</h2>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        placeholder="Article title..."
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                      <select
                        value={formCategory}
                        onChange={e => setFormCategory(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tags (comma-separated)</label>
                      <input
                        value={formTagsRaw}
                        onChange={e => setFormTagsRaw(e.target.value)}
                        placeholder="onboarding, policy, IT..."
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create-featured"
                        checked={formFeatured}
                        onChange={e => setFormFeatured(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="create-featured" className="text-sm font-medium text-foreground">Mark as Featured ★</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        HTML Content <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formContent}
                        onChange={e => setFormContent(e.target.value)}
                        rows={10}
                        placeholder="<p>Your article content here...</p>"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Publish Article
                    </button>
                  </form>
                </div>

                {/* Live preview */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-5">Live Preview</h2>
                  {formTitle && (
                    <h3 className="text-xl font-bold text-foreground mb-2">{formTitle}</h3>
                  )}
                  {formCategory && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 inline-block mb-3">
                      {formCategory}
                    </span>
                  )}
                  {formContent ? (
                    <div
                      className="prose max-w-none text-foreground text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formContent }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Content preview will appear here...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Articles', value: statTotalArticles, color: 'text-blue-600' },
                { label: 'Total Views', value: statTotalViews.toLocaleString(), color: 'text-purple-600' },
                { label: 'Total Likes', value: statTotalLikes.toLocaleString(), color: 'text-pink-600' },
                { label: 'Categories', value: categoryNames.length, color: 'text-green-600' },
              ].map(tile => (
                <div key={tile.label} className="bg-card rounded-xl border border-border p-5">
                  <p className="text-xs text-muted-foreground mb-1">{tile.label}</p>
                  <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Viewed */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Most Viewed</h3>
                {mostViewed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {mostViewed.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-3 py-1.5">
                        <span className="text-xs font-semibold text-muted-foreground w-5 flex-shrink-0">#{i + 1}</span>
                        <span className="flex-1 text-sm text-foreground truncate">{a.title}</span>
                        <span className="text-sm font-medium text-muted-foreground flex-shrink-0">👁 {getViewCount(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most Liked */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Most Liked</h3>
                {mostLiked.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {mostLiked.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-3 py-1.5">
                        <span className="text-xs font-semibold text-muted-foreground w-5 flex-shrink-0">#{i + 1}</span>
                        <span className="flex-1 text-sm text-foreground truncate">{a.title}</span>
                        <span className="text-sm font-medium text-muted-foreground flex-shrink-0">♥ {getLikeCount(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* By Category bars */}
            {statCategories.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Articles by Category</h3>
                <div className="space-y-3">
                  {statCategories.map(item => (
                    <div key={item.category} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-32 flex-shrink-0 truncate">{item.category}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(item.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground w-6 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onLike={async (id) => {
            const updated = await likeArticle(id);
            if (updated) setSelectedArticle(updated);
          }}
          onEdit={(isManager || permEditArticle) ? openEdit : undefined}
          onDelete={(isAdmin || permDeleteArticle) ? confirmDelete : undefined}
          canEdit={isAdmin || isManager || permEditArticle || permDeleteArticle}
          userId={userId}
          userName={user?.name}
        />
      )}

      {editArticle && (
        <EditModal
          article={editArticle}
          categories={categoryNames}
          onSave={async (id, data) => { await updateArticle(id, data); setEditArticle(null); }}
          onClose={() => setEditArticle(null)}
        />
      )}

      {deleteId && (
        <DeleteConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </AppLayout>
  );
}

export default KnowledgeBaseEnhanced;
