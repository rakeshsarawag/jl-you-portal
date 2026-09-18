import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Hash, TrendingUp, Loader2, BarChart } from 'lucide-react';
import { useLinkedInHashtags } from '../../../hooks/useLinkedInData';

export function LinkedInHashtagAnalyzer() {
  const { hashtags, loading } = useLinkedInHashtags();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading hashtags...</p>
        </div>
      </div>
    );
  }

  const topHashtags = [
    { tag: '#SAP', count: 245, engagement: 4.5 },
    { tag: '#DigitalTransformation', count: 189, engagement: 4.2 },
    { tag: '#CloudERP', count: 156, engagement: 3.8 },
    { tag: '#Innovation', count: 134, engagement: 4.1 },
    { tag: '#S4HANA', count: 112, engagement: 3.9 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hashtag Analyzer</h1>
        <p className="text-gray-600">Research and track hashtag performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Hashtags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{hashtags.length || 25}</div>
            <p className="text-sm text-gray-500 mt-1">Tracked hashtags</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Avg Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">4.1%</div>
            <p className="text-sm text-gray-500 mt-1">Across all hashtags</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Top Performer</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="text-lg">#SAP</Badge>
            <p className="text-sm text-gray-500 mt-1">Most engagement</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Hashtags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topHashtags.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-full font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.tag}</p>
                    <p className="text-sm text-gray-500">{item.count} uses</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-semibold">{item.engagement}%</span>
                  </div>
                  <p className="text-xs text-gray-500">engagement</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}