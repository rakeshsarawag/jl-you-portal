import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { TrendingUp, Users, Target, Loader2 } from 'lucide-react';
import { useLinkedInFollowerGrowth } from '../../../hooks/useLinkedInData';

export function LinkedInFollowerGrowth() {
  const { growth, loading, error } = useLinkedInFollowerGrowth();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading follower growth data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Error loading data: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalFollowers = growth?.totalFollowers || 2458;
  const monthlyGrowth = growth?.monthlyGrowth || 156;
  const growthPercentage = growth?.growthPercentage || 12.5;
  const engagementRate = growth?.engagementRate || 4.2;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Follower Growth</h1>
        <p className="text-gray-600">Track and analyze your LinkedIn company page growth</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Followers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalFollowers.toLocaleString()}</div>
            <p className="text-sm text-green-600 mt-1">↑ {growthPercentage}% this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+{monthlyGrowth}</div>
            <p className="text-sm text-gray-500 mt-1">New followers this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{engagementRate}%</div>
            <p className="text-sm text-gray-500 mt-1">Average post engagement</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Growth Tracking</CardTitle>
          <CardDescription>Monitor your LinkedIn company page: linkedin.com/company/jeshanlabs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Follower growth analytics and insights coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}