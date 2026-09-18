import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { useLinkedInPosts } from '../../../hooks/useLinkedInData';
import { InlineLoader } from '../../ui/PageLoader';

export function LinkedInCalendarView() {
  const { posts, loading, error } = useLinkedInPosts();

  if (loading) {
    return <InlineLoader />;
  }

  const scheduledPosts = posts.filter(post => post.status === 'scheduled');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar View</h1>
        <p className="text-gray-600">Visual overview of your scheduled posts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{posts.length}</div>
            <p className="text-sm text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{scheduledPosts.length}</div>
            <p className="text-sm text-gray-500 mt-1">Upcoming posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{scheduledPosts.slice(0, 5).length}</div>
            <p className="text-sm text-gray-500 mt-1">Posts scheduled</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledPosts.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No scheduled posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledPosts.map((post: any) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {post.scheduledDate ? new Date(post.scheduledDate).toLocaleDateString() : 'Not scheduled'}
                        </span>
                        <Badge variant="secondary">{post.status}</Badge>
                      </div>
                      <p className="text-gray-800 line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}