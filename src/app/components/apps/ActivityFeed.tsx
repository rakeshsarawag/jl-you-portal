import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  MessageSquare,
  ThumbsUp,
  Share2,
  UserPlus,
  Award,
  TrendingUp,
  Calendar,
  Bell,
  Eye,
  Edit,
  Trash2,
  Pin,
  Bookmark,
  Heart,
  MessageCircle,
  Star,
  Trophy,
  Zap,
  Target,
  X,
  Filter,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface ActivityFeedProps {
  userId: string;
  onClose: () => void;
}

interface Activity {
  id: string;
  type: 'post' | 'comment' | 'reaction' | 'share' | 'follow' | 'achievement' | 'mention' | 'bookmark';
  actor: {
    id: string;
    name: string;
    avatar: string;
  };
  target?: {
    type: 'post' | 'user' | 'achievement';
    id: string;
    title: string;
  };
  content?: string;
  timestamp: string;
  metadata?: any;
  read: boolean;
}

export function ActivityFeed({ userId, onClose }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'mentions' | 'reactions' | 'follows'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Mock activity data - In production, this would come from API
  const activities: Activity[] = [
    {
      id: '1',
      type: 'reaction',
      actor: { id: 'user_002', name: 'Sarah Johnson', avatar: 'SJ' },
      target: { type: 'post', id: 'post_123', title: 'My latest project update' },
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      metadata: { reactionType: 'heart' },
      read: false,
    },
    {
      id: '2',
      type: 'comment',
      actor: { id: 'user_003', name: 'Michael Chen', avatar: 'MC' },
      target: { type: 'post', id: 'post_124', title: 'Team collaboration tips' },
      content: 'Great insights! This really helped our team improve communication.',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: '3',
      type: 'mention',
      actor: { id: 'user_004', name: 'Emily Davis', avatar: 'ED' },
      target: { type: 'post', id: 'post_125', title: 'Q4 Planning Discussion' },
      content: 'Hey @you, what do you think about this approach?',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: '4',
      type: 'follow',
      actor: { id: 'user_005', name: 'David Wilson', avatar: 'DW' },
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
    {
      id: '5',
      type: 'achievement',
      actor: { id: userId, name: 'You', avatar: 'AU' },
      target: { type: 'achievement', id: 'ach_001', title: 'Top Contributor' },
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      metadata: { points: 500 },
      read: true,
    },
    {
      id: '6',
      type: 'share',
      actor: { id: 'user_006', name: 'Lisa Anderson', avatar: 'LA' },
      target: { type: 'post', id: 'post_126', title: 'Best practices for remote work' },
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
    {
      id: '7',
      type: 'reaction',
      actor: { id: 'user_007', name: 'James Brown', avatar: 'JB' },
      target: { type: 'post', id: 'post_127', title: 'Weekly team update' },
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { reactionType: 'thumbsup' },
      read: true,
    },
    {
      id: '8',
      type: 'bookmark',
      actor: { id: 'user_008', name: 'Rachel Green', avatar: 'RG' },
      target: { type: 'post', id: 'post_128', title: 'Design system guidelines' },
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
  ];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (activity: Activity) => {
    switch (activity.type) {
      case 'post':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'comment':
        return <MessageCircle className="h-5 w-5 text-green-600" />;
      case 'reaction':
        if (activity.metadata?.reactionType === 'heart') {
          return <Heart className="h-5 w-5 text-red-600" />;
        }
        return <ThumbsUp className="h-5 w-5 text-purple-600" />;
      case 'share':
        return <Share2 className="h-5 w-5 text-orange-600" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-indigo-600" />;
      case 'achievement':
        return <Trophy className="h-5 w-5 text-yellow-600" />;
      case 'mention':
        return <Bell className="h-5 w-5 text-pink-600" />;
      case 'bookmark':
        return <Bookmark className="h-5 w-5 text-teal-600" />;
      default:
        return <Star className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'reaction':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' reacted to your post '}
            <span className="text-blue-600">"{activity.target?.title}"</span>
          </>
        );
      case 'comment':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' commented on your post '}
            <span className="text-blue-600">"{activity.target?.title}"</span>
          </>
        );
      case 'mention':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' mentioned you in '}
            <span className="text-blue-600">"{activity.target?.title}"</span>
          </>
        );
      case 'follow':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' started following you'}
          </>
        );
      case 'achievement':
        return (
          <>
            {'You earned the '}
            <span className="font-semibold text-yellow-600">"{activity.target?.title}"</span>
            {' badge!'}
          </>
        );
      case 'share':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' shared your post '}
            <span className="text-blue-600">"{activity.target?.title}"</span>
          </>
        );
      case 'bookmark':
        return (
          <>
            <span className="font-semibold">{activity.actor.name}</span>
            {' bookmarked your post '}
            <span className="text-blue-600">"{activity.target?.title}"</span>
          </>
        );
      default:
        return <span>Activity</span>;
    }
  };

  const filterActivities = (activities: Activity[]) => {
    let filtered = activities;

    if (activeTab === 'mentions') {
      filtered = filtered.filter(a => a.type === 'mention');
    } else if (activeTab === 'reactions') {
      filtered = filtered.filter(a => a.type === 'reaction');
    } else if (activeTab === 'follows') {
      filtered = filtered.filter(a => a.type === 'follow');
    }

    if (showUnreadOnly) {
      filtered = filtered.filter(a => !a.read);
    }

    return filtered;
  };

  const filteredActivities = filterActivities(activities);
  const unreadCount = activities.filter(a => !a.read).length;

  const markAllAsRead = () => {
    // In production, this would call an API
    console.log('Mark all as read');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                Activity Feed
                {unreadCount > 0 && (
                  <Badge className="bg-red-500">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Stay updated with your latest interactions
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="p-6 overflow-y-auto flex-1">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All ({activities.length})
                </TabsTrigger>
                <TabsTrigger value="mentions">
                  Mentions ({activities.filter(a => a.type === 'mention').length})
                </TabsTrigger>
                <TabsTrigger value="reactions">
                  Reactions ({activities.filter(a => a.type === 'reaction').length})
                </TabsTrigger>
                <TabsTrigger value="follows">
                  Follows ({activities.filter(a => a.type === 'follow').length})
                </TabsTrigger>
              </TabsList>

              <Button
                variant={showUnreadOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showUnreadOnly ? 'Show All' : 'Unread Only'}
              </Button>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="space-y-3">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No activities yet</p>
                    <p className="text-sm">Your activity feed will appear here</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => (
                    <Card 
                      key={activity.id}
                      className={`${
                        !activity.read 
                          ? 'border-2 border-blue-200 bg-blue-50/50' 
                          : 'hover:bg-gray-50'
                      } transition-colors cursor-pointer`}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {activity.actor.avatar}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getActivityIcon(activity)}
                                <p className="text-sm text-gray-900">
                                  {getActivityText(activity)}
                                </p>
                              </div>
                              {!activity.read && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                              )}
                            </div>

                            {activity.content && (
                              <p className="text-sm text-gray-700 bg-gray-100 rounded-lg p-3 mb-2">
                                {activity.content}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(activity.timestamp)}
                              </span>
                              {activity.metadata?.points && (
                                <span className="flex items-center gap-1 text-yellow-600 font-medium">
                                  <Zap className="h-3 w-3" />
                                  +{activity.metadata.points} points
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredActivities.length} of {activities.length} activities
            </span>
            <Button variant="link" size="sm" className="text-blue-600">
              View All Activity History →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default ActivityFeed;
