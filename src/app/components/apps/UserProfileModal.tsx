import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  X,
  User,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Award,
  TrendingUp,
  MessageSquare,
  MessageCircle,
  ThumbsUp,
  Users,
  Star,
  Trophy,
  Flame,
  Target,
  Zap,
  Crown,
  Medal,
  CheckCircle,
  UserPlus,
  UserMinus,
  Send,
  MoreHorizontal,
} from 'lucide-react';

interface UserProfileModalProps {
  user: UserProfile;
  currentUserId: string;
  onClose: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  bio?: string;
  department?: string;
  location?: string;
  joinDate: string;
  coverImage?: string;
  stats: {
    posts: number;
    comments: number;
    reactions: number;
    followers: number;
    following: number;
  };
  badges: UserBadge[];
  isFollowing?: boolean;
  recentActivity?: Activity[];
  topPosts?: Post[];
}

interface UserBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Activity {
  id: string;
  type: 'post' | 'comment' | 'reaction' | 'achievement';
  description: string;
  timestamp: string;
}

interface Post {
  id: string;
  content: string;
  reactions: number;
  comments: number;
  timestamp: string;
}

const BADGE_ICONS: { [key: string]: any } = {
  star: Star,
  trophy: Trophy,
  flame: Flame,
  crown: Crown,
  medal: Medal,
  target: Target,
  zap: Zap,
  award: Award,
};

const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800 border-gray-300',
  rare: 'bg-blue-100 text-blue-800 border-blue-300',
  epic: 'bg-purple-100 text-purple-800 border-purple-300',
  legendary: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-500',
};

export function UserProfileModal({
  user,
  currentUserId,
  onClose,
  onFollow,
  onUnfollow,
  onMessage,
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const isOwnProfile = user.id === currentUserId;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8">
        {/* Header with Cover Image */}
        <div className="relative">
          {/* Cover Image */}
          <div className="h-48 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600" />
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Profile Avatar */}
          <div className="absolute -bottom-16 left-8">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg">
                {user.avatar}
              </div>
              {user.isFollowing && (
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-2 rounded-full">
                  <CheckCircle className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <CardContent className="pt-20 pb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-1">{user.name}</h2>
              <p className="text-gray-600 mb-2">{user.role}</p>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                {user.department && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>{user.department}</span>
                  </div>
                )}
                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{user.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {formatDate(user.joinDate)}</span>
                </div>
              </div>

              {user.bio && (
                <p className="text-gray-700 mb-4">{user.bio}</p>
              )}

              {/* Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{user.stats.posts}</div>
                  <div className="text-xs text-gray-600">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{user.stats.comments}</div>
                  <div className="text-xs text-gray-600">Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{user.stats.reactions}</div>
                  <div className="text-xs text-gray-600">Reactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{user.stats.followers}</div>
                  <div className="text-xs text-gray-600">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">{user.stats.following}</div>
                  <div className="text-xs text-gray-600">Following</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isOwnProfile && (
              <div className="flex gap-2">
                {user.isFollowing ? (
                  <Button variant="outline" onClick={onUnfollow}>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Unfollow
                  </Button>
                ) : (
                  <Button onClick={onFollow} className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Follow
                  </Button>
                )}
                <Button variant="outline" onClick={onMessage}>
                  <Send className="h-4 w-4 mr-2" />
                  Message
                </Button>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isOwnProfile && (
              <Button variant="outline">
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="badges">
                Badges ({user.badges.length})
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="posts">Top Posts</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Achievements */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Recent Achievements
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {user.badges.slice(0, 4).map((badge) => {
                    const IconComponent = BADGE_ICONS[badge.icon] || Award;
                    return (
                      <div
                        key={badge.id}
                        className={`p-4 rounded-lg border-2 text-center ${
                          RARITY_COLORS[badge.rarity]
                        }`}
                      >
                        <IconComponent className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-semibold text-sm">{badge.name}</p>
                        <p className="text-xs opacity-80 mt-1">{badge.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Engagement Stats */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Engagement Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <MessageSquare className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Avg. Engagement</p>
                          <p className="text-2xl font-bold">
                            {Math.round((user.stats.reactions + user.stats.comments) / user.stats.posts) || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <ThumbsUp className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Reactions</p>
                          <p className="text-2xl font-bold">{user.stats.reactions}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-3 rounded-lg">
                          <Users className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Network</p>
                          <p className="text-2xl font-bold">
                            {user.stats.followers + user.stats.following}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Badges Tab */}
            <TabsContent value="badges" className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {user.badges.map((badge) => {
                  const IconComponent = BADGE_ICONS[badge.icon] || Award;
                  return (
                    <Card
                      key={badge.id}
                      className={`overflow-hidden border-2 ${
                        badge.rarity === 'legendary' ? 'animate-pulse' : ''
                      }`}
                    >
                      <CardContent className={`p-6 text-center ${RARITY_COLORS[badge.rarity]}`}>
                        <IconComponent className="h-12 w-12 mx-auto mb-3" />
                        <h4 className="font-bold mb-1">{badge.name}</h4>
                        <p className="text-xs opacity-90 mb-2">{badge.description}</p>
                        <Badge variant="outline" className="text-xs">
                          {badge.rarity}
                        </Badge>
                        <p className="text-xs mt-2 opacity-75">
                          Earned {formatDate(badge.earnedAt)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-6">
              <div className="space-y-3">
                {user.recentActivity?.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                          {activity.type === 'post' && <MessageSquare className="h-4 w-4 text-blue-600" />}
                          {activity.type === 'comment' && <MessageCircle className="h-4 w-4 text-blue-600" />}
                          {activity.type === 'reaction' && <ThumbsUp className="h-4 w-4 text-blue-600" />}
                          {activity.type === 'achievement' && <Award className="h-4 w-4 text-blue-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDateTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Top Posts Tab */}
            <TabsContent value="posts" className="mt-6">
              <div className="space-y-4">
                {user.topPosts?.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <p className="text-sm mb-3">{post.content}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {post.reactions}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {post.comments}
                        </span>
                        <span>{formatDateTime(post.timestamp)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProfileModal;