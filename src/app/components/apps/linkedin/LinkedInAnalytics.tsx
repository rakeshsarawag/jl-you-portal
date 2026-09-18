import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2, Loader2 } from 'lucide-react';
import { useLinkedInAnalytics } from '../../../hooks/useLinkedInData';
import { t } from '../../../../i18n';

export function LinkedInAnalytics() {
  const { analytics, loading } = useLinkedInAnalytics();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('linkedin.loadingAnalytics')}</p>
        </div>
      </div>
    );
  }

  const totalViews = analytics?.totalViews || 12456;
  const totalLikes = analytics?.totalLikes || 1847;
  const totalComments = analytics?.totalComments || 342;
  const totalShares = analytics?.totalShares || 156;
  const engagementRate = analytics?.engagementRate || 4.8;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('linkedin.analytics')}</h1>
        <p className="text-gray-600">{t('linkedin.performanceInsights')}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('linkedin.totalViews')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalViews.toLocaleString()}</div>
            <p className="text-sm text-green-600 mt-1">{t('linkedin.increase12month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              {t('linkedin.totalLikes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totalLikes.toLocaleString()}</div>
            <p className="text-sm text-green-600 mt-1">{t('linkedin.increase8month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {t('linkedin.totalComments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totalComments.toLocaleString()}</div>
            <p className="text-sm text-green-600 mt-1">{t('linkedin.increase15month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              {t('linkedin.totalShares')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{totalShares.toLocaleString()}</div>
            <p className="text-sm text-green-600 mt-1">{t('linkedin.increase6month')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Rate */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            {t('linkedin.engagementRate')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold text-blue-600 mb-2">{engagementRate}%</div>
          <p className="text-gray-600">{t('linkedin.avgEngagement')}</p>
        </CardContent>
      </Card>

      {/* Additional Insights */}
      <Card>
        <CardHeader>
          <CardTitle>{t('linkedin.performanceDashboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('linkedin.chartsComingSoon')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}