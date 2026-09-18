import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Plus, Send, Loader2, Calendar, Save } from 'lucide-react';
import { useLinkedInPosts } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';
import { t } from '../../../../i18n';

export function LinkedInCreatePost() {
  const { createPost } = useLinkedInPosts();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published'>('draft');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (postStatus: 'draft' | 'scheduled' | 'published') => {
    if (!content.trim()) {
      toast.error(t('linkedin.enterPostContent'));
      return;
    }

    try {
      setSaving(true);
      await createPost({
        content: content.trim(),
        status: postStatus,
        scheduledDate: postStatus === 'scheduled' ? new Date(Date.now() + 86400000).toISOString() : null,
      });
      toast.success(`Post ${postStatus === 'draft' ? 'saved as draft' : postStatus === 'scheduled' ? 'scheduled' : 'published'}!`);
      setContent('');
    } catch (error) {
      toast.error(t('linkedin.failedToCreate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('linkedin.createPostTitle')}</h1>
        <p className="text-gray-600">{t('linkedin.composeSchedule')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Composer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('linkedin.postComposer')}</CardTitle>
              <CardDescription>{t('linkedin.writeContent')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>{t('linkedin.postContent')}</Label>
                  <textarea
                    className="w-full min-h-[300px] p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('linkedin.postContentPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {content.length} {t('linkedin.characters')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCreate('draft')}
                    variant="outline"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('linkedin.saveDraft')}
                  </Button>
                  <Button
                    onClick={() => handleCreate('scheduled')}
                    variant="outline"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="h-4 w-4 mr-2" />
                    )}
                    {t('linkedin.schedule')}
                  </Button>
                  <Button
                    onClick={() => handleCreate('published')}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {t('linkedin.publishNow')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Tips & Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('linkedin.quickTips')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>{t('linkedin.tip1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>{t('linkedin.tip2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>{t('linkedin.tip3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>{t('linkedin.tip4')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>{t('linkedin.tip5')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('linkedin.bestPractices')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{t('linkedin.optimalLength')}</p>
                  <p className="text-gray-600">{t('linkedin.optimalLengthDesc')}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('linkedin.bestTimes')}</p>
                  <p className="text-gray-600">{t('linkedin.bestTimesDesc')}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('linkedin.frequency')}</p>
                  <p className="text-gray-600">{t('linkedin.frequencyDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}