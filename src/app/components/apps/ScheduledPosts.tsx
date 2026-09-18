import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Calendar,
  Clock,
  Send,
  Edit,
  Trash2,
  X,
  Plus,
  Check,
  AlertCircle,
  Repeat,
  Zap,
  Eye,
  CalendarDays,
  Timer,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledPostsProps {
  onClose?: () => void;
  onSchedule?: (data: ScheduledPost) => void;
  embedded?: boolean;
}

interface ScheduledPost {
  id: string;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'published' | 'cancelled' | 'failed';
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: string;
  };
  timezone: string;
  createdAt: string;
  tags?: string[];
  attachments?: number;
}

export function ScheduledPosts({
  onClose,
  onSchedule,
  embedded = false,
}: ScheduledPostsProps) {
  const [view, setView] = useState<'list' | 'calendar' | 'create'>('list');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Mock scheduled posts
  const [scheduledPosts] = useState<ScheduledPost[]>([
    {
      id: 'sched_1',
      content: 'Weekly team update: Here are our accomplishments from this week...',
      scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      timezone: 'UTC',
      createdAt: new Date().toISOString(),
      tags: ['team-update', 'weekly'],
      attachments: 2,
    },
    {
      id: 'sched_2',
      content: 'Don\'t forget: Monthly all-hands meeting tomorrow at 10 AM!',
      scheduledFor: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      timezone: 'UTC',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['meeting', 'reminder'],
    },
    {
      id: 'sched_3',
      content: 'Celebrating our product launch! Thank you to everyone who contributed.',
      scheduledFor: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      recurring: {
        frequency: 'weekly',
      },
      timezone: 'UTC',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['celebration', 'team'],
    },
    {
      id: 'sched_4',
      content: 'Published: Q4 Strategy overview and goals for the team',
      scheduledFor: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
      timezone: 'UTC',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['strategy', 'quarterly'],
    },
  ]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit' 
      });
    }

    if (diffHours < 1) return 'In less than an hour';
    if (diffHours < 24) return `In ${diffHours} hours`;
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit' 
    });
  };

  const getTimeUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Past';
    
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const handleSchedulePost = () => {
    if (!postContent.trim()) {
      toast.error('Please enter post content');
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time');
      return;
    }

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
      toast.error('Please select a future date and time');
      return;
    }

    const newPost: ScheduledPost = {
      id: `sched_${Date.now()}`,
      content: postContent,
      scheduledFor: scheduledDateTime.toISOString(),
      status: 'pending',
      timezone: 'UTC',
      createdAt: new Date().toISOString(),
      recurring: isRecurring ? { frequency: recurringFrequency } : undefined,
    };

    if (onSchedule) {
      onSchedule(newPost);
    }

    toast.success(`Post scheduled for ${formatDateTime(scheduledDateTime.toISOString())}`);
    
    // Reset form
    setPostContent('');
    setSelectedDate('');
    setSelectedTime('');
    setIsRecurring(false);
    setView('list');
  };

  const handleCancel = (postId: string) => {
    toast.success('Scheduled post cancelled');
    console.log('Cancel post:', postId);
  };

  const handleEdit = (postId: string) => {
    toast.info('Edit functionality coming soon');
    console.log('Edit post:', postId);
  };

  const getBestTimeToPost = () => {
    // Simulate AI recommendation
    const recommendedHour = 14; // 2 PM
    return `${recommendedHour}:00`;
  };

  const getStatusBadge = (status: ScheduledPost['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Scheduled</Badge>;
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500">Cancelled</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
    }
  };

  const pendingPosts = scheduledPosts.filter(p => p.status === 'pending');
  const publishedPosts = scheduledPosts.filter(p => p.status === 'published');

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Scheduled Posts</h2>
            <p className="text-sm text-gray-600">
              Schedule content to publish automatically
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            List View
          </Button>
          <Button
            variant={view === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('create')}
            className={view === 'create' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule New
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingPosts.length}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{publishedPosts.length}</p>
                <p className="text-sm text-gray-600">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Repeat className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {scheduledPosts.filter(p => p.recurring).length}
                </p>
                <p className="text-sm text-gray-600">Recurring</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Scheduled Post */}
      {view === 'create' && (
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Schedule New Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Best Time Suggestion */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-900 mb-1">AI Recommendation</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    Based on your audience engagement patterns, the best time to post is around{' '}
                    <span className="font-bold">{getBestTimeToPost()}</span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setSelectedDate(tomorrow.toISOString().split('T')[0]);
                      setSelectedTime(getBestTimeToPost());
                    }}
                  >
                    Use Recommendation
                  </Button>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div>
              <Label>Post Content</Label>
              <Textarea
                placeholder="Write your post content..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[120px] mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {postContent.length} / 5000 characters
              </p>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Recurring Option */}
            <div className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <Label className="font-semibold">Recurring Post</Label>
                <p className="text-sm text-gray-600">
                  Automatically repost at regular intervals
                </p>
              </div>
              {isRecurring && (
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as any)}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              )}
            </div>

            {/* Preview */}
            {selectedDate && selectedTime && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-900">Preview</span>
                </div>
                <p className="text-sm text-blue-800">
                  This post will be published on{' '}
                  <span className="font-bold">
                    {formatDateTime(new Date(`${selectedDate}T${selectedTime}`).toISOString())}
                  </span>
                  {isRecurring && (
                    <span> and will repeat {recurringFrequency}</span>
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setView('list')}>
                Cancel
              </Button>
              <Button
                onClick={handleSchedulePost}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* Pending Posts */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Posts ({pendingPosts.length})
            </h3>
            <div className="space-y-3">
              {pendingPosts.length === 0 ? (
                <Card className="bg-gray-50">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600">No scheduled posts</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setView('create')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Your First Post
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                pendingPosts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Time Indicator */}
                        <div className="flex-shrink-0 text-center">
                          <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-3 min-w-[80px]">
                            <div className="text-2xl font-bold">
                              {getTimeUntil(post.scheduledFor)}
                            </div>
                            <div className="text-xs opacity-90">until post</div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(post.status)}
                              {post.recurring && (
                                <Badge className="bg-purple-100 text-purple-700">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {post.recurring.frequency}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(post.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(post.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-gray-900 mb-2 line-clamp-2">
                            {post.content}
                          </p>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDateTime(post.scheduledFor)}
                            </span>
                            {post.tags && (
                              <span className="flex items-center gap-1">
                                {post.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    #{tag}
                                  </Badge>
                                ))}
                              </span>
                            )}
                            {post.attachments && (
                              <span className="flex items-center gap-1">
                                📎 {post.attachments}
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
          </div>

          {/* Published Posts */}
          {publishedPosts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Recently Published ({publishedPosts.length})
              </h3>
              <div className="space-y-3">
                {publishedPosts.map((post) => (
                  <Card key={post.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        {getStatusBadge(post.status)}
                      </div>
                      <p className="text-sm text-gray-700 mb-2 line-clamp-1">
                        {post.content}
                      </p>
                      <p className="text-xs text-gray-500">
                        Published {formatDateTime(post.scheduledFor)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {content}
        </div>
      </Card>
    </div>
  );
}

export default ScheduledPosts;
