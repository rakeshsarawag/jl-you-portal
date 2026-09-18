import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Eye,
  EyeOff,
  Users,
  Clock,
  TrendingUp,
  MapPin,
  Monitor,
  Smartphone,
  X,
  CheckCheck,
  Circle,
  BarChart3,
  Calendar,
  Globe,
  Download,
} from 'lucide-react';

interface ReadReceiptsProps {
  contentId: string;
  contentType: 'post' | 'comment' | 'announcement';
  onClose: () => void;
  showPrivacyControls?: boolean;
}

interface Viewer {
  id: string;
  name: string;
  avatar: string;
  viewedAt: string;
  device: 'desktop' | 'mobile' | 'tablet';
  location?: string;
  duration?: number; // seconds
  isRead: boolean;
}

interface ViewStats {
  totalViews: number;
  uniqueViewers: number;
  avgDuration: number;
  readRate: number;
  peakViewTime: string;
}

export function ReadReceipts({
  contentId,
  contentType,
  onClose,
  showPrivacyControls = true,
}: ReadReceiptsProps) {
  const [privacyMode, setPrivacyMode] = useState<'public' | 'anonymous'>('public');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('all');

  // Mock viewers data
  const viewers: Viewer[] = [
    {
      id: 'user_101',
      name: 'Sarah Johnson',
      avatar: 'SJ',
      viewedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      device: 'desktop',
      location: 'Mumbai, India',
      duration: 145,
      isRead: true,
    },
    {
      id: 'user_102',
      name: 'Michael Chen',
      avatar: 'MC',
      viewedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      device: 'mobile',
      location: 'Bangalore, India',
      duration: 89,
      isRead: true,
    },
    {
      id: 'user_103',
      name: 'Emily Davis',
      avatar: 'ED',
      viewedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      device: 'desktop',
      location: 'Delhi, India',
      duration: 234,
      isRead: true,
    },
    {
      id: 'user_104',
      name: 'David Wilson',
      avatar: 'DW',
      viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      device: 'mobile',
      duration: 15,
      isRead: false,
    },
    {
      id: 'user_105',
      name: 'Lisa Anderson',
      avatar: 'LA',
      viewedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      device: 'tablet',
      location: 'Pune, India',
      duration: 178,
      isRead: true,
    },
    {
      id: 'user_106',
      name: 'James Brown',
      avatar: 'JB',
      viewedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      device: 'desktop',
      duration: 42,
      isRead: false,
    },
  ];

  const stats: ViewStats = {
    totalViews: 24,
    uniqueViewers: viewers.length,
    avgDuration: Math.round(viewers.reduce((sum, v) => sum + (v.duration || 0), 0) / viewers.length),
    readRate: Math.round((viewers.filter(v => v.isRead).length / viewers.length) * 100),
    peakViewTime: '2:30 PM',
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getDeviceIcon = (device: Viewer['device']) => {
    switch (device) {
      case 'desktop':
        return <Monitor className="h-4 w-4 text-blue-600" />;
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-green-600" />;
      case 'tablet':
        return <Monitor className="h-4 w-4 text-purple-600" />;
    }
  };

  const deviceBreakdown = {
    desktop: viewers.filter(v => v.device === 'desktop').length,
    mobile: viewers.filter(v => v.device === 'mobile').length,
    tablet: viewers.filter(v => v.device === 'tablet').length,
  };

  const readViewers = viewers.filter(v => v.isRead);
  const skimmedViewers = viewers.filter(v => !v.isRead);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>View Analytics & Read Receipts</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  See who viewed your {contentType} and engagement metrics
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Privacy Controls */}
          {showPrivacyControls && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-2">Privacy Settings</h4>
                  <div className="flex gap-3">
                    <Button
                      variant={privacyMode === 'public' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrivacyMode('public')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Show Viewers
                    </Button>
                    <Button
                      variant={privacyMode === 'anonymous' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrivacyMode('anonymous')}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Anonymous Count Only
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-600">Total Views</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalViews}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-600">Unique</span>
                </div>
                <p className="text-2xl font-bold">{stats.uniqueViewers}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-gray-600">Avg Duration</span>
                </div>
                <p className="text-2xl font-bold">{stats.avgDuration}s</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCheck className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-gray-600">Read Rate</span>
                </div>
                <p className="text-2xl font-bold">{stats.readRate}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-pink-600" />
                  <span className="text-xs text-gray-600">Peak Time</span>
                </div>
                <p className="text-lg font-bold">{stats.peakViewTime}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="viewers">
            <TabsList className="w-full justify-start mb-6">
              <TabsTrigger value="viewers">
                <Users className="h-4 w-4 mr-2" />
                Viewers ({viewers.length})
              </TabsTrigger>
              <TabsTrigger value="insights">
                <BarChart3 className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </TabsTrigger>
            </TabsList>

            {/* Viewers Tab */}
            <TabsContent value="viewers" className="space-y-6">
              {privacyMode === 'anonymous' ? (
                <Card className="bg-gray-50">
                  <CardContent className="p-8 text-center">
                    <EyeOff className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <h3 className="font-semibold mb-2">Anonymous Mode Enabled</h3>
                    <p className="text-sm text-gray-600">
                      Only view counts are visible. Enable "Show Viewers" to see individual readers.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Read Viewers */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-green-600" />
                      Read ({readViewers.length})
                    </h3>
                    <div className="space-y-3">
                      {readViewers.map((viewer) => (
                        <Card key={viewer.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                {viewer.avatar}
                              </div>

                              <div className="flex-1">
                                <h4 className="font-semibold">{viewer.name}</h4>
                                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimestamp(viewer.viewedAt)}
                                  </span>
                                  {viewer.duration && (
                                    <span className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      {formatDuration(viewer.duration)}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    {getDeviceIcon(viewer.device)}
                                    {viewer.device}
                                  </span>
                                  {viewer.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {viewer.location}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Badge className="bg-green-500">
                                <CheckCheck className="h-3 w-3 mr-1" />
                                Read
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Skimmed Viewers */}
                  {skimmedViewers.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Circle className="h-5 w-5 text-gray-400" />
                        Quick View ({skimmedViewers.length})
                      </h3>
                      <div className="space-y-3">
                        {skimmedViewers.map((viewer) => (
                          <Card key={viewer.id} className="opacity-75">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                                  {viewer.avatar}
                                </div>

                                <div className="flex-1">
                                  <h4 className="font-semibold">{viewer.name}</h4>
                                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTimestamp(viewer.viewedAt)}
                                    </span>
                                    {viewer.duration && (
                                      <span className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" />
                                        {formatDuration(viewer.duration)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <Badge className="bg-gray-400">
                                  Quick View
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {/* Device Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Device Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-blue-600" />
                          Desktop
                        </span>
                        <span className="font-semibold">
                          {deviceBreakdown.desktop} ({Math.round((deviceBreakdown.desktop / viewers.length) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full"
                          style={{ width: `${(deviceBreakdown.desktop / viewers.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-green-600" />
                          Mobile
                        </span>
                        <span className="font-semibold">
                          {deviceBreakdown.mobile} ({Math.round((deviceBreakdown.mobile / viewers.length) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full"
                          style={{ width: `${(deviceBreakdown.mobile / viewers.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-purple-600" />
                          Tablet
                        </span>
                        <span className="font-semibold">
                          {deviceBreakdown.tablet} ({Math.round((deviceBreakdown.tablet / viewers.length) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full"
                          style={{ width: `${(deviceBreakdown.tablet / viewers.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Engagement Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Engagement Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">{readViewers.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Full Reads</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-3xl font-bold text-gray-600">{skimmedViewers.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Quick Views</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                {viewers.map((viewer, idx) => (
                  <div key={viewer.id} className="relative pl-16 pb-8">
                    <div className="absolute left-4 w-4 h-4 rounded-full bg-blue-600 border-4 border-white" />
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {viewer.avatar}
                            </div>
                            <span className="font-semibold">{viewer.name}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {formatTimestamp(viewer.viewedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {viewer.duration && (
                            <span>Spent {formatDuration(viewer.duration)}</span>
                          )}
                          <span>on {viewer.device}</span>
                          {viewer.isRead && (
                            <Badge className="bg-green-500 text-xs">Read</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}

export default ReadReceipts;
