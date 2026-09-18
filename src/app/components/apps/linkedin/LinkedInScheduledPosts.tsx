import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Clock, Edit, Trash2, Loader2, Calendar } from 'lucide-react';
import { useLinkedInPosts } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';

export function LinkedInScheduledPosts() {
  const { posts, loading, deletePost } = useLinkedInPosts();

  const scheduledPosts = posts.filter(post => post.status === 'scheduled');

  const handleDelete = async (id: string) => {
    try {
      await deletePost(id);
      toast.success('Post deleted!');
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading scheduled posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scheduled Posts</h1>
        <p className="text-gray-600">Manage your scheduled LinkedIn posts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{scheduledPosts.length}</div>
            <p className="text-sm text-gray-500 mt-1">Upcoming posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{Math.min(scheduledPosts.length, 3)}</div>
            <p className="text-sm text-gray-500 mt-1">Posts scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Next Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-purple-600">
              {scheduledPosts.length > 0 ? 'Tomorrow' : 'None'}
            </div>
            <p className="text-sm text-gray-500 mt-1">10:00 AM</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledPosts.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No scheduled posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledPosts.map((post: any) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {post.scheduledDate ? new Date(post.scheduledDate).toLocaleDateString() : 'Not set'}
                        </span>
                        <Badge variant="secondary">{post.status}</Badge>
                      </div>
                      <p className="text-gray-800 line-clamp-3 mb-2">{post.content}</p>
                      <p className="text-xs text-gray-500">
                        Created: {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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