import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, X, Link2, Image, FileText, Loader2 } from 'lucide-react';

interface LinkPreviewGeneratorProps {
  url: string;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  type: 'website' | 'video' | 'article' | 'image';
}

export function LinkPreviewGenerator({ 
  url, 
  onRemove, 
  showRemoveButton = true 
}: LinkPreviewGeneratorProps) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    generatePreview(url);
  }, [url]);

  const generatePreview = async (link: string) => {
    setLoading(true);
    setError(false);

    try {
      // Simulate API call - In production, this would call a backend service
      // that fetches Open Graph metadata from the URL
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock preview data based on URL patterns
      const mockPreview = generateMockPreview(link);
      setPreview(mockPreview);
    } catch (err) {
      console.error('Failed to generate preview:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const generateMockPreview = (link: string): LinkPreview => {
    const domain = extractDomain(link);
    
    // Generate realistic previews based on domain
    if (link.includes('youtube.com') || link.includes('youtu.be')) {
      return {
        url: link,
        title: 'Amazing Video Tutorial - Learn React in 2024',
        description: 'A comprehensive guide to mastering React development with hooks, context, and best practices.',
        image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
        favicon: '🎥',
        siteName: 'YouTube',
        type: 'video',
      };
    }
    
    if (link.includes('github.com')) {
      return {
        url: link,
        title: 'awesome-project - GitHub Repository',
        description: 'A curated list of awesome frameworks, libraries and software. Built with TypeScript and modern tools.',
        image: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800',
        favicon: '💻',
        siteName: 'GitHub',
        type: 'website',
      };
    }
    
    if (link.includes('medium.com') || link.includes('dev.to')) {
      return {
        url: link,
        title: '10 Advanced TypeScript Patterns You Should Know',
        description: 'Deep dive into advanced TypeScript patterns including generics, conditional types, and utility types that will level up your code.',
        image: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800',
        favicon: '📝',
        siteName: domain,
        type: 'article',
      };
    }
    
    if (link.includes('twitter.com') || link.includes('x.com')) {
      return {
        url: link,
        title: 'Trending Tech News on Twitter',
        description: 'Just launched our new AI-powered feature! Check it out and let us know what you think. #TechInnovation #AI',
        favicon: '🐦',
        siteName: 'Twitter/X',
        type: 'website',
      };
    }

    if (link.includes('linkedin.com')) {
      return {
        url: link,
        title: 'Professional Insights on LinkedIn',
        description: 'Excited to announce our team\'s achievement! We\'ve successfully delivered a major project ahead of schedule.',
        image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        favicon: '💼',
        siteName: 'LinkedIn',
        type: 'website',
      };
    }

    // Generic preview for unknown domains
    return {
      url: link,
      title: `${domain} - Web Content`,
      description: 'Interesting content worth checking out. Click to visit the full article or webpage.',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      favicon: '🌐',
      siteName: domain,
      type: 'website',
    };
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Generating link preview...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <Card className="border-2 border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <Link2 className="h-4 w-4" />
              <span className="text-sm font-medium">Unable to preview link</span>
            </div>
            {showRemoveButton && onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-2 block truncate"
          >
            {url}
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors overflow-hidden">
      <CardContent className="p-0">
        <a 
          href={preview.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block hover:bg-gray-50 transition-colors"
        >
          {preview.image && (
            <div className="relative h-48 bg-gray-100 overflow-hidden">
              <img 
                src={preview.image} 
                alt={preview.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {preview.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="bg-white/90 rounded-full p-4">
                    <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
              {showRemoveButton && onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">
                {preview.favicon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {preview.siteName && (
                    <span className="text-xs text-gray-600 font-medium">
                      {preview.siteName}
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </div>
                
                <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                  {preview.title}
                </h4>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {preview.description}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {preview.type === 'video' && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Video
                    </span>
                  )}
                  {preview.type === 'article' && (
                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      <FileText className="h-3 w-3" />
                      Article
                    </span>
                  )}
                  {preview.type === 'image' && (
                    <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      <Image className="h-3 w-3" />
                      Image
                    </span>
                  )}
                  <span className="truncate">{extractDomain(preview.url)}</span>
                </div>
              </div>
            </div>
          </div>
        </a>
      </CardContent>
    </Card>
  );
}

// Utility function to detect URLs in text
export function detectUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Utility function to extract and deduplicate URLs
export function extractUniqueUrls(text: string): string[] {
  const urls = detectUrls(text);
  return [...new Set(urls)];
}

export default LinkPreviewGenerator;
