import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  FileText,
  Megaphone,
  Calendar,
  BarChart,
  Users,
  Sparkles,
  Trophy,
  Heart,
  Zap,
  Star,
  Plus,
  Search,
  X,
  Eye,
  Edit,
  Copy,
  Check,
  MessageSquare,
  Briefcase,
  Coffee,
  Lightbulb,
  Target,
  Rocket,
  Gift,
} from 'lucide-react';
import { toast } from 'sonner';

interface ContentTemplatesProps {
  onClose?: () => void;
  onUseTemplate?: (template: Template) => void;
  embedded?: boolean;
}

interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  content: string;
  icon: any;
  variables: string[];
  tags: string[];
  usageCount: number;
  isPopular: boolean;
  isFavorite?: boolean;
}

type TemplateCategory =
  | 'announcements'
  | 'team-updates'
  | 'celebrations'
  | 'meetings'
  | 'reports'
  | 'events'
  | 'polls'
  | 'feedback'
  | 'onboarding'
  | 'misc';

export function ContentTemplates({
  onClose,
  onUseTemplate,
  embedded = false,
}: ContentTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const categories = [
    { value: 'all' as const, label: 'All Templates', icon: Sparkles, count: 24 },
    { value: 'announcements' as const, label: 'Announcements', icon: Megaphone, count: 5 },
    { value: 'team-updates' as const, label: 'Team Updates', icon: Users, count: 4 },
    { value: 'celebrations' as const, label: 'Celebrations', icon: Trophy, count: 3 },
    { value: 'meetings' as const, label: 'Meeting Notes', icon: MessageSquare, count: 3 },
    { value: 'reports' as const, label: 'Reports', icon: BarChart, count: 3 },
    { value: 'events' as const, label: 'Events', icon: Calendar, count: 2 },
    { value: 'polls' as const, label: 'Polls & Surveys', icon: BarChart, count: 2 },
    { value: 'feedback' as const, label: 'Feedback', icon: Heart, count: 1 },
    { value: 'onboarding' as const, label: 'Onboarding', icon: Star, count: 1 },
  ];

  const templates: Template[] = [
    {
      id: 'tpl_1',
      name: 'Weekly Team Update',
      category: 'team-updates',
      description: 'Share weekly accomplishments and upcoming goals',
      content: `📅 Week of {WEEK_DATE}

🎯 **This Week's Wins:**
• {ACCOMPLISHMENT_1}
• {ACCOMPLISHMENT_2}
• {ACCOMPLISHMENT_3}

🚀 **Next Week's Focus:**
• {GOAL_1}
• {GOAL_2}

💡 **Blockers/Help Needed:**
{BLOCKERS}

#team-update #weekly`,
      icon: Users,
      variables: ['WEEK_DATE', 'ACCOMPLISHMENT_1', 'ACCOMPLISHMENT_2', 'ACCOMPLISHMENT_3', 'GOAL_1', 'GOAL_2', 'BLOCKERS'],
      tags: ['weekly', 'team', 'update'],
      usageCount: 247,
      isPopular: true,
    },
    {
      id: 'tpl_2',
      name: 'Product Launch Announcement',
      category: 'announcements',
      description: 'Announce new product or feature launches',
      content: `🚀 **Exciting News: {PRODUCT_NAME} is LIVE!**

We're thrilled to announce that {PRODUCT_NAME} is now available to all users!

✨ **What's New:**
• {FEATURE_1}
• {FEATURE_2}
• {FEATURE_3}

🎯 **Why This Matters:**
{IMPACT_DESCRIPTION}

📚 **Learn More:**
{DOCUMENTATION_LINK}

Huge thanks to {TEAM_NAMES} for making this happen! 🙌

#product-launch #announcement`,
      icon: Rocket,
      variables: ['PRODUCT_NAME', 'FEATURE_1', 'FEATURE_2', 'FEATURE_3', 'IMPACT_DESCRIPTION', 'DOCUMENTATION_LINK', 'TEAM_NAMES'],
      tags: ['announcement', 'launch', 'product'],
      usageCount: 189,
      isPopular: true,
    },
    {
      id: 'tpl_3',
      name: 'Celebration & Recognition',
      category: 'celebrations',
      description: 'Celebrate team achievements and milestones',
      content: `🎉 **Congratulations {PERSON_NAME}!**

Today we celebrate {ACHIEVEMENT_DESCRIPTION}!

🌟 **Why We're Celebrating:**
{REASON_DETAILS}

💪 **Impact:**
{IMPACT_ON_TEAM}

Let's all join in congratulating {PERSON_NAME} for this amazing achievement! 🎊

#celebration #team-win #recognition`,
      icon: Trophy,
      variables: ['PERSON_NAME', 'ACHIEVEMENT_DESCRIPTION', 'REASON_DETAILS', 'IMPACT_ON_TEAM'],
      tags: ['celebration', 'recognition', 'milestone'],
      usageCount: 156,
      isPopular: true,
    },
    {
      id: 'tpl_4',
      name: 'Meeting Summary',
      category: 'meetings',
      description: 'Document meeting notes and action items',
      content: `📝 **Meeting Summary: {MEETING_TITLE}**

📅 Date: {DATE}
👥 Attendees: {ATTENDEES}

**Key Discussion Points:**
• {POINT_1}
• {POINT_2}
• {POINT_3}

**Decisions Made:**
• {DECISION_1}
• {DECISION_2}

**Action Items:**
• {ACTION_1} - @{OWNER_1} - Due: {DUE_DATE_1}
• {ACTION_2} - @{OWNER_2} - Due: {DUE_DATE_2}

**Next Meeting:** {NEXT_MEETING_DATE}

#meeting-notes`,
      icon: MessageSquare,
      variables: ['MEETING_TITLE', 'DATE', 'ATTENDEES', 'POINT_1', 'POINT_2', 'POINT_3', 'DECISION_1', 'DECISION_2', 'ACTION_1', 'OWNER_1', 'DUE_DATE_1', 'ACTION_2', 'OWNER_2', 'DUE_DATE_2', 'NEXT_MEETING_DATE'],
      tags: ['meeting', 'notes', 'action-items'],
      usageCount: 324,
      isPopular: true,
    },
    {
      id: 'tpl_5',
      name: 'Project Status Report',
      category: 'reports',
      description: 'Regular project status updates',
      content: `📊 **{PROJECT_NAME} - Status Update**

**Overall Status:** {STATUS_EMOJI} {STATUS_TEXT}

**Progress:**
{PROGRESS_BAR} {COMPLETION_PERCENTAGE}% Complete

**Completed This Period:**
✅ {COMPLETED_1}
✅ {COMPLETED_2}

**In Progress:**
🔄 {IN_PROGRESS_1}
🔄 {IN_PROGRESS_2}

**Upcoming:**
📋 {UPCOMING_1}
📋 {UPCOMING_2}

**Risks/Issues:**
{RISKS_DESCRIPTION}

**Next Steps:**
{NEXT_STEPS}

#project-update #status-report`,
      icon: BarChart,
      variables: ['PROJECT_NAME', 'STATUS_EMOJI', 'STATUS_TEXT', 'PROGRESS_BAR', 'COMPLETION_PERCENTAGE', 'COMPLETED_1', 'COMPLETED_2', 'IN_PROGRESS_1', 'IN_PROGRESS_2', 'UPCOMING_1', 'UPCOMING_2', 'RISKS_DESCRIPTION', 'NEXT_STEPS'],
      tags: ['project', 'status', 'report'],
      usageCount: 198,
      isPopular: false,
    },
    {
      id: 'tpl_6',
      name: 'Event Invitation',
      category: 'events',
      description: 'Invite team to company events',
      content: `🎊 **You're Invited: {EVENT_NAME}!**

Join us for {EVENT_DESCRIPTION}

📅 **When:** {DATE_TIME}
📍 **Where:** {LOCATION}
🎯 **What:** {AGENDA}

**Why You Should Attend:**
• {BENEFIT_1}
• {BENEFIT_2}
• {BENEFIT_3}

**RSVP:** {RSVP_LINK}
**Questions:** Contact {ORGANIZER_NAME}

Looking forward to seeing you there! 🎉

#event #invitation`,
      icon: Calendar,
      variables: ['EVENT_NAME', 'EVENT_DESCRIPTION', 'DATE_TIME', 'LOCATION', 'AGENDA', 'BENEFIT_1', 'BENEFIT_2', 'BENEFIT_3', 'RSVP_LINK', 'ORGANIZER_NAME'],
      tags: ['event', 'invitation', 'team'],
      usageCount: 142,
      isPopular: false,
    },
    {
      id: 'tpl_7',
      name: 'New Employee Welcome',
      category: 'onboarding',
      description: 'Welcome new team members',
      content: `👋 **Welcome {NEW_EMPLOYEE_NAME}!**

We're excited to have {NEW_EMPLOYEE_NAME} joining our team as {POSITION}!

**A Bit About {NEW_EMPLOYEE_NAME}:**
{BIO_DESCRIPTION}

**Fun Facts:**
• {FUN_FACT_1}
• {FUN_FACT_2}

**Starting:** {START_DATE}
**Team:** {TEAM_NAME}
**Manager:** {MANAGER_NAME}

Please join us in welcoming {NEW_EMPLOYEE_NAME} to the team! 🎉

#new-hire #welcome #onboarding`,
      icon: Star,
      variables: ['NEW_EMPLOYEE_NAME', 'POSITION', 'BIO_DESCRIPTION', 'FUN_FACT_1', 'FUN_FACT_2', 'START_DATE', 'TEAM_NAME', 'MANAGER_NAME'],
      tags: ['onboarding', 'welcome', 'new-hire'],
      usageCount: 87,
      isPopular: false,
    },
    {
      id: 'tpl_8',
      name: 'Feedback Request',
      category: 'feedback',
      description: 'Gather team feedback on initiatives',
      content: `💭 **We Want Your Feedback!**

We're working on {INITIATIVE_NAME} and need your input!

**What We're Asking:**
{FEEDBACK_REQUEST}

**Why Your Feedback Matters:**
{IMPORTANCE_DESCRIPTION}

**How to Share:**
{FEEDBACK_METHOD}

**Deadline:** {DEADLINE_DATE}

Your voice helps us build better solutions. Thank you! 🙏

#feedback #input-needed`,
      icon: Heart,
      variables: ['INITIATIVE_NAME', 'FEEDBACK_REQUEST', 'IMPORTANCE_DESCRIPTION', 'FEEDBACK_METHOD', 'DEADLINE_DATE'],
      tags: ['feedback', 'survey', 'input'],
      usageCount: 73,
      isPopular: false,
    },
  ];

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = (template: Template) => {
    if (onUseTemplate) {
      onUseTemplate(template);
    }
    toast.success(`Template "${template.name}" ready to use!`);
    if (!embedded) {
      onClose?.();
    }
  };

  const handleCopyTemplate = (template: Template) => {
    navigator.clipboard.writeText(template.content);
    toast.success('Template copied to clipboard!');
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Content Templates</h2>
            <p className="text-sm text-gray-600">
              Pre-built templates for faster content creation
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.value;
          return (
            <Button
              key={category.value}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.value)}
              className={isSelected ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {category.label}
              <Badge className="ml-2 bg-white/20">{category.count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-all cursor-pointer group"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <p className="text-xs text-gray-600 mt-1">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  {template.isPopular && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
                      <Zap className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>

                {/* Usage Count */}
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
                  <Users className="h-3 w-3" />
                  <span>Used {template.usageCount} times</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowPreview(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card className="bg-gray-50">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold text-gray-900 mb-2">No templates found</h3>
            <p className="text-sm text-gray-600">
              Try adjusting your search or category filter
            </p>
          </CardContent>
        </Card>
      )}

      {/* Template Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Template Preview</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {/* Template Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-1">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                </div>

                {/* Variables */}
                <div>
                  <Label className="mb-2 block">Variables to Replace:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="font-mono text-xs">
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <Label className="mb-2 block">Template Content:</Label>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {selectedTemplate.content}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => {
                      handleUseTemplate(selectedTemplate);
                      setShowPreview(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Use This Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyTemplate(selectedTemplate)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {content}
        </div>
      </Card>
    </div>
  );
}

export default ContentTemplates;
