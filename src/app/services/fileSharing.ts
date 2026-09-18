import { toast } from 'sonner';

export type FileType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
export type SharePermission = 'view' | 'comment' | 'edit' | 'admin';

export interface SharedFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  mimeType: string;
  url?: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  sharedWith: string[]; // userIds or channelIds
  permissions: Record<string, SharePermission>; // userId -> permission
  tags?: string[];
  description?: string;
  version: number;
  versions?: FileVersion[];
  downloads: number;
  views: number;
  comments?: FileComment[];
  starred?: string[]; // userIds who starred this file
}

export interface FileVersion {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  url?: string;
  changelog?: string;
}

export interface FileComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  edited?: boolean;
}

export interface FileFolder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdBy: string;
  createdAt: string;
  sharedWith: string[];
  files: string[]; // fileIds
  subfolders: string[]; // folderIds
}

export class FileSharingService {
  private static files: Map<string, SharedFile> = new Map();
  private static folders: Map<string, FileFolder> = new Map();

  /**
   * Initialize file sharing
   */
  static initialize() {
    this.loadFromStorage();
    this.initializeSampleData();
  }

  /**
   * Initialize sample data
   */
  private static initializeSampleData() {
    if (this.files.size > 0) return;

    // Create sample files
    const sampleFiles: SharedFile[] = [
      {
        id: 'file1',
        name: 'Q1 2026 Business Plan.pdf',
        type: 'document',
        size: 2457600, // 2.4 MB
        mimeType: 'application/pdf',
        uploadedBy: 'current-user',
        uploadedByName: 'Admin User',
        uploadedAt: new Date(Date.now() - 172800000).toISOString(),
        sharedWith: ['general', 'user1', 'user2'],
        permissions: {
          'user1': 'view',
          'user2': 'comment',
          'current-user': 'admin'
        },
        tags: ['business', 'planning', 'Q1'],
        description: 'Strategic business plan for Q1 2026',
        version: 2,
        downloads: 15,
        views: 45,
        starred: ['user1', 'user2']
      },
      {
        id: 'file2',
        name: 'Team Photo 2026.jpg',
        type: 'image',
        size: 1536000, // 1.5 MB
        mimeType: 'image/jpeg',
        uploadedBy: 'user3',
        uploadedByName: 'Carol Davis',
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        sharedWith: ['general'],
        permissions: {
          'current-user': 'view'
        },
        tags: ['team', 'photo'],
        version: 1,
        downloads: 8,
        views: 32
      },
      {
        id: 'file3',
        name: 'Product Roadmap 2026.xlsx',
        type: 'document',
        size: 512000, // 500 KB
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedBy: 'user1',
        uploadedByName: 'Alice Johnson',
        uploadedAt: new Date(Date.now() - 43200000).toISOString(),
        sharedWith: ['engineering'],
        permissions: {
          'current-user': 'edit',
          'user1': 'admin'
        },
        tags: ['product', 'roadmap', 'engineering'],
        description: 'Product development roadmap for 2026',
        version: 3,
        downloads: 22,
        views: 67,
        starred: ['current-user'],
        comments: [
          {
            id: 'comment1',
            userId: 'current-user',
            userName: 'Admin User',
            content: 'Great work on this roadmap!',
            timestamp: new Date(Date.now() - 21600000).toISOString()
          }
        ]
      },
      {
        id: 'file4',
        name: 'Sales Training Video.mp4',
        type: 'video',
        size: 15728640, // 15 MB
        mimeType: 'video/mp4',
        uploadedBy: 'user2',
        uploadedByName: 'Bob Smith',
        uploadedAt: new Date(Date.now() - 259200000).toISOString(),
        sharedWith: ['sales'],
        permissions: {
          'current-user': 'view',
          'user2': 'admin'
        },
        tags: ['training', 'sales', 'video'],
        description: 'Sales team training session recording',
        version: 1,
        downloads: 12,
        views: 28
      }
    ];

    sampleFiles.forEach(file => this.files.set(file.id, file));

    // Create sample folders
    const sampleFolders: FileFolder[] = [
      {
        id: 'folder1',
        name: 'Company Documents',
        description: 'Official company documents and policies',
        createdBy: 'current-user',
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
        sharedWith: ['general'],
        files: ['file1'],
        subfolders: []
      },
      {
        id: 'folder2',
        name: 'Engineering',
        description: 'Technical documentation and specs',
        createdBy: 'user1',
        createdAt: new Date(Date.now() - 1296000000).toISOString(),
        sharedWith: ['engineering'],
        files: ['file3'],
        subfolders: []
      }
    ];

    sampleFolders.forEach(folder => this.folders.set(folder.id, folder));

    this.saveToStorage();
  }

  /**
   * Upload file
   */
  static uploadFile(file: Omit<SharedFile, 'id' | 'uploadedAt' | 'version' | 'downloads' | 'views'>): SharedFile {
    const newFile: SharedFile = {
      ...file,
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
      version: 1,
      downloads: 0,
      views: 0
    };

    this.files.set(newFile.id, newFile);
    this.saveToStorage();
    
    toast.success(`File uploaded: ${newFile.name}`);
    return newFile;
  }

  /**
   * Get all files
   */
  static getAllFiles(): SharedFile[] {
    return Array.from(this.files.values()).sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  /**
   * Get file by ID
   */
  static getFile(fileId: string): SharedFile | undefined {
    const file = this.files.get(fileId);
    if (file) {
      file.views++;
      this.saveToStorage();
    }
    return file;
  }

  /**
   * Get files shared with user/channel
   */
  static getSharedFiles(entityId: string): SharedFile[] {
    return Array.from(this.files.values()).filter(file =>
      file.sharedWith.includes(entityId)
    );
  }

  /**
   * Share file
   */
  static shareFile(fileId: string, shareWith: string, permission: SharePermission = 'view'): void {
    const file = this.files.get(fileId);
    if (file) {
      if (!file.sharedWith.includes(shareWith)) {
        file.sharedWith.push(shareWith);
      }
      file.permissions[shareWith] = permission;
      this.saveToStorage();
      toast.success('File shared successfully');
    }
  }

  /**
   * Unshare file
   */
  static unshareFile(fileId: string, entity: string): void {
    const file = this.files.get(fileId);
    if (file) {
      file.sharedWith = file.sharedWith.filter(id => id !== entity);
      delete file.permissions[entity];
      this.saveToStorage();
      toast.success('File unshared');
    }
  }

  /**
   * Update file permissions
   */
  static updatePermission(fileId: string, userId: string, permission: SharePermission): void {
    const file = this.files.get(fileId);
    if (file) {
      file.permissions[userId] = permission;
      this.saveToStorage();
      toast.success('Permissions updated');
    }
  }

  /**
   * Delete file
   */
  static deleteFile(fileId: string): void {
    this.files.delete(fileId);
    this.saveToStorage();
    toast.success('File deleted');
  }

  /**
   * Download file
   */
  static downloadFile(fileId: string): void {
    const file = this.files.get(fileId);
    if (file) {
      file.downloads++;
      this.saveToStorage();
      toast.success(`Downloading ${file.name}`);
    }
  }

  /**
   * Star/Unstar file
   */
  static toggleStar(fileId: string, userId: string): void {
    const file = this.files.get(fileId);
    if (file) {
      if (!file.starred) file.starred = [];
      
      const index = file.starred.indexOf(userId);
      if (index > -1) {
        file.starred.splice(index, 1);
        toast.success('Removed from starred');
      } else {
        file.starred.push(userId);
        toast.success('Added to starred');
      }
      
      this.saveToStorage();
    }
  }

  /**
   * Add comment to file
   */
  static addComment(fileId: string, comment: Omit<FileComment, 'id' | 'timestamp'>): void {
    const file = this.files.get(fileId);
    if (file) {
      if (!file.comments) file.comments = [];
      
      const newComment: FileComment = {
        ...comment,
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      };
      
      file.comments.push(newComment);
      this.saveToStorage();
      toast.success('Comment added');
    }
  }

  /**
   * Search files
   */
  static searchFiles(query: string): SharedFile[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.files.values()).filter(file =>
      file.name.toLowerCase().includes(lowerQuery) ||
      file.description?.toLowerCase().includes(lowerQuery) ||
      file.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get files by type
   */
  static getFilesByType(type: FileType): SharedFile[] {
    return Array.from(this.files.values()).filter(file => file.type === type);
  }

  /**
   * Get starred files
   */
  static getStarredFiles(userId: string): SharedFile[] {
    return Array.from(this.files.values()).filter(file =>
      file.starred?.includes(userId)
    );
  }

  /**
   * Get recent files
   */
  static getRecentFiles(limit: number = 10): SharedFile[] {
    return Array.from(this.files.values())
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Create folder
   */
  static createFolder(folder: Omit<FileFolder, 'id' | 'createdAt' | 'files' | 'subfolders'>): FileFolder {
    const newFolder: FileFolder = {
      ...folder,
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      files: [],
      subfolders: []
    };

    this.folders.set(newFolder.id, newFolder);
    this.saveToStorage();
    
    toast.success(`Folder created: ${newFolder.name}`);
    return newFolder;
  }

  /**
   * Get all folders
   */
  static getAllFolders(): FileFolder[] {
    return Array.from(this.folders.values());
  }

  /**
   * Get folder by ID
   */
  static getFolder(folderId: string): FileFolder | undefined {
    return this.folders.get(folderId);
  }

  /**
   * Add file to folder
   */
  static addFileToFolder(fileId: string, folderId: string): void {
    const folder = this.folders.get(folderId);
    if (folder && !folder.files.includes(fileId)) {
      folder.files.push(fileId);
      this.saveToStorage();
      toast.success('File added to folder');
    }
  }

  /**
   * Get file statistics
   */
  static getStatistics() {
    const allFiles = Array.from(this.files.values());
    
    return {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, file) => sum + file.size, 0),
      totalDownloads: allFiles.reduce((sum, file) => sum + file.downloads, 0),
      totalViews: allFiles.reduce((sum, file) => sum + file.views, 0),
      byType: {
        document: allFiles.filter(f => f.type === 'document').length,
        image: allFiles.filter(f => f.type === 'image').length,
        video: allFiles.filter(f => f.type === 'video').length,
        audio: allFiles.filter(f => f.type === 'audio').length,
        archive: allFiles.filter(f => f.type === 'archive').length,
        other: allFiles.filter(f => f.type === 'other').length
      }
    };
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file icon
   */
  static getFileIcon(type: FileType): string {
    switch (type) {
      case 'document': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'archive': return '📦';
      default: return '📁';
    }
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('shared_files', JSON.stringify(Array.from(this.files.entries())));
      localStorage.setItem('file_folders', JSON.stringify(Array.from(this.folders.entries())));
    } catch (error) {
      console.error('Error saving file sharing data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private static loadFromStorage(): void {
    try {
      const filesData = localStorage.getItem('shared_files');
      if (filesData) {
        this.files = new Map(JSON.parse(filesData));
      }

      const foldersData = localStorage.getItem('file_folders');
      if (foldersData) {
        this.folders = new Map(JSON.parse(foldersData));
      }
    } catch (error) {
      console.error('Error loading file sharing data:', error);
    }
  }
}
