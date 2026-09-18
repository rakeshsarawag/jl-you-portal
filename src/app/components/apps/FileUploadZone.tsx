import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Upload,
  X,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadZoneProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  showPreview?: boolean;
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const ACCEPTED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
};

export function FileUploadZone({
  onFilesSelected,
  maxFiles = 10,
  maxFileSize = 10, // 10 MB default
  acceptedTypes = ['image', 'video', 'document'],
  showPreview = true,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAllowedTypes = () => {
    const types: string[] = [];
    acceptedTypes.forEach(category => {
      if (ACCEPTED_FILE_TYPES[category as keyof typeof ACCEPTED_FILE_TYPES]) {
        types.push(...ACCEPTED_FILE_TYPES[category as keyof typeof ACCEPTED_FILE_TYPES]);
      }
    });
    return types;
  };

  const isFileTypeAllowed = (fileType: string) => {
    const allowedTypes = getAllowedTypes();
    return allowedTypes.some(type => fileType.match(type));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.startsWith('video/')) return Video;
    if (fileType.startsWith('audio/')) return Music;
    if (fileType.includes('pdf')) return FileText;
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) return Archive;
    return File;
  };

  const generatePreview = async (file: File): Promise<string | undefined> => {
    if (!showPreview) return undefined;
    
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return { valid: false, error: `File too large (max ${maxFileSize}MB)` };
    }

    // Check file type
    if (!isFileTypeAllowed(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }

    // Check max files
    if (files.length >= maxFiles) {
      return { valid: false, error: `Maximum ${maxFiles} files allowed` };
    }

    return { valid: true };
  };

  const simulateUpload = async (fileId: string) => {
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress, status: 'uploading' as const } : f
      ));
    }

    // Mark as completed
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, status: 'completed' as const } : f
    ));
  };

  const handleFiles = async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const validation = validateFile(file);

      if (!validation.valid) {
        toast.error(validation.error || 'Invalid file');
        continue;
      }

      const preview = await generatePreview(file);
      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${i}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
        progress: 0,
        status: 'pending',
      };

      newFiles.push(uploadedFile);
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      
      // Start upload simulation
      newFiles.forEach(file => {
        simulateUpload(file.id);
      });

      // Notify parent
      onFilesSelected(updatedFiles.filter(f => f.status === 'completed'));
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [files]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles.filter(f => f.status === 'completed'));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Upload className={`h-8 w-8 ${isDragging ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-1">
                {isDragging ? 'Drop files here' : 'Drag & drop files here'}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Max {maxFiles} files • {maxFileSize}MB per file
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Accepted: {acceptedTypes.join(', ')}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAllowedTypes().join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Uploaded Files ({files.length}/{maxFiles})
          </h4>
          
          <div className="space-y-2">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              
              return (
                <Card key={file.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Preview or Icon */}
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <FileIcon className="h-6 w-6 text-gray-600" />
                        </div>
                      )}

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-2 ml-2">
                            {file.status === 'completed' && (
                              <Check className="h-5 w-5 text-green-600" />
                            )}
                            {file.status === 'uploading' && (
                              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                            )}
                            {file.status === 'error' && (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {file.status === 'uploading' && (
                          <div className="space-y-1">
                            <Progress value={file.progress} className="h-1" />
                            <p className="text-xs text-gray-500">{file.progress}%</p>
                          </div>
                        )}

                        {/* Error Message */}
                        {file.status === 'error' && file.error && (
                          <p className="text-xs text-red-600 mt-1">{file.error}</p>
                        )}

                        {/* Success Message */}
                        {file.status === 'completed' && (
                          <p className="text-xs text-green-600 mt-1">Upload complete</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploadZone;
