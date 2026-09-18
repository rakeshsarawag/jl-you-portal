import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  Hash,
  MessageSquare,
  Megaphone,
  BarChart,
  ThumbsUp,
  Eye,
  Clock,
  SlidersHorizontal,
  Save,
  History,
  Sparkles,
  TrendingUp,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdvancedSearchProps {
  onClose?: () => void;
  onSearch?: (results: SearchResult[]) => void;
  embedded?: boolean;
}

interface SearchFilters {
  query: string;
  contentType: ('all' | 'posts' | 'announcements' | 'polls' | 'events')[];
  authors: string[];
  tags: string[];
  dateRange: { start: string; end: string };
  minReactions: number;
  minComments: number;
  minViews: number;
  sortBy: 'relevance' | 'date-desc' | 'date-asc' | 'engagement' | 'views';
  hasAttachments: boolean | null;
}

interface SearchResult {
  id: string;
  type: 'post' | 'announcement' | 'poll' | 'event';
  title: string;
  excerpt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  timestamp: string;
  tags: string[];
  stats: {
    reactions: number;
    comments: number;
    views: number;
  };
  hasAttachments: boolean;
  matchScore: number;
}

export function AdvancedSearch({
  onClose,
  onSearch,
  embedded = false,
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    contentType: ['all'],
    authors: [],
    tags: [],
    dateRange: { start: '', end: '' },
    minReactions: 0,
    minComments: 0,
    minViews: 0,
    sortBy: 'relevance',
    hasAttachments: null,
  });

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [savedSearches] = useState([
    { id: '1', name: 'My Posts from Last Week', count: 12 },
    { id: '2', name: 'Trending Announcements', count: 8 },
    { id: '3', name: 'High Engagement Posts', count: 24 },
  ]);

  // Mock search results
  const mockResults: SearchResult[] = [
    {
      id: 'res_1',
      type: 'post',
      title: 'Team Collaboration Best Practices',
      excerpt: 'Sharing some insights on how we can improve our remote collaboration...',
      author: { id: 'user_201', name: 'Sarah Johnson', avatar: 'SJ' },
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      tags: ['collaboration', 'remote-work', 'best-practices'],
      stats: { reactions: 45, comments: 12, views: 234 },
      hasAttachments: true,
      matchScore: 98,
    },
    {
      id: 'res_2',
      type: 'announcement',
      title: 'Q4 Planning Workshop - Join Us!',
      excerpt: 'Important announcement about our quarterly planning session coming up next week...',
      author: { id: 'user_202', name: 'Michael Chen', avatar: 'MC' },
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      tags: ['planning', 'q4', 'workshop'],
      stats: { reactions: 67, comments: 23, views: 456 },
      hasAttachments: false,
      matchScore: 92,
    },
    {
      id: 'res_3',
      type: 'post',
      title: 'New Feature Launch Success Metrics',
      excerpt: 'Excited to share the results from our latest product launch...',
      author: { id: 'user_203', name: 'Emily Davis', avatar: 'ED' },
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['product', 'launch', 'metrics'],
      stats: { reactions: 89, comments: 34, views: 678 },
      hasAttachments: true,
      matchScore: 87,
    },
  ];

  const handleSearch = async () => {
    if (!filters.query.trim() && filters.contentType.includes('all')) {
      toast.error('Please enter a search query or select filters');
      return;
    }

    setSearching(true);

    // Simulate search
    await new Promise(resolve => setTimeout(resolve, 800));

    const filteredResults = mockResults.filter(result => {
      // Apply filters
      if (filters.minReactions && result.stats.reactions < filters.minReactions) return false;
      if (filters.minComments && result.stats.comments < filters.minComments) return false;
      if (filters.minViews && result.stats.views < filters.minViews) return false;
      if (filters.hasAttachments !== null && result.hasAttachments !== filters.hasAttachments) return false;
      
      return true;
    });

    // Sort results
    const sorted = [...filteredResults].sort((a, b) => {
      switch (filters.sortBy) {
        case 'date-desc':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'date-asc':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        case 'engagement':
          return (b.stats.reactions + b.stats.comments) - (a.stats.reactions + a.stats.comments);
        case 'views':
          return b.stats.views - a.stats.views;
        default:
          return b.matchScore - a.matchScore;
      }
    });

    setResults(sorted);
    setSearching(false);

    if (onSearch) {
      onSearch(sorted);
    }

    toast.success(`Found ${sorted.length} results`);
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      contentType: ['all'],
      authors: [],
      tags: [],
      dateRange: { start: '', end: '' },
      minReactions: 0,
      minComments: 0,
      minViews: 0,
      sortBy: 'relevance',
      hasAttachments: null,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-orange-600" />;
      case 'poll':
        return <BarChart className="h-4 w-4 text-purple-600" />;
      case 'event':
        return <Calendar className="h-4 w-4 text-green-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);
    
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const activeFiltersCount = 
    (filters.contentType.length > 1 || !filters.contentType.includes('all') ? 1 : 0) +
    (filters.authors.length > 0 ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0) +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0) +
    (filters.minReactions > 0 ? 1 : 0) +
    (filters.minComments > 0 ? 1 : 0) +
    (filters.minViews > 0 ? 1 : 0) +
    (filters.hasAttachments !== null ? 1 : 0);

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-lg">
            <Search className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Advanced Search</h2>
            <p className="text-sm text-gray-600">
              Find exactly what you're looking for
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <Card className="border-2 border-purple-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search posts, announcements, people, tags..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12 text-base"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6"
            >
              {searching ? (
                <>Searching...</>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          {showFilters ? 'Hide' : 'Show'} Filters
          {activeFiltersCount > 0 && (
            <Badge className="ml-2 bg-purple-500">{activeFiltersCount}</Badge>
          )}
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Search
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-purple-600" />
              Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content Type */}
            <div>
              <Label className="mb-2 block">Content Type</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All', icon: Sparkles },
                  { value: 'posts', label: 'Posts', icon: MessageSquare },
                  { value: 'announcements', label: 'Announcements', icon: Megaphone },
                  { value: 'polls', label: 'Polls', icon: BarChart },
                  { value: 'events', label: 'Events', icon: Calendar },
                ].map((type) => {
                  const Icon = type.icon;
                  const isSelected = filters.contentType.includes(type.value as any);
                  return (
                    <Button
                      key={type.value}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (type.value === 'all') {
                          setFilters({ ...filters, contentType: ['all'] });
                        } else {
                          const newTypes = filters.contentType.filter(t => t !== 'all');
                          if (isSelected) {
                            setFilters({
                              ...filters,
                              contentType: newTypes.filter(t => t !== type.value),
                            });
                          } else {
                            setFilters({
                              ...filters,
                              contentType: [...newTypes, type.value] as any,
                            });
                          }
                        }
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {type.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <Label className="mb-2 block">Date Range</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: e.target.value },
                    })
                  }
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, end: e.target.value },
                    })
                  }
                  placeholder="To"
                />
              </div>
            </div>

            {/* Engagement Filters */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-2 block text-sm">Min. Reactions</Label>
                <Input
                  type="number"
                  min="0"
                  value={filters.minReactions}
                  onChange={(e) =>
                    setFilters({ ...filters, minReactions: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm">Min. Comments</Label>
                <Input
                  type="number"
                  min="0"
                  value={filters.minComments}
                  onChange={(e) =>
                    setFilters({ ...filters, minComments: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm">Min. Views</Label>
                <Input
                  type="number"
                  min="0"
                  value={filters.minViews}
                  onChange={(e) =>
                    setFilters({ ...filters, minViews: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            {/* Additional Filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.hasAttachments === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      hasAttachments: e.target.checked ? true : null,
                    })
                  }
                  className="w-4 h-4"
                />
                <Label className="text-sm">Has Attachments</Label>
              </div>
            </div>

            {/* Sort By */}
            <div>
              <Label className="mb-2 block">Sort By</Label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg"
              >
                <option value="relevance">Relevance</option>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="engagement">Most Engaged</option>
                <option value="views">Most Viewed</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <History className="h-4 w-4" />
            Saved Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((saved) => (
              <Button
                key={saved.id}
                variant="outline"
                size="sm"
                className="hover:bg-purple-50 hover:border-purple-300"
              >
                {saved.name}
                <Badge className="ml-2 bg-purple-100 text-purple-700">
                  {saved.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Search Results ({results.length})
            </h3>
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Match Score */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {result.matchScore}%
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(result.type)}
                          <h4 className="font-semibold text-gray-900 hover:text-purple-600">
                            {result.title}
                          </h4>
                        </div>
                        <Badge className="bg-purple-100 text-purple-700">
                          {result.type}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {result.excerpt}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {result.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Author and Stats */}
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {result.author.avatar}
                          </div>
                          <span>{result.author.name}</span>
                          <span>•</span>
                          <span>{formatTimestamp(result.timestamp)}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {result.stats.reactions}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {result.stats.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {result.stats.views}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !searching && filters.query && (
        <Card className="bg-gray-50">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-sm text-gray-600">
              Try adjusting your filters or search query
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {content}
        </div>
      </Card>
    </div>
  );
}

export default AdvancedSearch;
