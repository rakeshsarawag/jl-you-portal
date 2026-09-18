import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Video,
  Smile,
  Hash,
  AtSign,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Eye,
  EyeOff,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  showPreview?: boolean;
  enableMentions?: boolean;
  enableHashtags?: boolean;
  onMention?: (query: string) => void;
  onHashtag?: (query: string) => void;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something amazing...',
  maxLength = 5000,
  showPreview = false,
  enableMentions = true,
  enableHashtags = true,
  onMention,
  onHashtag,
}: RichTextEditorProps) {
  const [content, setContent] = useState(value);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
    heading: 'none' as 'none' | 'h1' | 'h2' | 'h3',
    align: 'left' as 'left' | 'center' | 'right',
    list: 'none' as 'none' | 'bullet' | 'number',
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(value);
  }, [value]);

  const updateContent = (newContent: string) => {
    setContent(newContent);
    onChange(newContent);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newContent = history[newIndex];
      setContent(newContent);
      onChange(newContent);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newContent = history[newIndex];
      setContent(newContent);
      onChange(newContent);
    }
  };

  const insertAtCursor = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = 
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end);

    updateContent(newContent);

    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const applyFormatting = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      // No selection, insert markers
      switch (format) {
        case 'bold':
          insertAtCursor('**', '**');
          break;
        case 'italic':
          insertAtCursor('*', '*');
          break;
        case 'underline':
          insertAtCursor('__', '__');
          break;
        case 'code':
          insertAtCursor('`', '`');
          break;
        case 'link':
          insertAtCursor('[', '](url)');
          break;
      }
    } else {
      // Wrap selection
      switch (format) {
        case 'bold':
          insertAtCursor('**', '**');
          break;
        case 'italic':
          insertAtCursor('*', '*');
          break;
        case 'underline':
          insertAtCursor('__', '__');
          break;
        case 'code':
          insertAtCursor('`', '`');
          break;
        case 'link':
          insertAtCursor('[', '](url)');
          break;
      }
    }
  };

  const insertHeading = (level: 1 | 2 | 3) => {
    const prefix = '#'.repeat(level) + ' ';
    
    // Insert at beginning of line
    const lines = content.split('\n');
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    let lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    const newContent =
      content.substring(0, lineStart) +
      prefix +
      content.substring(lineStart);

    updateContent(newContent);
  };

  const insertList = (type: 'bullet' | 'number') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    let lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    const prefix = type === 'bullet' ? '• ' : '1. ';
    const newContent =
      content.substring(0, lineStart) +
      prefix +
      content.substring(lineStart);

    updateContent(newContent);
  };

  const insertBlockquote = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    let lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    const newContent =
      content.substring(0, lineStart) +
      '> ' +
      content.substring(lineStart);

    updateContent(newContent);
  };

  const renderPreview = () => {
    let html = content;

    // Convert markdown to HTML
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Underline
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    // Code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>');
    // Headings
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-4 mb-2">$1</h1>');
    // Lists
    html = html.replace(/^• (.*$)/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal">$1</li>');
    // Blockquotes
    html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-700">$1</blockquote>');
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    // Hashtags
    html = html.replace(/#([\w-]+)/g, '<span class="text-blue-600 font-medium">#$1</span>');
    // Mentions
    html = html.replace(/@([\w-]+)/g, '<span class="text-purple-600 font-medium">@$1</span>');

    return html;
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 rounded-lg border flex-wrap">
        {/* History */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Text Formatting */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFormatting('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFormatting('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFormatting('underline')}
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFormatting('code')}
            title="Code"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(1)}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(2)}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(3)}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists & Quote */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertList('bullet')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertList('number')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={insertBlockquote}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        {/* Insert */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFormatting('link')}
            title="Insert Link"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertAtCursor('![image](url)')}
            title="Insert Image"
          >
            <Image className="h-4 w-4" />
          </Button>
        </div>

        {/* Special */}
        {enableHashtags && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertAtCursor('#')}
            title="Add Hashtag"
          >
            <Hash className="h-4 w-4" />
          </Button>
        )}
        {enableMentions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertAtCursor('@')}
            title="Mention Someone"
          >
            <AtSign className="h-4 w-4" />
          </Button>
        )}

        {/* Preview Toggle */}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
            title={previewMode ? 'Edit' : 'Preview'}
          >
            {previewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="ml-2 text-xs">{previewMode ? 'Preview' : 'Edit'}</span>
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {previewMode ? (
        <Card className="min-h-[200px]">
          <CardContent className="p-4">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview() }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full p-4 border-2 border-gray-200 rounded-lg min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm"
          />
          
          {/* Character Counter */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded">
            {content.length} / {maxLength}
          </div>
        </div>
      )}

      {/* Formatting Help */}
      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer hover:text-gray-900 font-medium">
          Formatting Help
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1">
          <p><code>**bold**</code> - <strong>bold text</strong></p>
          <p><code>*italic*</code> - <em>italic text</em></p>
          <p><code>__underline__</code> - <u>underline text</u></p>
          <p><code>`code`</code> - <code>inline code</code></p>
          <p><code>[link](url)</code> - hyperlink</p>
          <p><code># Heading 1</code> - large heading</p>
          <p><code>## Heading 2</code> - medium heading</p>
          <p><code>### Heading 3</code> - small heading</p>
          <p><code>• item</code> - bullet point</p>
          <p><code>1. item</code> - numbered list</p>
          <p><code>&gt; quote</code> - blockquote</p>
          <p><code>#hashtag</code> - hashtag</p>
          <p><code>@mention</code> - mention user</p>
        </div>
      </details>
    </div>
  );
}

export default RichTextEditor;
