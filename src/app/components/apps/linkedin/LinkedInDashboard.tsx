import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { AlertCircle, FileText, Clock, File, CalendarCheck, Settings } from 'lucide-react';
import { useLinkedInStats, useLinkedInEvents, useLinkedInInitialize } from '../../../hooks/useLinkedInData';
import { useEffect } from 'react';
import { t } from '../../../../i18n';

export function LinkedInDashboard() {
  const { stats, loading: statsLoading } = useLinkedInStats();
  const { events, loading: eventsLoading } = useLinkedInEvents();
  const { initialize, initialized } = useLinkedInInitialize();

  // Initialize default events on first load
  useEffect(() => {
    if (!initialized && events && events.length === 0) {
      initialize();
    }
  }, [events, initialized, initialize]);

  // Get upcoming events (next 3)
  const upcomingEvents = events
    ?.filter((e: any) => new Date(e.date) >= new Date())
    ?.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    ?.slice(0, 3) || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('linkedin.dashboard')}</h1>
        <p className="text-gray-600">{t('linkedin.manageContent')}</p>
      </div>

      {/* API Warning Banner */}
      <Card className="mb-8 border-orange-200 bg-orange-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-orange-100 p-2 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-1">{t('linkedin.apiNotConfigured')}</h3>
              <p className="text-orange-800 text-sm mb-3">
                {t('linkedin.apiNotConfiguredDesc')}
              </p>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Settings className="h-4 w-4 mr-2" />
                {t('linkedin.configureAPI')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Posts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">{t('linkedin.totalPosts')}</CardTitle>
              <FileText className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? '...' : stats?.totalPosts || 0}
            </div>
          </CardContent>
        </Card>

        {/* Scheduled */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">{t('linkedin.scheduled')}</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {statsLoading ? '...' : stats?.scheduled || 0}
            </div>
          </CardContent>
        </Card>

        {/* Drafts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">{t('linkedin.drafts')}</CardTitle>
              <File className="h-4 w-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {statsLoading ? '...' : stats?.drafts || 0}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">{t('linkedin.upcomingEvents')}</CardTitle>
              <CalendarCheck className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {eventsLoading ? '...' : events?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Posts */}
        <Card>
          <CardHeader>
            <CardTitle>{t('linkedin.upcomingScheduledPosts')}</CardTitle>
            <CardDescription>{t('linkedin.nextPostsReady')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 rounded-full p-4 mb-4">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 mb-4">{t('linkedin.noScheduledPosts')}</p>
              <Button className="bg-black hover:bg-gray-800">
                {t('linkedin.createFirstPost')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>{t('linkedin.upcomingEvents')}</CardTitle>
            <CardDescription>{t('linkedin.eventsForPosts')}</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="text-center py-8 text-gray-500">{t('linkedin.loadingEvents')}</div>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
                  >
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CalendarCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {event.hashtags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">{t('linkedin.noUpcomingEvents')}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}