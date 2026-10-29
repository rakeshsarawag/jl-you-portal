import { ATTACHMENT_CONFIG, ATTACHMENT_ENTITY_TYPES } from '../../constants/attachments';
import { validateAttachmentFile } from '../../utils/attachments';
import { supabase } from '../utils/constants';

export interface EntityAttachment {
  id: string;
  entityType: string;
  entityId: string;
  contextType: string;
  contextId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

interface UploadAttachmentOptions {
  entityType: string;
  entityId: string;
  file: File;
  contextType?: string;
  contextId?: string | null;
  uploadedBy: string;
  uploadedByName: string;
}

function normalizeAttachment(row: any): EntityAttachment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    contextType: row.context_type ?? 'entity',
    contextId: row.context_id ?? null,
    originalName: row.original_name,
    mimeType: row.mime_type ?? '',
    sizeBytes: Number(row.size_bytes ?? 0),
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by ?? '',
    uploadedByName: row.uploaded_by_name ?? '',
    createdAt: row.created_at,
  };
}

function safeFileName(name: string): string {
  const sanitized = name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'attachment';
}

async function logAttachmentActivity({
  attachment,
  actorId,
  actorName,
  action,
}: {
  attachment: EntityAttachment;
  actorId: string;
  actorName: string;
  action: 'added attachment' | 'removed attachment';
}): Promise<string | null> {
  if (attachment.entityType !== ATTACHMENT_ENTITY_TYPES.defect) return null;
  const { data, error } = await supabase
    .from('defect_activity_log')
    .insert({
      defect_id: attachment.entityId,
      actor_id: actorId || 'system',
      actor_name: actorName || 'System',
      action,
      comment: attachment.originalName,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function listEntityAttachments(entityType: string, entityId: string): Promise<EntityAttachment[]> {
  const { data, error } = await supabase
    .from('entity_attachments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeAttachment);
}

export async function uploadEntityAttachment(options: UploadAttachmentOptions): Promise<EntityAttachment> {
  const validationError = validateAttachmentFile(options.file);
  if (validationError) throw new Error(validationError);

  const storagePath = [
    options.entityType,
    options.entityId,
    `${crypto.randomUUID()}-${safeFileName(options.file.name)}`,
  ].join('/');

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_CONFIG.bucket)
    .upload(storagePath, options.file, {
      contentType: options.file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: metadataError } = await supabase
    .from('entity_attachments')
    .insert({
      entity_type: options.entityType,
      entity_id: options.entityId,
      context_type: options.contextType ?? 'entity',
      context_id: options.contextId ?? null,
      storage_bucket: ATTACHMENT_CONFIG.bucket,
      storage_path: storagePath,
      original_name: options.file.name,
      mime_type: options.file.type || 'application/octet-stream',
      size_bytes: options.file.size,
      uploaded_by: options.uploadedBy,
      uploaded_by_name: options.uploadedByName,
    })
    .select()
    .single();

  if (metadataError) {
    await supabase.storage.from(ATTACHMENT_CONFIG.bucket).remove([storagePath]);
    throw metadataError;
  }
  const attachment = normalizeAttachment(data);
  try {
    await logAttachmentActivity({
      attachment,
      actorId: options.uploadedBy,
      actorName: options.uploadedByName,
      action: 'added attachment',
    });
  } catch (activityError) {
    await supabase.storage.from(ATTACHMENT_CONFIG.bucket).remove([storagePath]);
    await supabase.from('entity_attachments').delete().eq('id', attachment.id);
    throw activityError;
  }
  return attachment;
}

export async function uploadEntityAttachments(
  options: Omit<UploadAttachmentOptions, 'file'> & { files: File[] },
): Promise<{ uploaded: EntityAttachment[]; failed: { file: File; error: string }[] }> {
  const uploaded: EntityAttachment[] = [];
  const failed: { file: File; error: string }[] = [];
  for (const file of options.files) {
    try {
      uploaded.push(await uploadEntityAttachment({ ...options, file }));
    } catch (error: any) {
      failed.push({ file, error: error?.message ?? 'Upload failed' });
    }
  }
  return { uploaded, failed };
}

async function createAttachmentSignedUrl(
  attachment: EntityAttachment,
  download: boolean,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_CONFIG.bucket)
    .createSignedUrl(
      attachment.storagePath,
      ATTACHMENT_CONFIG.signedUrlExpiresInSeconds,
      download ? { download: attachment.originalName } : undefined,
    );
  if (error) throw error;
  return data.signedUrl;
}

export function createAttachmentDownloadUrl(attachment: EntityAttachment): Promise<string> {
  return createAttachmentSignedUrl(attachment, true);
}

export function createAttachmentViewUrl(attachment: EntityAttachment): Promise<string> {
  return createAttachmentSignedUrl(attachment, false);
}

export async function deleteEntityAttachment(
  attachment: EntityAttachment,
  actor: { id: string; name: string },
): Promise<void> {
  const activityId = await logAttachmentActivity({
    attachment,
    actorId: actor.id,
    actorName: actor.name,
    action: 'removed attachment',
  });

  const { error: storageError } = await supabase.storage
    .from(ATTACHMENT_CONFIG.bucket)
    .remove([attachment.storagePath]);
  if (storageError) {
    if (activityId) await supabase.from('defect_activity_log').delete().eq('id', activityId);
    throw storageError;
  }

  const { error: metadataError } = await supabase
    .from('entity_attachments')
    .delete()
    .eq('id', attachment.id);
  if (metadataError) throw metadataError;
}

export async function deleteAllEntityAttachments(
  entityType: string,
  entityId: string,
): Promise<number> {
  const attachments = await listEntityAttachments(entityType, entityId);
  if (attachments.length === 0) return 0;

  const { error: storageError } = await supabase.storage
    .from(ATTACHMENT_CONFIG.bucket)
    .remove(attachments.map((attachment) => attachment.storagePath));
  if (storageError) throw storageError;

  const { error: metadataError } = await supabase
    .from('entity_attachments')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (metadataError) throw metadataError;

  return attachments.length;
}
