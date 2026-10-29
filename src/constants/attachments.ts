export const ATTACHMENT_CONFIG = {
  bucket: 'portal-attachments',
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxFilesPerSelection: 10,
  signedUrlExpiresInSeconds: 15 * 60,
  acceptedMimeTypes: [] as string[],
  acceptedExtensions: [] as string[],
} as const;

export const ATTACHMENT_ENTITY_TYPES = {
  defect: 'defect',
} as const;

export type AttachmentEntityType =
  typeof ATTACHMENT_ENTITY_TYPES[keyof typeof ATTACHMENT_ENTITY_TYPES];
