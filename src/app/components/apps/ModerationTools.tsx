import { useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Shield,
  Flag,
  Eye,
  EyeOff,
  Archive,
  Ban,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  User,
  MessageSquare,
  TrendingUp,
  FileText,
  Search,
  Filter,
  MoreHorizontal,
  ThumbsDown,
  Trash2,
  RefreshCw,
  Bell,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

interface ModerationToolsProps {
  contentId: string;
  contentType: 'post' | 'comment' | 'announcement';
  contentAuthor: string;
  onClose: () => void;
  isModerator?: boolean;
}

interface Report {
  id: string;
  reportedBy: {
    id: string;
    name: string;
    avatar: string;
  };
  reason: ReportReason;
  customReason?: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

type ReportReason = 
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'misinformation'
  | 'offensive'
  | 'copyright'
  | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; description: string; icon: any }[] = [
  {
    value: 'spam',
    label: 'Spam',
    description: 'Unwanted or repetitive content',
    icon: AlertTriangle,
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Bullying, threats, or abusive behavior',
    icon: Ban,
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Offensive or NSFW material',
    icon: EyeOff,
  },
  {
    value: 'misinformation',
    label: 'Misinformation',
    description: 'False or misleading information',
    icon: AlertTriangle,
  },
  {
    value: 'offensive',
    label: 'Offensive Language',
    description: 'Hate speech or discriminatory content',
    icon: Flag,
  },
  {
    value: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted material',
    icon: FileText,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Different reason (please specify)',
    icon: MoreHorizontal,
  },
];

export function ModerationTools({
  contentId,
  contentType,
  contentAuthor,
  onClose,
  isModerator = false,
}: ModerationToolsProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);

  // Mock reports data
  const [reports] = useState<Report[]>([
    {
      id: 'rep_1',
      reportedBy: { id: 'user_020', name: 'John Doe', avatar: 'JD' },
      reason: 'spam',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: 'rep_2',
      reportedBy: { id: 'user_021', name: 'Jane Smith', avatar: 'JS' },
      reason: 'inappropriate',
      customReason: 'Contains unprofessional language',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    },
  ]);

  const handleReport = () => {
    if (!selectedReason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please provide details for your report');
      return;
    }

    // In production, this would call an API
    console.log('Report submitted:', {
      contentId,
      contentType,
      reason: selectedReason,
      customReason: customReason || undefined,
    });

    toast.success('Content reported successfully. Our team will review it.');
    onClose();
  };

  const handleModeratorAction = (action: string) => {
    // In production, this would call an API
    console.log('Moderator action:', action, contentId);

    const messages: Record<string, string> = {
      hide: 'Content hidden from feed',
      archive: 'Content archived',
      delete: 'Content deleted',
      warn: 'Warning sent to author',
      ban: 'User banned',
      dismiss: 'Report dismissed',
    };

    toast.success(messages[action] || 'Action completed');
    onClose();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);
    
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                isModerator 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600' 
                  : 'bg-gradient-to-r from-orange-500 to-red-500'
              }`}>
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>
                  {isModerator ? 'Moderation Panel' : 'Report Content'}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {isModerator 
                    ? 'Review and take action on this content' 
                    : 'Help us maintain a safe and respectful community'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {isModerator ? (
            <Tabs defaultValue="actions">
              <TabsList className="w-full">
                <TabsTrigger value="actions">Moderator Actions</TabsTrigger>
                <TabsTrigger value="reports">
                  Reports ({reports.length})
                </TabsTrigger>
                <TabsTrigger value="history">Action History</TabsTrigger>
              </TabsList>

              {/* Moderator Actions Tab */}
              <TabsContent value="actions" className="space-y-4 mt-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">Content Information</h4>
                      <p className="text-sm text-blue-800">
                        Type: <span className="font-medium">{contentType}</span> • 
                        Author: <span className="font-medium">{contentAuthor}</span> • 
                        ID: <span className="font-mono text-xs">{contentId}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Quick Actions */}
                  <Card className="hover:border-orange-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <Button
                        variant="outline"
                        className="w-full h-auto flex-col gap-2 py-4"
                        onClick={() => handleModeratorAction('hide')}
                      >
                        <EyeOff className="h-6 w-6 text-orange-600" />
                        <span className="font-semibold">Hide Content</span>
                        <span className="text-xs text-gray-600">Remove from public feed</span>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:border-blue-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <Button
                        variant="outline"
                        className="w-full h-auto flex-col gap-2 py-4"
                        onClick={() => handleModeratorAction('archive')}
                      >
                        <Archive className="h-6 w-6 text-blue-600" />
                        <span className="font-semibold">Archive</span>
                        <span className="text-xs text-gray-600">Move to archives</span>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:border-yellow-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <Button
                        variant="outline"
                        className="w-full h-auto flex-col gap-2 py-4"
                        onClick={() => handleModeratorAction('warn')}
                      >
                        <AlertTriangle className="h-6 w-6 text-yellow-600" />
                        <span className="font-semibold">Send Warning</span>
                        <span className="text-xs text-gray-600">Notify author</span>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:border-red-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <Button
                        variant="outline"
                        className="w-full h-auto flex-col gap-2 py-4"
                        onClick={() => setConfirmState({ title: 'Delete Content', message: 'Are you sure you want to delete this content? This action cannot be undone.', danger: true, action: () => { setConfirmState(null); handleModeratorAction('delete'); } })}
                      >
                        <Trash2 className="h-6 w-6 text-red-600" />
                        <span className="font-semibold">Delete</span>
                        <span className="text-xs text-gray-600">Permanently remove</span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Advanced Actions */}
                <div className="border-t pt-4 mt-6">
                  <h4 className="font-semibold mb-4">Advanced Moderator Actions</h4>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleModeratorAction('ban')}
                    >
                      <Ban className="h-4 w-4 mr-3 text-red-600" />
                      Ban User
                      <Badge className="ml-auto bg-red-500">High Risk</Badge>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleModeratorAction('dismiss')}
                    >
                      <CheckCircle className="h-4 w-4 mr-3 text-green-600" />
                      Dismiss All Reports
                      <Badge className="ml-auto bg-green-500">Safe</Badge>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-3 text-gray-600" />
                      Configure Auto-Moderation Rules
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-4 mt-6">
                {reports.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Flag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No reports for this content</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <Card key={report.id} className={`${
                        report.status === 'pending' ? 'border-2 border-yellow-200' : ''
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {report.reportedBy.avatar}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <span className="font-semibold">{report.reportedBy.name}</span>
                                  <span className="text-gray-600 text-sm ml-2">
                                    {formatTimestamp(report.timestamp)}
                                  </span>
                                </div>
                                <Badge className={`${
                                  report.status === 'pending' 
                                    ? 'bg-yellow-500' 
                                    : report.status === 'resolved'
                                    ? 'bg-green-500'
                                    : 'bg-gray-500'
                                }`}>
                                  {report.status}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 mb-2">
                                {REPORT_REASONS.find(r => r.value === report.reason)?.icon &&
                                  React.createElement(
                                    REPORT_REASONS.find(r => r.value === report.reason)!.icon,
                                    { className: 'h-4 w-4 text-red-600' }
                                  )
                                }
                                <span className="font-medium">
                                  {REPORT_REASONS.find(r => r.value === report.reason)?.label}
                                </span>
                              </div>

                              {report.customReason && (
                                <p className="text-sm text-gray-700 bg-gray-100 rounded p-2">
                                  {report.customReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-6">
                <div className="text-center py-12 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No moderation actions recorded yet</p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            /* Regular User Report Form */
            <div className="space-y-6">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 mb-1">Before You Report</h4>
                    <p className="text-sm text-orange-800">
                      Please ensure this content violates our community guidelines. 
                      False reports may result in account restrictions.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Why are you reporting this {contentType}?
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {REPORT_REASONS.map((reason) => (
                    <Card
                      key={reason.value}
                      className={`cursor-pointer transition-all ${
                        selectedReason === reason.value
                          ? 'border-2 border-red-500 bg-red-50'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => setSelectedReason(reason.value)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            selectedReason === reason.value
                              ? 'bg-red-200'
                              : 'bg-gray-100'
                          }`}>
                            <reason.icon className={`h-5 w-5 ${
                              selectedReason === reason.value
                                ? 'text-red-700'
                                : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">{reason.label}</h4>
                            <p className="text-sm text-gray-600">{reason.description}</p>
                          </div>
                          {selectedReason === reason.value && (
                            <CheckCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {selectedReason === 'other' && (
                <div>
                  <Label className="mb-2">Please provide details</Label>
                  <Textarea
                    placeholder="Explain why you're reporting this content..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReport}
                  disabled={!selectedReason}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Submit Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

export default ModerationTools;
