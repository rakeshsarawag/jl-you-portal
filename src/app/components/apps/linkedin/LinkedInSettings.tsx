import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Settings, Save, Loader2, Check } from 'lucide-react';
import { useLinkedInSettings } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';
import { t } from '../../../../i18n';

export function LinkedInSettings() {
  const { settings, loading, updateSettings } = useLinkedInSettings();
  const [formData, setFormData] = useState({
    companyName: settings?.companyName || 'Jeshan Labs',
    linkedInUrl: settings?.linkedInUrl || 'linkedin.com/company/jeshanlabs',
    defaultHashtags: settings?.defaultHashtags || '#SAP #Innovation',
    autoSchedule: settings?.autoSchedule || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings(formData);
      toast.success(t('linkedin.settingsSavedToast'));
    } catch (error) {
      toast.error(t('linkedin.settingsFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('linkedin.loadingSettings')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('linkedin.settingsTitle')}</h1>
        <p className="text-gray-600">{t('linkedin.configureIntegration')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('linkedin.companyInfo')}</CardTitle>
            <CardDescription>{t('linkedin.companyInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('linkedin.companyName')}</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder={t('linkedin.companyNamePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('linkedin.linkedInUrl')}</Label>
              <Input
                value={formData.linkedInUrl}
                onChange={(e) => setFormData({ ...formData, linkedInUrl: e.target.value })}
                placeholder={t('linkedin.linkedInUrlPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('linkedin.postDefaults')}</CardTitle>
            <CardDescription>{t('linkedin.postDefaultsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('linkedin.defaultHashtags')}</Label>
              <Input
                value={formData.defaultHashtags}
                onChange={(e) => setFormData({ ...formData, defaultHashtags: e.target.value })}
                placeholder="#SAP #Innovation #Tech"
              />
              <p className="text-xs text-gray-500 mt-1">{t('linkedin.defaultHashtagsHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSchedule"
                checked={formData.autoSchedule}
                onChange={(e) => setFormData({ ...formData, autoSchedule: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              <Label htmlFor="autoSchedule" className="cursor-pointer">
                {t('linkedin.autoSchedule')}
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('linkedin.apiConfig')}</CardTitle>
          <CardDescription>{t('linkedin.apiConfigDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">{t('linkedin.apiComingSoon')}</p>
            <p className="text-sm text-gray-500">{t('linkedin.apiComingSoonDesc')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('linkedin.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('linkedin.saveSettings')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}