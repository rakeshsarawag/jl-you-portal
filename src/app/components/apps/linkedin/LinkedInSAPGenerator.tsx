import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Sparkles, Copy, Save, Loader2, Check } from 'lucide-react';
import { useLinkedInPosts } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';

const SAP_TEMPLATES = [
  {
    id: 1,
    category: 'S/4HANA',
    title: 'S/4HANA Migration Success',
    content: '🚀 Successfully migrated to SAP S/4HANA! Our journey to intelligent ERP has transformed our business processes and unlocked new capabilities. #SAPS4HANA #DigitalTransformation #CloudERP',
  },
  {
    id: 2,
    category: 'Analytics',
    title: 'SAP Analytics Cloud',
    content: '📊 Real-time insights with SAP Analytics Cloud are driving faster, smarter decisions across our organization. Data-driven decision-making at its finest! #SAPAnalytics #BusinessIntelligence #DataDriven',
  },
  {
    id: 3,
    category: 'Integration',
    title: 'SAP Integration Suite',
    content: '🔗 Seamless integration across our entire IT landscape with SAP Integration Suite. Connecting cloud, on-premise, and third-party systems has never been easier. #SAPIntegration #CloudIntegration #API',
  },
  {
    id: 4,
    category: 'AI/ML',
    title: 'SAP Business AI',
    content: '🤖 Embedding intelligence into every process with SAP Business AI. No data scientists required - just smarter business operations. #SAPAI #MachineLearning #IntelligentEnterprise',
  },
  {
    id: 5,
    category: 'Sustainability',
    title: 'Green Ledger',
    content: '🌱 Tracking our carbon footprint and sustainability goals with SAP Green Ledger. Profitability meets responsibility. #Sustainability #ESG #GreenTech #SAP',
  },
  {
    id: 6,
    category: 'CX',
    title: 'Customer Data Cloud',
    content: '👥 Delivering personalized experiences at scale while maintaining data privacy with SAP Customer Data Cloud. #CustomerExperience #DataPrivacy #CX',
  },
];

export function LinkedInSAPGenerator() {
  const { createPost } = useLinkedInPosts();
  const [selectedTemplate, setSelectedTemplate] = useState(SAP_TEMPLATES[0]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedTemplate.content);
    setCopied(true);
    toast.success('Content copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await createPost({
        content: selectedTemplate.content,
        status: 'draft',
        category: selectedTemplate.category,
      });
      toast.success('Saved to drafts!');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SAP Content Generator</h1>
        <p className="text-gray-600">Topic-based SAP content templates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>SAP Topics</CardTitle>
            <CardDescription>Choose a template category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SAP_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full text-left p-3 rounded-lg border transition-all $\{
                    selectedTemplate.id === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <Badge variant="secondary" className="mb-1">{template.category}</Badge>
                  <p className="text-sm font-medium text-gray-900">{template.title}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Selected SAP template</CardDescription>
              </div>
              <Badge>{selectedTemplate.category}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* LinkedIn Post Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <div className="p-4 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    JL
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Jeshan Labs</h3>
                    <p className="text-xs text-gray-500">SAP Solutions & Consulting</p>
                  </div>
                </div>
                <div className="text-gray-800 text-sm leading-relaxed">
                  {selectedTemplate.content}
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Like</span>
                  <span>Comment</span>
                  <span>Share</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Content
                  </>
                )}
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save to Drafts
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}