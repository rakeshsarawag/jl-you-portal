import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, File, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ATTACHMENT_CONFIG } from '../../../constants/attachments';
import { formatFileSize, mergeAttachmentFiles, validateAttachmentFile } from '../../../utils/attachments';
import {
  createAttachmentDownloadUrl,
  deleteEntityAttachment,
  EntityAttachment,
  listEntityAttachments,
  uploadEntityAttachments,
} from '../../services/attachments';
import { Button } from '../ui/button';
import { AttachmentViewer } from './AttachmentViewer';

interface AttachmentSectionProps {
  entityType?: string;
  entityId?: string;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  contextType?: string;
  contextId?: string | null;
  uploadedBy?: string;
  uploadedByName?: string;
  readOnly?: boolean;
  canDeleteAll?: boolean;
  title?: string;
  description?: string;
  compact?: boolean;
  onAttachmentsChange?: () => void | Promise<void>;
}

function isEntityAttachment(item: EntityAttachment | File): item is EntityAttachment {
  return 'storagePath' in item;
}

export function AttachmentSection({
  entityType,
  entityId,
  pendingFiles = [],
  onPendingFilesChange,
  contextType = 'entity',
  contextId = null,
  uploadedBy = '',
  uploadedByName = '',
  readOnly = false,
  canDeleteAll = false,
  title = 'Attachments',
  description = `Optional files up to ${formatFileSize(ATTACHMENT_CONFIG.maxFileSizeBytes)} each`,
  compact = false,
  onAttachmentsChange,
}: AttachmentSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [loading, setLoading] = useState(Boolean(entityType && entityId));
  const [uploading, setUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<EntityAttachment | File | null>(null);
  const persistedMode = Boolean(entityType && entityId);

  const loadAttachments = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    try {
      setAttachments(await listEntityAttachments(entityType, entityId));
    } catch (error: any) {
      toast.error('Unable to load attachments', { description: error?.message });
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  const addFiles = async (incoming: File[]) => {
    const valid: File[] = [];
    for (const file of incoming.slice(0, ATTACHMENT_CONFIG.maxFilesPerSelection)) {
      const validationError = validateAttachmentFile(file);
      if (validationError) toast.error(validationError);
      else valid.push(file);
    }
    if (incoming.length > ATTACHMENT_CONFIG.maxFilesPerSelection) {
      toast.error(`Select up to ${ATTACHMENT_CONFIG.maxFilesPerSelection} files at a time`);
    }
    if (!valid.length) return;

    if (!persistedMode) {
      onPendingFilesChange?.(mergeAttachmentFiles(pendingFiles, valid));
      return;
    }

    setUploading(true);
    const result = await uploadEntityAttachments({
      entityType: entityType!,
      entityId: entityId!,
      files: valid,
      contextType,
      contextId,
      uploadedBy,
      uploadedByName,
    });
    setAttachments(current => [...result.uploaded.reverse(), ...current]);
    setUploading(false);
    if (result.uploaded.length) {
      toast.success(`${result.uploaded.length} attachment${result.uploaded.length === 1 ? '' : 's'} uploaded`);
      void onAttachmentsChange?.();
    }
    for (const failure of result.failed) {
      toast.error(`Could not upload ${failure.file.name}`, { description: failure.error });
    }
  };

  const removePersisted = async (attachment: EntityAttachment) => {
    try {
      await deleteEntityAttachment(attachment, { id: uploadedBy, name: uploadedByName });
      setAttachments(current => current.filter(item => item.id !== attachment.id));
      toast.success('Attachment removed');
      void onAttachmentsChange?.();
    } catch (error: any) {
      toast.error('Unable to remove attachment', { description: error?.message });
    }
  };

  const download = async (attachment: EntityAttachment) => {
    try {
      const url = await createAttachmentDownloadUrl(attachment);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error('Unable to download attachment', { description: error?.message });
    }
  };

  const visibleFiles = persistedMode ? attachments : pendingFiles;

  return (
    <section className={compact ? 'space-y-2' : 'rounded-xl border bg-card p-4 space-y-3'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Paperclip className="size-4" />
            {title}
            {visibleFiles.length > 0 && <span className="text-xs text-muted-foreground">({visibleFiles.length})</span>}
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading ? 'Uploading' : 'Add files'}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading attachments
        </div>
      ) : visibleFiles.length === 0 ? (
        <div
          className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!readOnly) void addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          No attachments added
          {!readOnly && <span className="block text-xs">Drop files here or use Add files</span>}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleFiles.map((item) => {
            const persisted = isEntityAttachment(item);
            const name = persisted ? item.originalName : item.name;
            const size = persisted ? item.sizeBytes : item.size;
            const key = persisted ? item.id : `${item.name}:${item.size}:${item.lastModified}`;
            const canRemove = !readOnly && (
              !persisted ||
              canDeleteAll ||
              item.uploadedBy === uploadedBy
            );
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <File className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-w-0 max-w-full justify-start p-0 text-foreground"
                    onClick={() => setPreviewAttachment(item)}
                    title={`Preview ${name}`}
                  >
                    <span className="truncate">{name}</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(size)}
                    {persisted && item.uploadedByName ? ` · ${item.uploadedByName}` : ''}
                  </p>
                </div>
                {persisted && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => void download(item)} aria-label={`Download ${name}`}>
                    <Download />
                  </Button>
                )}
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => persisted
                      ? void removePersisted(item)
                      : onPendingFilesChange?.(pendingFiles.filter(file => file !== item))}
                    aria-label={`Remove ${name}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AttachmentViewer
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />
    </section>
  );
}
