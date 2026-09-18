import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Sparkles,
  TrendingUp,
  Users,
  Hash,
  Target,
  Star,
  Zap,
  ThumbsUp,
  MessageCircle,
  Eye,
  BookmarkPlus,
  X,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface ContentRecommendationsProps {
  userId: string;
  currentPostTags?: string[];
  userInterests?: string[];
  onClose?: () => void;
  embedded?: boolean;
}

interface RecommendedPost {
  id: string;
  title: string;
  excerpt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  tags: string[];
  stats: {
    views: number;
    reactions: number;
    comments: number;
  };
  timestamp: string;
  recommendationReason: 'trending' | 'similar-tags' | 'popular' | 'followed-user' | 'ai-suggested';
  matchScore: number;
}

export function ContentRecommendations({
  userId,
  currentPostTags = [],
  userInterests = [],
  onClose,
  embedded = false,
}: ContentRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'trending' | 'personalized'>('personalized');

  useEffect(() => {
    generateRecommendations();
  }, [userId, currentPostTags, filter]);

  const generateRecommendations = async () => {
    setLoading(true);
    
    // Simulate AI recommendation engine
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockRecommendations: RecommendedPost[] = [
      {
        id: 'rec_1',
        title: '10 Best Practices for Remote Team Collaboration',
        excerpt: 'Discover proven strategies to enhance productivity and communication in distributed teams...',
        author: { id: 'user_010', name: 'Alex Morgan', avatar: 'AM' },
        tags: ['collaboration', 'remote-work', 'productivity'],
        stats: { views: 1245, reactions: 89, comments: 34 },
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'trending',
        matchScore: 95,
      },
      {
        id: 'rec_2',
        title: 'Quarterly OKR Planning Workshop Recap',
        excerpt: 'Key takeaways from our strategic planning session and goal-setting framework...',
        author: { id: 'user_011', name: 'Jordan Lee', avatar: 'JL' },
        tags: ['okr', 'planning', 'strategy'],
        stats: { views: 892, reactions: 67, comments: 28 },
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'similar-tags',
        matchScore: 88,
      },
      {
        id: 'rec_3',
        title: 'New Employee Onboarding: A Complete Guide',
        excerpt: 'Everything you need to know about our onboarding process and company culture...',
        author: { id: 'user_012', name: 'Sam Taylor', avatar: 'ST' },
        tags: ['onboarding', 'hr', 'culture'],
        stats: { views: 2103, reactions: 124, comments: 56 },
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'popular',
        matchScore: 82,
      },
      {
        id: 'rec_4',
        title: 'Tech Stack Update: Migrating to Latest Framework',
        excerpt: 'Technical deep-dive into our infrastructure modernization journey...',
        author: { id: 'user_013', name: 'Casey Kim', avatar: 'CK' },
        tags: ['tech', 'engineering', 'migration'],
        stats: { views: 756, reactions: 45, comments: 19 },
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'followed-user',
        matchScore: 91,
      },
      {
        id: 'rec_5',
        title: 'Customer Success Stories: Q1 Wins',
        excerpt: 'Celebrating our biggest customer achievements and impact stories...',
        author: { id: 'user_014', name: 'Riley Chen', avatar: 'RC' },
        tags: ['success', 'customers', 'wins'],
        stats: { views: 1567, reactions: 98, comments: 42 },
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'ai-suggested',
        matchScore: 87,
      },
      {
        id: 'rec_6',
        title: 'Wellness Wednesday: Mental Health Resources',
        excerpt: 'Important resources and tips for maintaining work-life balance...',
        author: { id: 'user_015', name: 'Morgan Park', avatar: 'MP' },
        tags: ['wellness', 'mental-health', 'culture'],
        stats: { views: 1834, reactions: 156, comments: 71 },
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        recommendationReason: 'trending',
        matchScore: 79,
      },
    ];

    // Filter based on selected filter
    let filtered = mockRecommendations;
    if (filter === 'trending') {
      filtered = mockRecommendations.filter(r => r.recommendationReason === 'trending');
    } else if (filter === 'personalized') {
      filtered = mockRecommendations.filter(r => 
        r.recommendationReason === 'similar-tags' || 
        r.recommendationReason === 'followed-user' ||
        r.recommendationReason === 'ai-suggested'
      );
    }

    // Sort by match score
    filtered.sort((a, b) => b.matchScore - a.matchScore);

    setRecommendations(filtered);
    setLoading(false);
  };

  const getReasonBadge = (reason: RecommendedPost['recommendationReason']) => {
    switch (reason) {
      case 'trending':
        return (
          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <TrendingUp className="h-3 w-3 mr-1" />
            Trending
          </Badge>
        );
      case 'similar-tags':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Hash className="h-3 w-3 mr-1" />
            Similar Topics
          </Badge>
        );
      case 'popular':
        return (
          <Badge className="bg-purple-100 text-purple-700">
            <Star className="h-3 w-3 mr-1" />
            Popular
          </Badge>
        );
      case 'followed-user':
        return (
          <Badge className="bg-green-100 text-green-700">
            <Users className="h-3 w-3 mr-1" />
            Following
          </Badge>
        );
      case 'ai-suggested':
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Pick
          </Badge>
        );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);
    
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const content = (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Recommended For You</h3>
            <p className="text-sm text-gray-600">
              AI-powered content suggestions based on your interests
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateRecommendations}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === 'personalized' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('personalized')}
          className={filter === 'personalized' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}
        >
          <Target className="h-4 w-4 mr-2" />
          For You
        </Button>
        <Button
          variant={filter === 'trending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('trending')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Trending
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-purple-600" />
            <p className="text-gray-600">Generating personalized recommendations...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No recommendations available</p>
          </div>
        ) : (
          recommendations.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Match Score Circle */}
                  <div className="flex-shrink-0">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-gray-200"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - post.matchScore / 100)}`}
                          className="text-purple-600 transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-600">
                          {post.matchScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {post.title}
                      </h4>
                      {getReasonBadge(post.recommendationReason)}
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {post.excerpt}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Author and Stats */}
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {post.author.avatar}
                        </div>
                        <span className="font-medium">{post.author.name}</span>
                        <span>•</span>
                        <span>{formatTimestamp(post.timestamp)}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.stats.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {post.stats.reactions}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {post.stats.comments}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" size="sm">
                      <BookmarkPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      {!embedded && recommendations.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline">
            Load More Recommendations
          </Button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {content}
        </div>
      </Card>
    </div>
  );
}

export default ContentRecommendations;
