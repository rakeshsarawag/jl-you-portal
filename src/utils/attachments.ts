import { ATTACHMENT_CONFIG } from '../constants/attachments';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachmentFile(file: File): string | null {
  if (file.size > ATTACHMENT_CONFIG.maxFileSizeBytes) {
    return `${file.name} exceeds the ${formatFileSize(ATTACHMENT_CONFIG.maxFileSizeBytes)} limit`;
  }

  const allowedMimeTypes = ATTACHMENT_CONFIG.acceptedMimeTypes as readonly string[];
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    return `${file.name} is not an allowed file type`;
  }

  const allowedExtensions = ATTACHMENT_CONFIG.acceptedExtensions as readonly string[];
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    return `${file.name} is not an allowed file type`;
  }

  return null;
}

export function mergeAttachmentFiles(current: File[], incoming: File[]): File[] {
  const byIdentity = new Map(current.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
  for (const file of incoming) {
    byIdentity.set(`${file.name}:${file.size}:${file.lastModified}`, file);
  }
  return [...byIdentity.values()];
}
