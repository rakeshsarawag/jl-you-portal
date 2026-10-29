import { describe, expect, it } from 'vitest';
import { ATTACHMENT_CONFIG } from '../../../src/constants/attachments';
import { formatFileSize, mergeAttachmentFiles, validateAttachmentFile } from '../../../src/utils/attachments';

function file(name: string, size: number, lastModified = 1): File {
  return { name, size, type: 'application/octet-stream', lastModified } as File;
}

describe('attachment utilities', () => {
  it('allows files at the configured 5 MB boundary', () => {
    expect(validateAttachmentFile(file('allowed.zip', ATTACHMENT_CONFIG.maxFileSizeBytes))).toBeNull();
  });

  it('rejects files larger than the configured limit', () => {
    expect(validateAttachmentFile(file('too-large.zip', ATTACHMENT_CONFIG.maxFileSizeBytes + 1)))
      .toContain('exceeds the 5.0 MB limit');
  });

  it('deduplicates the same selected file identity', () => {
    const original = file('evidence.log', 200, 10);
    const duplicate = file('evidence.log', 200, 10);
    const another = file('screenshot.png', 400, 20);

    expect(mergeAttachmentFiles([original], [duplicate, another])).toEqual([duplicate, another]);
  });

  it('formats common file sizes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
