import { useEffect, useRef, useState } from 'react';
import { Download, FileWarning, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createAttachmentDownloadUrl,
  createAttachmentViewUrl,
  type EntityAttachment,
} from '../../services/attachments';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type ViewableAttachment = EntityAttachment | File;
type ViewerType = 'pdf' | 'docx' | 'unsupported';

interface AttachmentViewerProps {
  attachment: ViewableAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isPersistedAttachment(attachment: ViewableAttachment): attachment is EntityAttachment {
  return 'storagePath' in attachment;
}

function getAttachmentName(attachment: ViewableAttachment): string {
  return isPersistedAttachment(attachment) ? attachment.originalName : attachment.name;
}

function getAttachmentMimeType(attachment: ViewableAttachment): string {
  return isPersistedAttachment(attachment) ? attachment.mimeType : attachment.type;
}

function getViewerType(attachment: ViewableAttachment): ViewerType {
  const name = getAttachmentName(attachment).toLowerCase();
  const mimeType = getAttachmentMimeType(attachment);
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx')
  ) return 'docx';
  return 'unsupported';
}

export function AttachmentViewer({
  attachment,
  open,
  onOpenChange,
}: AttachmentViewerProps) {
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const viewerType = attachment ? getViewerType(attachment) : 'unsupported';
  const name = attachment ? getAttachmentName(attachment) : 'Attachment';

  useEffect(() => {
    if (!open || !attachment) return;

    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setSourceUrl('');
    if (documentContainerRef.current) documentContainerRef.current.replaceChildren();

    const loadPreview = async () => {
      try {
        if (viewerType === 'unsupported') {
          setLoading(false);
          return;
        }

        if (viewerType === 'pdf') {
          const url = isPersistedAttachment(attachment)
            ? await createAttachmentViewUrl(attachment)
            : URL.createObjectURL(attachment);
          if (!isPersistedAttachment(attachment)) objectUrl = url;
          if (!cancelled) setSourceUrl(url);
          return;
        }

        const documentData = isPersistedAttachment(attachment)
          ? await fetch(await createAttachmentViewUrl(attachment)).then((response) => {
              if (!response.ok) throw new Error('Unable to retrieve the document');
              return response.arrayBuffer();
            })
          : await attachment.arrayBuffer();
        if (cancelled || !documentContainerRef.current) return;

        const { renderAsync } = await import('docx-preview');
        await renderAsync(documentData, documentContainerRef.current, undefined, {
          className: 'attachment-docx',
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
        });
      } catch (previewError: any) {
        if (!cancelled) setError(previewError?.message ?? 'Unable to preview this attachment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (documentContainerRef.current) documentContainerRef.current.replaceChildren();
    };
  }, [attachment, open, viewerType]);

  const download = async () => {
    if (!attachment) return;
    try {
      const url = isPersistedAttachment(attachment)
        ? await createAttachmentDownloadUrl(attachment)
        : URL.createObjectURL(attachment);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      if (!isPersistedAttachment(attachment)) URL.revokeObjectURL(url);
    } catch (downloadError: any) {
      toast.error('Unable to download attachment', { description: downloadError?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription>
            {viewerType === 'pdf' ? 'PDF preview' : viewerType === 'docx' ? 'Word document preview' : 'Preview unavailable'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/40">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading preview
            </div>
          )}

          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileWarning className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Preview could not be loaded</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : viewerType === 'pdf' && sourceUrl ? (
            <iframe
              src={sourceUrl}
              title={`Preview of ${name}`}
              className="h-full w-full border-0 bg-background"
            />
          ) : viewerType === 'docx' ? (
            <div
              ref={documentContainerRef}
              className="h-full overflow-auto p-6 [&_.attachment-docx-wrapper]:mx-auto [&_.attachment-docx-wrapper]:bg-transparent"
            />
          ) : !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileWarning className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">This file type cannot be previewed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PDF and modern Word (.docx) files are supported. Download this file to open it.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t p-4">
          <Button type="button" variant="outline" onClick={() => void download()}>
            <Download />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
