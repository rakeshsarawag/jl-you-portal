import { useEffect, useRef, useState } from 'react';
import { Download, FileWarning, Loader2, Maximize2, Minimize2 } from 'lucide-react';
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
export type AttachmentViewerType = 'pdf' | 'docx' | 'image' | 'text' | 'unsupported';

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const TEXT_EXTENSIONS = /\.(conf|css|csv|html?|ini|jsx?|json|log|md|sql|text|tsx?|txt|xml|ya?ml)$/i;
const TEXT_MIME_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/sql',
  'application/xml',
  'application/x-httpd-php',
  'application/x-javascript',
  'application/x-sh',
  'application/yaml',
]);
const MAX_TEXT_PREVIEW_CHARACTERS = 1_000_000;

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

export function getAttachmentViewerType(name: string, mimeType: string): AttachmentViewerType {
  const normalizedName = name.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim();
  if (normalizedMimeType === 'application/pdf' || normalizedName.endsWith('.pdf')) return 'pdf';
  if (
    normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || normalizedName.endsWith('.docx')
  ) return 'docx';
  if (normalizedMimeType.startsWith('image/') || IMAGE_EXTENSIONS.test(normalizedName)) return 'image';
  if (
    normalizedMimeType.startsWith('text/')
    || TEXT_MIME_TYPES.has(normalizedMimeType)
    || TEXT_EXTENSIONS.test(normalizedName)
  ) return 'text';
  return 'unsupported';
}

function getViewerType(attachment: ViewableAttachment): AttachmentViewerType {
  return getAttachmentViewerType(
    getAttachmentName(attachment),
    getAttachmentMimeType(attachment),
  );
}

function getViewerDescription(viewerType: AttachmentViewerType): string {
  if (viewerType === 'pdf') return 'PDF preview';
  if (viewerType === 'docx') return 'Word document preview';
  if (viewerType === 'image') return 'Image preview';
  if (viewerType === 'text') return 'Text file preview';
  return 'Preview unavailable';
}

export function AttachmentViewer({
  attachment,
  open,
  onOpenChange,
}: AttachmentViewerProps) {
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTruncated, setTextTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const viewerType = attachment ? getViewerType(attachment) : 'unsupported';
  const name = attachment ? getAttachmentName(attachment) : 'Attachment';

  useEffect(() => {
    if (!open || !attachment) return;

    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setSourceUrl('');
    setTextContent('');
    setTextTruncated(false);
    if (documentContainerRef.current) documentContainerRef.current.replaceChildren();

    const loadPreview = async () => {
      try {
        if (viewerType === 'unsupported') {
          setLoading(false);
          return;
        }

        if (viewerType === 'pdf' || viewerType === 'image') {
          const url = isPersistedAttachment(attachment)
            ? await createAttachmentViewUrl(attachment)
            : URL.createObjectURL(attachment);
          if (!isPersistedAttachment(attachment)) objectUrl = url;
          if (!cancelled) setSourceUrl(url);
          return;
        }

        if (viewerType === 'text') {
          const text = isPersistedAttachment(attachment)
            ? await fetch(await createAttachmentViewUrl(attachment)).then((response) => {
                if (!response.ok) throw new Error('Unable to retrieve the text file');
                return response.text();
              })
            : await attachment.text();
          if (!cancelled) {
            setTextContent(text.slice(0, MAX_TEXT_PREVIEW_CHARACTERS));
            setTextTruncated(text.length > MAX_TEXT_PREVIEW_CHARACTERS);
          }
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

  useEffect(() => {
    if (!open) setFullScreen(false);
  }, [open]);

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
      <DialogContent className={`flex flex-col gap-0 overflow-hidden p-0 ${
        fullScreen
          ? 'h-[100dvh] w-screen max-w-none rounded-none border-0 sm:max-w-none'
          : 'h-[85vh] max-w-6xl'
      }`}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-11 top-2.5 z-10"
          onClick={() => setFullScreen(current => !current)}
          title={fullScreen ? 'Restore preview size' : 'View preview full screen'}
          aria-label={fullScreen ? 'Restore preview size' : 'View preview full screen'}
        >
          {fullScreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
        <DialogHeader className="border-b p-6 pr-24">
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription>{getViewerDescription(viewerType)}</DialogDescription>
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
          ) : viewerType === 'image' && sourceUrl ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4 sm:p-8">
              <img
                src={sourceUrl}
                alt={name}
                className="max-h-full max-w-full object-contain"
                onError={() => setError('Unable to display this image')}
              />
            </div>
          ) : viewerType === 'text' ? (
            <div className="h-full overflow-auto bg-background">
              {textTruncated && (
                <div className="sticky top-0 border-b bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  Preview truncated after {MAX_TEXT_PREVIEW_CHARACTERS.toLocaleString()} characters. Download the file to view the rest.
                </div>
              )}
              <pre className="min-h-full whitespace-pre-wrap break-words p-6 font-mono text-xs leading-5 text-foreground">
                {textContent}
              </pre>
            </div>
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
                  PDF, modern Word (.docx), image, and text files are supported. Download this file to open it.
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
