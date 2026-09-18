import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Sparkles, RefreshCw, Copy, Heart, MessageCircle, Share2, Check, Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { toast } from 'sonner';
import { useLinkedInPosts } from '../../../hooks/useLinkedInData';

interface AIPost {
  id: string;
  content: string;
  hashtags: string[];
  imageQuery: string;
  category: string;
}

const AI_GENERATED_POSTS: AIPost[] = [
  {
    id: '1',
    content: '🚀 Digital transformation is not just about technology—it\'s about reimagining your business processes. SAP S/4HANA Cloud provides the foundation for intelligent enterprise operations.',
    hashtags: ['#DigitalTransformation', '#SAPS4HANA', '#CloudERP', '#Innovation'],
    imageQuery: 'cloud computing technology',
    category: 'Digital Transformation',
  },
  {
    id: '2',
    content: '💡 Did you know? Companies using SAP Analytics Cloud see up to 30% faster decision-making. Real-time insights drive real business impact.',
    hashtags: ['#SAPAnalytics', '#DataDriven', '#BusinessIntelligence', '#SAC'],
    imageQuery: 'business analytics dashboard',
    category: 'Analytics',
  },
  {
    id: '3',
    content: '🌍 Sustainability meets profitability. SAP\'s Green Ledger helps organizations track their carbon footprint while optimizing operations. The future is sustainable!',
    hashtags: ['#Sustainability', '#GreenTech', '#SAPESG', '#ClimateAction'],
    imageQuery: 'sustainable business green energy',
    category: 'Sustainability',
  },
  {
    id: '4',
    content: '🎯 Customer experience is everything. SAP Customer Data Cloud enables personalized experiences at scale while maintaining data privacy and compliance.',
    hashtags: ['#CustomerExperience', '#CX', '#DataPrivacy', '#SAPCDC'],
    imageQuery: 'customer service technology',
    category: 'Customer Experience',
  },
  {
    id: '5',
    content: '⚡ Speed matters. With SAP Business Technology Platform, you can build and extend applications 10x faster than traditional methods.',
    hashtags: ['#SAPBTP', '#LowCode', '#AppDevelopment', '#Innovation'],
    imageQuery: 'software development team',
    category: 'Development',
  },
  {
    id: '6',
    content: '🔐 Security is not optional. SAP\'s enterprise-grade security features protect your most valuable asset: your data. Zero-trust architecture for the modern enterprise.',
    hashtags: ['#Cybersecurity', '#DataProtection', '#EnterpriseIT', '#SAP'],
    imageQuery: 'cybersecurity network protection',
    category: 'Security',
  },
  {
    id: '7',
    content: '📊 From spreadsheets to intelligent ERP. SAP Business One helps SMEs compete with enterprise-level capabilities without the complexity.',
    hashtags: ['#SAPBusinessOne', '#SME', '#ERP', '#SmallBusiness'],
    imageQuery: 'small business team office',
    category: 'SME Solutions',
  },
  {
    id: '8',
    content: '🤝 Integration shouldn\'t be complicated. SAP Integration Suite connects your entire landscape—cloud, on-premise, and third-party systems—seamlessly.',
    hashtags: ['#Integration', '#API', '#Middleware', '#SAPIntegration'],
    imageQuery: 'network connectivity integration',
    category: 'Integration',
  },
  {
    id: '9',
    content: '🏭 Industry 4.0 is here. SAP\'s intelligent manufacturing solutions combine IoT, AI, and analytics to optimize production and reduce downtime.',
    hashtags: ['#Industry40', '#SmartManufacturing', '#IoT', '#Manufacturing'],
    imageQuery: 'smart factory automation',
    category: 'Manufacturing',
  },
  {
    id: '10',
    content: '💼 HR transformation starts with intelligent automation. SAP SuccessFactors empowers HR teams to focus on people, not paperwork.',
    hashtags: ['#HRTech', '#SuccessFactors', '#TalentManagement', '#HR'],
    imageQuery: 'hr team collaboration',
    category: 'Human Resources',
  },
  {
    id: '11',
    content: '🛒 Retail revolution: SAP Commerce Cloud delivers omnichannel experiences that customers expect and retailers need to thrive.',
    hashtags: ['#Retail', '#Ecommerce', '#Omnichannel', '#CustomerFirst'],
    imageQuery: 'online shopping retail',
    category: 'Retail',
  },
  {
    id: '12',
    content: '💰 Financial planning made simple. SAP Analytics Cloud for Planning brings collaborative planning to every department in your organization.',
    hashtags: ['#FP&A', '#Planning', '#Finance', '#CFO'],
    imageQuery: 'financial planning analysis',
    category: 'Finance',
  },
  {
    id: '13',
    content: '🚚 Supply chain visibility is critical. SAP Integrated Business Planning provides end-to-end transparency and agility in uncertain times.',
    hashtags: ['#SupplyChain', '#IBP', '#Logistics', '#Operations'],
    imageQuery: 'supply chain logistics',
    category: 'Supply Chain',
  },
  {
    id: '14',
    content: '🎓 Continuous learning is the key to SAP success. Invest in your team with SAP Learning Hub and watch productivity soar.',
    hashtags: ['#SAPLearning', '#Training', '#SkillDevelopment', '#CareerGrowth'],
    imageQuery: 'professional training workshop',
    category: 'Training',
  },
  {
    id: '15',
    content: '🌐 Go global, stay local. SAP\'s localization capabilities support business operations in 180+ countries and 43 languages.',
    hashtags: ['#GlobalBusiness', '#Localization', '#International', '#SAP'],
    imageQuery: 'global business world map',
    category: 'Global Business',
  },
  {
    id: '16',
    content: '🔄 Business process optimization never stops. SAP Signavio helps you discover, analyze, and improve processes continuously.',
    hashtags: ['#ProcessMining', '#Signavio', '#ProcessOptimization', '#ContinuousImprovement'],
    imageQuery: 'business process workflow',
    category: 'Process Management',
  },
  {
    id: '17',
    content: '☁️ Cloud migration doesn\'t have to be risky. SAP RISE simplifies the journey to intelligent cloud ERP with proven methodologies.',
    hashtags: ['#SAPRISE', '#CloudMigration', '#S4HANACloud', '#Transformation'],
    imageQuery: 'cloud migration technology',
    category: 'Cloud Migration',
  },
  {
    id: '18',
    content: '🤖 AI is transforming business. SAP Business AI embeds intelligence directly into your processes—no data science degree required.',
    hashtags: ['#ArtificialIntelligence', '#MachineLearning', '#SAPAI', '#IntelligentEnterprise'],
    imageQuery: 'artificial intelligence technology',
    category: 'Artificial Intelligence',
  },
  {
    id: '19',
    content: '📱 Mobile-first enterprise. SAP Mobile Start puts your most important business tasks in your pocket.',
    hashtags: ['#MobileFirst', '#SAPMobile', '#Productivity', '#WorkFromAnywhere'],
    imageQuery: 'mobile business app',
    category: 'Mobile',
  },
  {
    id: '20',
    content: '🎨 User experience matters. SAP Fiori delivers a consumer-grade UX for enterprise applications—because work should be delightful.',
    hashtags: ['#SAPFIORI', '#UX', '#UserExperience', '#Design'],
    imageQuery: 'modern user interface design',
    category: 'User Experience',
  },
  {
    id: '21',
    content: '🏥 Healthcare transformation: SAP solutions help providers deliver better patient outcomes while controlling costs.',
    hashtags: ['#Healthcare', '#HealthIT', '#PatientCare', '#DigitalHealth'],
    imageQuery: 'healthcare technology hospital',
    category: 'Healthcare',
  },
  {
    id: '22',
    content: '⚙️ Maintenance that predicts problems before they happen. SAP Asset Intelligence Network keeps your operations running smoothly.',
    hashtags: ['#PredictiveMaintenance', '#AssetManagement', '#IoT', '#Operations'],
    imageQuery: 'industrial equipment maintenance',
    category: 'Asset Management',
  },
  {
    id: '23',
    content: '🌟 Partner ecosystem = competitive advantage. SAP App Center connects you with 1000s of pre-integrated solutions.',
    hashtags: ['#SAPAppCenter', '#PartnerEcosystem', '#Extensions', '#Marketplace'],
    imageQuery: 'business partnership collaboration',
    category: 'Partnership',
  },
  {
    id: '24',
    content: '📈 Revenue growth through intelligent pricing. SAP CPQ helps sales teams quote faster and win more deals.',
    hashtags: ['#CPQ', '#Sales', '#RevenueGrowth', '#SalesEnablement'],
    imageQuery: 'sales team meeting success',
    category: 'Sales',
  },
  {
    id: '25',
    content: '🔮 The future is now. SAP Business Network connects 5M+ companies globally—your next customer or supplier is already there.',
    hashtags: ['#BusinessNetwork', '#B2B', '#Procurement', '#Collaboration'],
    imageQuery: 'global business network',
    category: 'Business Network',
  },
];

export function LinkedInAIPostGenerator() {
  const [currentPost, setCurrentPost] = useState<AIPost>(AI_GENERATED_POSTS[0]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { createPost } = useLinkedInPosts();

  const generateRandomPost = () => {
    const randomIndex = Math.floor(Math.random() * AI_GENERATED_POSTS.length);
    setCurrentPost(AI_GENERATED_POSTS[randomIndex]);
    setCopied(false);
  };

  const copyToClipboard = () => {
    const fullPost = `${currentPost.content}\\n\\n${currentPost.hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullPost);
    setCopied(true);
    toast.success('Post copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const savePost = async () => {
    try {
      setSaving(true);
      const fullPost = `${currentPost.content}\\n\\n${currentPost.hashtags.join(' ')}`;
      await createPost({
        content: fullPost,
        status: 'draft',
        type: 'ai-generated',
        category: currentPost.category,
      });
      toast.success('Post saved to database!');
    } catch (error) {
      toast.error('Failed to save post');
      console.error('Error saving post:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Post Generator</h1>
        <p className="text-gray-600">Generate professional SAP-related content instantly</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{AI_GENERATED_POSTS.length}</div>
            <p className="text-sm text-gray-500 mt-1">AI-generated posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">15+</div>
            <p className="text-sm text-gray-500 mt-1">Topic categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Current Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="text-sm">{currentPost.category}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Post Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Post Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Post</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={generateRandomPost}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* LinkedIn Post Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Post Header */}
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

                {/* Post Content */}
                <div className="text-gray-800 text-sm leading-relaxed mb-3">
                  {currentPost.content}
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {currentPost.hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Image Placeholder */}
                <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Professional image: {currentPost.imageQuery}</p>
                  </div>
                </div>
              </div>

              {/* Engagement Bar */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <button className="flex items-center gap-2 hover:text-blue-600">
                    <Heart className="h-4 w-4" />
                    <span>Like</span>
                  </button>
                  <button className="flex items-center gap-2 hover:text-blue-600">
                    <MessageCircle className="h-4 w-4" />
                    <span>Comment</span>
                  </button>
                  <button className="flex items-center gap-2 hover:text-blue-600">
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button onClick={copyToClipboard} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Post
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={savePost}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Post
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: All Templates List */}
        <Card>
          <CardHeader>
            <CardTitle>All Templates ({AI_GENERATED_POSTS.length})</CardTitle>
            <CardDescription>Click any post to preview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {AI_GENERATED_POSTS.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setCurrentPost(post)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    currentPost.id === post.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {post.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {post.content.substring(0, 100)}...
                      </p>
                    </div>
                    {currentPost.id === post.id && (
                      <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}