import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { FileText, Plus, Edit, Trash2, Loader2, Save, X } from 'lucide-react';
import { useLinkedInTemplates } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';
import { t } from '../../../../i18n';

export function LinkedInTemplates() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useLinkedInTemplates();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '', category: '' });

  const handleCreate = async () => {
    try {
      await createTemplate(formData);
      setFormData({ name: '', content: '', category: '' });
      setIsCreating(false);
      toast.success(t('linkedin.templateCreated'));
    } catch (error) {
      toast.error(t('linkedin.templateCreatedFailed'));
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateTemplate(id, formData);
      setEditingId(null);
      setFormData({ name: '', content: '', category: '' });
      toast.success(t('linkedin.templateUpdated'));
    } catch (error) {
      toast.error(t('linkedin.templateUpdatedFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success(t('linkedin.templateDeleted'));
    } catch (error) {
      toast.error(t('linkedin.templateDeletedFailed'));
    }
  };

  const startEdit = (template: any) => {
    setEditingId(template.id);
    setFormData({
      name: template.name || '',
      content: template.content || '',
      category: template.category || '',
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('linkedin.loadingTemplates')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('linkedin.postTemplatesList')}</h1>
          <p className="text-gray-600">{t('linkedin.templateQuickDesc')}</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('linkedin.newTemplate')}
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle>{isCreating ? t('linkedin.createNewTemplate') : t('linkedin.editTemplate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>{t('linkedin.templateName')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('linkedin.templateNamePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('linkedin.category')}</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder={t('linkedin.categoryPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('linkedin.templateContentLabel')}</Label>
                <textarea
                  className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder={t('linkedin.templateContentPlaceholder')}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => (isCreating ? handleCreate() : handleUpdate(editingId!))}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isCreating ? t('linkedin.createBtn') : t('linkedin.updateBtn')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingId(null);
                    setFormData({ name: '', content: '', category: '' });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-16 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{t('linkedin.noTemplates')}</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('linkedin.createFirstTemplate')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template: any) => (
            <Card key={template.id} className="hover:border-blue-300 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name || t('linkedin.untitled')}</CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="mt-2">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-4">
                  {template.content || t('linkedin.noContent')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}