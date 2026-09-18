import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  X,
  Trophy,
  Medal,
  Crown,
  Flame,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  Users,
  Award,
  Star,
  Zap,
  Target,
  Calendar,
  Filter,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface LeaderboardModalProps {
  onClose: () => void;
  currentUserId: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  role: string;
  department: string;
  points: number;
  level: number;
  badges: number;
  posts: number;
  comments: number;
  reactions: number;
  streak: number;
  trend: 'up' | 'down' | 'same';
  trendChange?: number;
}

const LEVELS = [
  { level: 1, name: 'Newcomer', minPoints: 0, icon: '🌱', color: 'text-gray-600' },
  { level: 2, name: 'Contributor', minPoints: 100, icon: '💬', color: 'text-blue-600' },
  { level: 3, name: 'Active Member', minPoints: 500, icon: '⚡', color: 'text-purple-600' },
  { level: 4, name: 'Top Contributor', minPoints: 1000, icon: '⭐', color: 'text-yellow-600' },
  { level: 5, name: 'Community Leader', minPoints: 2500, icon: '👑', color: 'text-orange-600' },
  { level: 6, name: 'Legend', minPoints: 5000, icon: '🏆', color: 'text-red-600' },
];

export function LeaderboardModal({ onClose, currentUserId }: LeaderboardModalProps) {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [category, setCategory] = useState<'overall' | 'posts' | 'engagement' | 'streak'>('overall');
  const [sortBy, setSortBy] = useState<'points' | 'posts' | 'engagement'>('points');

  // Mock data - in real app, this would come from API
  const leaderboardData: LeaderboardEntry[] = [
    {
      rank: 1,
      userId: 'user_priya',
      name: 'Priya Patel',
      avatar: 'PP',
      role: 'Product Manager',
      department: 'Product',
      points: 3420,
      level: 5,
      badges: 12,
      posts: 45,
      comments: 128,
      reactions: 567,
      streak: 28,
      trend: 'up',
      trendChange: 2,
    },
    {
      rank: 2,
      userId: 'user_amit',
      name: 'Amit Kumar',
      avatar: 'AK',
      role: 'Senior Developer',
      department: 'Engineering',
      points: 3180,
      level: 5,
      badges: 10,
      posts: 38,
      comments: 156,
      reactions: 489,
      streak: 21,
      trend: 'same',
    },
    {
      rank: 3,
      userId: 'user_rahul',
      name: 'Rahul Sharma',
      avatar: 'RS',
      role: 'UI Designer',
      department: 'Design',
      points: 2950,
      level: 5,
      badges: 9,
      posts: 52,
      comments: 94,
      reactions: 512,
      streak: 14,
      trend: 'down',
      trendChange: 1,
    },
    {
      rank: 4,
      userId: 'user_sneha',
      name: 'Sneha Reddy',
      avatar: 'SR',
      role: 'Marketing Manager',
      department: 'Marketing',
      points: 2680,
      level: 5,
      badges: 11,
      posts: 67,
      comments: 82,
      reactions: 423,
      streak: 19,
      trend: 'up',
      trendChange: 3,
    },
    {
      rank: 5,
      userId: 'user_001',
      name: 'Admin User',
      avatar: 'AU',
      role: 'Admin',
      department: 'Administration',
      points: 2450,
      level: 4,
      badges: 8,
      posts: 34,
      comments: 112,
      reactions: 389,
      streak: 12,
      trend: 'up',
      trendChange: 1,
    },
    {
      rank: 6,
      userId: 'user_karan',
      name: 'Karan Mehta',
      avatar: 'KM',
      role: 'DevOps Engineer',
      department: 'Engineering',
      points: 2120,
      level: 4,
      badges: 7,
      posts: 29,
      comments: 98,
      reactions: 312,
      streak: 9,
      trend: 'same',
    },
    {
      rank: 7,
      userId: 'user_ananya',
      name: 'Ananya Singh',
      avatar: 'AS',
      role: 'HR Manager',
      department: 'Human Resources',
      points: 1890,
      level: 4,
      badges: 6,
      posts: 41,
      comments: 76,
      reactions: 287,
      streak: 16,
      trend: 'up',
      trendChange: 2,
    },
    {
      rank: 8,
      userId: 'user_rohan',
      name: 'Rohan Verma',
      avatar: 'RV',
      role: 'Backend Developer',
      department: 'Engineering',
      points: 1650,
      level: 4,
      badges: 5,
      posts: 23,
      comments: 89,
      reactions: 245,
      streak: 7,
      trend: 'down',
      trendChange: 1,
    },
  ];

  const getLevelInfo = (points: number) => {
    return LEVELS.reduce((prev, curr) => 
      points >= curr.minPoints ? curr : prev
    );
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-100' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-100' };
    if (rank === 3) return { icon: Medal, color: 'text-orange-600', bg: 'bg-orange-100' };
    return { icon: Star, color: 'text-blue-500', bg: 'bg-blue-100' };
  };

  const currentUserEntry = leaderboardData.find(e => e.userId === currentUserId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col my-8">
        <CardHeader className="border-b bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Trophy className="h-8 w-8" />
              Community Leaderboard
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-white/90 text-sm mt-2">
            Compete, contribute, and climb to the top!
          </p>
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex gap-2">
              <Button
                variant={timeframe === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('week')}
              >
                This Week
              </Button>
              <Button
                variant={timeframe === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('month')}
              >
                This Month
              </Button>
              <Button
                variant={timeframe === 'quarter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('quarter')}
              >
                This Quarter
              </Button>
              <Button
                variant={timeframe === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('all')}
              >
                All Time
              </Button>
            </div>

            <div className="flex gap-2">
              <select
                className="px-3 py-1.5 border rounded-lg text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="overall">🏆 Overall</option>
                <option value="posts">📝 Most Posts</option>
                <option value="engagement">💬 Most Engaged</option>
                <option value="streak">🔥 Longest Streak</option>
              </select>
            </div>
          </div>

          {/* Current User Position */}
          {currentUserEntry && (
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-blue-600">
                      #{currentUserEntry.rank}
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold">
                      {currentUserEntry.avatar}
                    </div>
                    <div>
                      <p className="font-semibold">Your Position</p>
                      <p className="text-sm text-gray-600">{currentUserEntry.points} points</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <Badge className={getLevelInfo(currentUserEntry.points).color}>
                        {getLevelInfo(currentUserEntry.points).icon} Level {currentUserEntry.level}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {currentUserEntry.badges} badges earned
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 3 Podium */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Top Contributors
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {/* 2nd Place */}
              {leaderboardData[1] && (
                <div className="pt-8">
                  <Card className="border-2 border-gray-300 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 text-center">
                      <div className="bg-gray-100 p-3 rounded-full inline-block mb-2">
                        <Medal className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="bg-gradient-to-br from-gray-400 to-gray-500 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
                        {leaderboardData[1].avatar}
                      </div>
                      <h4 className="font-bold text-lg mb-1">{leaderboardData[1].name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{leaderboardData[1].role}</p>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge className="bg-gray-100 text-gray-800">
                          {leaderboardData[1].points} pts
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        🔥 {leaderboardData[1].streak} day streak
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 1st Place */}
              {leaderboardData[0] && (
                <div>
                  <Card className="border-4 border-yellow-400 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 animate-pulse" />
                    <CardContent className="p-6 text-center">
                      <div className="bg-yellow-100 p-3 rounded-full inline-block mb-2 relative">
                        <Crown className="h-10 w-10 text-yellow-500" />
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          #1
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3 ring-4 ring-yellow-200">
                        {leaderboardData[0].avatar}
                      </div>
                      <h4 className="font-bold text-xl mb-1">{leaderboardData[0].name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{leaderboardData[0].role}</p>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-lg px-3 py-1">
                          {leaderboardData[0].points} pts
                        </Badge>
                      </div>
                      <div className="text-sm">
                        🔥 {leaderboardData[0].streak} day streak
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 3rd Place */}
              {leaderboardData[2] && (
                <div className="pt-8">
                  <Card className="border-2 border-orange-300 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 text-center">
                      <div className="bg-orange-100 p-3 rounded-full inline-block mb-2">
                        <Medal className="h-8 w-8 text-orange-600" />
                      </div>
                      <div className="bg-gradient-to-br from-orange-400 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
                        {leaderboardData[2].avatar}
                      </div>
                      <h4 className="font-bold text-lg mb-1">{leaderboardData[2].name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{leaderboardData[2].role}</p>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge className="bg-orange-100 text-orange-800">
                          {leaderboardData[2].points} pts
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        🔥 {leaderboardData[2].streak} day streak
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Full Leaderboard */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Rankings
            </h3>
            <div className="space-y-2">
              {leaderboardData.map((entry) => {
                const { icon: MedalIcon, color, bg } = getMedalIcon(entry.rank);
                const levelInfo = getLevelInfo(entry.points);
                const isCurrentUser = entry.userId === currentUserId;

                return (
                  <Card
                    key={entry.userId}
                    className={`hover:shadow-md transition-all ${
                      isCurrentUser ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="flex items-center gap-2 w-16">
                          <div className={`${bg} p-2 rounded-lg`}>
                            <MedalIcon className={`h-5 w-5 ${color}`} />
                          </div>
                          <span className="font-bold text-lg">#{entry.rank}</span>
                        </div>

                        {/* Trend */}
                        <div className="w-8">
                          {entry.trend === 'up' && (
                            <div className="flex items-center text-green-600">
                              <ChevronUp className="h-4 w-4" />
                              <span className="text-xs font-bold">{entry.trendChange}</span>
                            </div>
                          )}
                          {entry.trend === 'down' && (
                            <div className="flex items-center text-red-600">
                              <ChevronDown className="h-4 w-4" />
                              <span className="text-xs font-bold">{entry.trendChange}</span>
                            </div>
                          )}
                          {entry.trend === 'same' && (
                            <div className="text-gray-400 text-xs">—</div>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold">
                          {entry.avatar}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{entry.name}</h4>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{entry.role} • {entry.department}</p>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">{entry.posts}</div>
                            <div className="text-xs text-gray-500">Posts</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-purple-600">{entry.comments}</div>
                            <div className="text-xs text-gray-500">Comments</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-orange-600">{entry.reactions}</div>
                            <div className="text-xs text-gray-500">Reactions</div>
                          </div>
                        </div>

                        {/* Level & Points */}
                        <div className="text-right">
                          <Badge className={`${levelInfo.color} mb-2`}>
                            {levelInfo.icon} Lvl {entry.level}
                          </Badge>
                          <div className="font-bold text-lg">{entry.points}</div>
                          <div className="text-xs text-gray-500">points</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Points System Info */}
          <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                How Points Work
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-blue-600">+10 points</div>
                  <div className="text-gray-600">Create a post</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600">+5 points</div>
                  <div className="text-gray-600">Write a comment</div>
                </div>
                <div>
                  <div className="font-semibold text-purple-600">+2 points</div>
                  <div className="text-gray-600">React to content</div>
                </div>
                <div>
                  <div className="font-semibold text-orange-600">+20 points</div>
                  <div className="text-gray-600">Daily streak bonus</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

export default LeaderboardModal;
