import { useState } from "react";
import { InlineLoader } from "../ui/PageLoader";
import {
  useLinkedInPosts,
  useLinkedInTemplates,
  useLinkedInEvents,
  useLinkedInAnalytics,
} from "../../hooks/useLinkedInData";
import { t } from "../../../i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  content: string;
  status: "published" | "draft" | "scheduled";
  hashtags?: string[];
  scheduled_at?: string;
  likes?: number;
  comments?: number;
  shares?: number;
};

type Template = {
  id: string;
  title: string;
  content: string;
  category: string;
  hashtags?: string[];
};

type Event = {
  id: string;
  title: string;
  description?: string;
  date: string;
  location?: string;
  registration_link?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATE_CATEGORIES = [
  "Thought Leadership",
  "Company Update",
  "Job Post",
  "Product Announcement",
  "Industry News",
  "Event Promotion",
];

const COMMON_HASHTAGS = [
  "#LinkedIn",
  "#Marketing",
  "#Leadership",
  "#Innovation",
  "#Business",
  "#Tech",
  "#Growth",
  "#Career",
  "#Networking",
  "#Strategy",
];

// ─── Helper components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        map[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
      {category}
    </span>
  );
}


function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Posts Tab ────────────────────────────────────────────────────────────────

function PostsTab() {
  const { posts, loading, createPost, updatePost, deletePost } =
    useLinkedInPosts();

  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");

  function toggleHashtag(tag: string) {
    setHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleCreate(status: "published" | "draft") {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await createPost({
        content,
        status: scheduled ? "scheduled" : status,
        hashtags,
        scheduled_at: scheduled ? scheduledAt : undefined,
      });
      setContent("");
      setHashtags([]);
      setScheduled(false);
      setScheduledAt("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!editPost) return;
    setSubmitting(true);
    try {
      await updatePost(editPost.id, { ...editPost, content: editContent });
      setEditPost(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-800">{t('linkedin.createPost')}</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('linkedin.postPlaceholder')}
          rows={4}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-gray-500">{t('linkedin.addHashtags')}</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_HASHTAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleHashtag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  hashtags.includes(tag)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) => setScheduled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            {t('linkedin.schedule')}
          </label>
          {scheduled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            />
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            disabled={submitting || !content.trim()}
            onClick={() => handleCreate("published")}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t('linkedin.posting') : t('linkedin.postNow')}
          </button>
          <button
            disabled={submitting || !content.trim()}
            onClick={() => handleCreate("draft")}
            className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {t('linkedin.saveDraft')}
          </button>
        </div>
      </div>

      {/* Posts list */}
      {loading ? (
        <InlineLoader />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          {t('linkedin.noPostsYet')}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p: Post) => (
            <div
              key={p.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.status} />
                    {p.scheduled_at && p.status === "scheduled" && (
                      <span className="text-xs text-gray-400">
                        {new Date(p.scheduled_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {p.content}
                  </p>
                  {p.hashtags && p.hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.hashtags.map((tag) => (
                        <span key={tag} className="text-xs text-blue-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>👍 {p.likes ?? 0}</span>
                    <span>💬 {p.comments ?? 0}</span>
                    <span>🔁 {p.shares ?? 0}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setEditPost(p);
                      setEditContent(p.content);
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    title="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deletePost(p.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0h8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editPost && (
        <Modal title={t('linkedin.editPost')} onClose={() => setEditPost(null)}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpdate}
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t('masterData.saveChanges')}
            </button>
            <button
              onClick={() => setEditPost(null)}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } =
    useLinkedInTemplates();

  const [showCreate, setShowCreate] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: TEMPLATE_CATEGORIES[0],
    hashtags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setForm({ title: "", content: "", category: TEMPLATE_CATEGORIES[0], hashtags: "" });
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      await createTemplate({
        ...form,
        hashtags: form.hashtags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      resetForm();
      setShowCreate(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!editTpl) return;
    setSubmitting(true);
    try {
      await updateTemplate(editTpl.id, {
        ...editTpl,
        ...form,
        hashtags: form.hashtags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditTpl(null);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(tpl: Template) {
    setEditTpl(tpl);
    setForm({
      title: tpl.title,
      content: tpl.content,
      category: tpl.category,
      hashtags: (tpl.hashtags ?? []).join(", "),
    });
  }

  async function handleClone(tpl: Template) {
    await createTemplate({
      title: `${tpl.title} (copy)`,
      content: tpl.content,
      category: tpl.category,
      hashtags: tpl.hashtags,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{t('linkedin.postTemplatesTitle')}</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('linkedin.newTemplate')}
        </button>
      </div>

      {loading ? (
        <InlineLoader />
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          {t('linkedin.noTemplatesYet')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t: Template) => (
            <div
              key={t.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800 leading-snug">{t.title}</p>
                <CategoryBadge category={t.category} />
              </div>
              <p className="flex-1 text-sm text-gray-500 line-clamp-3">{t.content}</p>
              {t.hashtags && t.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.hashtags.map((tag) => (
                    <span key={tag} className="text-xs text-blue-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleClone(t)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t('linkedin.clone')}
                </button>
                <button
                  onClick={() => openEdit(t)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editTpl) && (
        <Modal
          title={editTpl ? t('linkedin.editTemplate') : t('linkedin.newTemplate')}
          onClose={() => {
            setShowCreate(false);
            setEditTpl(null);
            resetForm();
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.templateTitleLabel')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder={t('linkedin.templateTitleLabel')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.templateContentLabel')}</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none resize-none"
                placeholder={t('linkedin.templateContentLabel')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none"
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('linkedin.hashtags')} <span className="font-normal text-gray-400">{t('linkedin.hashtagsHint')}</span>
              </label>
              <input
                value={form.hashtags}
                onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder="#Leadership, #Innovation"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={editTpl ? handleUpdate : handleCreate}
                disabled={submitting || !form.title.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editTpl ? t('masterData.saveChanges') : t('linkedin.createTemplate')}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditTpl(null);
                  resetForm();
                }}
                className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab() {
  const { events, loading, createEvent, deleteEvent } = useLinkedInEvents();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    location: "",
    registration_link: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setForm({ title: "", description: "", date: "", location: "", registration_link: "" });
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      await createEvent(form);
      resetForm();
      setShowCreate(false);
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{t('linkedin.events')}</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('linkedin.newEvent')}
        </button>
      </div>

      {loading ? (
        <InlineLoader />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          {t('linkedin.noEventsYet')}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((ev: Event) => {
            const isPast = new Date(ev.date) < now;
            return (
              <div
                key={ev.id}
                className={`rounded-2xl border p-5 shadow-sm ${
                  isPast
                    ? "border-gray-100 bg-gray-50 opacity-60"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-indigo-600">
                        {new Date(ev.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {isPast && (
                        <span className="text-xs text-gray-400">{t('linkedin.pastLabel')}</span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-800">{ev.title}</h4>
                    {ev.description && (
                      <p className="mt-1 text-sm text-gray-500">{ev.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                      {ev.location && <span>📍 {ev.location}</span>}
                      {ev.registration_link && (
                        <a
                          href={ev.registration_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline hover:text-blue-700"
                        >
                          {t('linkedin.registerLink')}
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteEvent(ev.id)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0h8" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal
          title={t('linkedin.createEvent')}
          onClose={() => {
            setShowCreate(false);
            resetForm();
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.eventTitleLabel')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder="Annual Sales Summit 2026"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.eventDescLabel')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:outline-none resize-none"
                placeholder={t('linkedin.eventDescLabel')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.eventDateTime')}</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.eventLocationLabel')}</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder="San Francisco, CA or Virtual"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('linkedin.registrationLink')}</label>
              <input
                value={form.registration_link}
                onChange={(e) => setForm((f) => ({ ...f, registration_link: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreate}
                disabled={submitting || !form.title.trim() || !form.date}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('linkedin.createEvent')}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { analytics, loading } = useLinkedInAnalytics();
  const { posts } = useLinkedInPosts();

  const total = posts.length;
  const published = posts.filter((p: Post) => p.status === "published").length;
  const drafts = posts.filter((p: Post) => p.status === "draft").length;
  const scheduled = posts.filter((p: Post) => p.status === "scheduled").length;

  const bestPost = [...posts]
    .filter((p: Post) => p.status === "published")
    .sort(
      (a: Post, b: Post) =>
        ((b.likes ?? 0) + (b.comments ?? 0) + (b.shares ?? 0)) -
        ((a.likes ?? 0) + (a.comments ?? 0) + (a.shares ?? 0))
    )[0];

  if (loading) return <InlineLoader />;

  const statCards = [
    { label: "linkedin.totalPosts", value: total, color: "bg-indigo-50 text-indigo-700" },
    { label: "linkedin.published", value: published, color: "bg-green-50 text-green-700" },
    { label: "linkedin.drafts", value: drafts, color: "bg-gray-50 text-gray-600" },
    { label: "linkedin.scheduled", value: scheduled, color: "bg-blue-50 text-blue-700" },
  ];

  const totalLikes = posts.reduce((s: number, p: Post) => s + (p.likes ?? 0), 0);
  const totalComments = posts.reduce((s: number, p: Post) => s + (p.comments ?? 0), 0);
  const totalShares = posts.reduce((s: number, p: Post) => s + (p.shares ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-2xl p-5 ${card.color} shadow-sm`}>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm font-medium opacity-80">{t(card.label)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="mb-4 font-semibold text-gray-800">{t('linkedin.engagementOverview')}</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-800">👍 {totalLikes}</p>
            <p className="mt-1 text-xs text-gray-500">{t('linkedin.totalLikes')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">💬 {totalComments}</p>
            <p className="mt-1 text-xs text-gray-500">{t('linkedin.totalComments')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">🔁 {totalShares}</p>
            <p className="mt-1 text-xs text-gray-500">{t('linkedin.totalShares')}</p>
          </div>
        </div>
      </div>

      {analytics && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 font-semibold text-gray-800">{t('linkedin.platformAnalytics')}</h4>
          <pre className="text-xs text-gray-500 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(analytics, null, 2)}
          </pre>
        </div>
      )}

      {bestPost && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
          <h4 className="mb-3 font-semibold text-yellow-800">{t('linkedin.bestPerformingPost')}</h4>
          <p className="text-sm text-gray-700 line-clamp-4">{bestPost.content}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>👍 {bestPost.likes ?? 0}</span>
            <span>💬 {bestPost.comments ?? 0}</span>
            <span>🔁 {bestPost.shares ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "posts" | "templates" | "events" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "linkedin.posts" },
  { id: "templates", label: "linkedin.templates" },
  { id: "events", label: "linkedin.events" },
  { id: "analytics", label: "linkedin.analytics" },
];

interface Props { accessToken?: string; onLogout?: () => void; }
export function LinkedInPostManager(_props: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('linkedin.title')}</h1>
            <p className="text-sm text-gray-500">{t('linkedin.contentStrategy')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-white border border-gray-200 p-1 shadow-sm w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "posts" && <PostsTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "events" && <EventsTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}

export default LinkedInPostManager;
