import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AppLayout } from '../apps/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { AIInsightsEngine, AIInsight, PredictionResult, PatternRecognition } from '../../services/aiInsightsEngine';
import { SmartRecommendations, SmartRecommendation } from '../../services/smartRecommendations';
import { AIAssistant, ChatMessage } from '../../services/aiAssistant';
import {
  Brain,
  Sparkles,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ArrowRight,
  Target,
  Zap,
  BarChart3,
  Clock,
  DollarSign,
  Users,
  Award,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { t } from '../../../i18n';

interface AIIntelligenceDashboardProps {
  accessToken: string;
  onLogout: () => void;
}

export function AIIntelligenceDashboard({ accessToken, onLogout }: AIIntelligenceDashboardProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [patterns, setPatterns] = useState<PatternRecognition[]>([]);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);

  useEffect(() => {
    loadData();
    initializeAI();
  }, []);

  const loadData = () => {
    setInsights(AIInsightsEngine.getAllInsights());
    setPredictions(AIInsightsEngine.getAllPredictions());
    setPatterns(AIInsightsEngine.getAllPatterns());
    setRecommendations(SmartRecommendations.getAllRecommendations());
    setChatMessages(AIAssistant.getConversation());
    setStats({
      insights: AIInsightsEngine.getStatistics(),
      recommendations: SmartRecommendations.getStatistics()
    });
  };

  const initializeAI = () => {
    // Generate insights from existing data
    const contextData = {
      employees: JSON.parse(localStorage.getItem('employees') || '[]'),
      candidates: JSON.parse(localStorage.getItem('candidates') || '[]'),
      invoices: JSON.parse(localStorage.getItem('invoices') || '[]'),
      performance: JSON.parse(localStorage.getItem('performance') || '[]')
    };

    AIInsightsEngine.generateInsights(contextData);
    AIInsightsEngine.generatePredictions({
      revenue: [350000, 380000, 420000, 450000],
      headcount: [38, 42, 45, 47]
    });
    AIInsightsEngine.detectPatterns([]);

    SmartRecommendations.generateRecommendations({
      departments: [
        { name: 'Engineering', employeeCount: 15, optimalSize: 22 },
        { name: 'Sales', employeeCount: 12, optimalSize: 12 }
      ],
      performance: contextData.performance,
      employees: contextData.employees
    });

    loadData();
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    setIsProcessing(true);
    try {
      const response = await AIAssistant.processMessage(chatInput);
      setChatInput('');
      setChatMessages(AIAssistant.getConversation());

      // If response has navigation action, could auto-navigate
      if (response.actions && response.actions.length > 0) {
        // User can click action buttons
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast.error(t('aiDashboard.toastFailedToProcess'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionClick = (action: any) => {
    if (action.type === 'navigate') {
      navigate(action.target);
    } else if (action.type === 'execute') {
      toast.info(`${t('aiDashboard.executing')}: ${action.label}`);
    }
  };

  const handleDismissInsight = (insightId: string) => {
    AIInsightsEngine.dismissInsight(insightId);
    toast.success(t('aiDashboard.toastInsightDismissed'));
    loadData();
  };

  const handleAcceptRecommendation = (recId: string) => {
    SmartRecommendations.acceptRecommendation(recId);
    toast.success(t('aiDashboard.toastRecommendationAccepted'));
    loadData();
  };

  const handleDismissRecommendation = (recId: string) => {
    SmartRecommendations.dismissRecommendation(recId);
    toast.success(t('aiDashboard.toastRecommendationDismissed'));
    loadData();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return AlertTriangle;
      case 'recommendation': return Lightbulb;
      case 'prediction': return TrendingUp;
      case 'anomaly': return Activity;
      case 'trend': return BarChart3;
      default: return Brain;
    }
  };

  return (
    <AppLayout
      title={t('aiDashboard.title')}
      icon={<Brain className="h-6 w-6" />}
      onLogout={onLogout}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-600" />
              {t('aiDashboard.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('aiDashboard.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => {
              initializeAI();
              toast.success(t('aiDashboard.toastAnalysisRefreshed'));
            }}>
              <Sparkles className="h-4 w-4 mr-2" />
              {t('aiDashboard.refreshAnalysis')}
            </Button>
            <Button onClick={() => navigate('/')}>
              {t('aiDashboard.backToLaunchpad')}
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('aiDashboard.statActiveInsights')}</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.insights?.total || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('aiDashboard.statRecommendations')}</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.recommendations?.active || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Lightbulb className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('aiDashboard.statPredictions')}</p>
                    <p className="text-3xl font-bold text-green-600">{predictions.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('aiDashboard.statPatternsDetected')}</p>
                    <p className="text-3xl font-bold text-orange-600">{patterns.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Activity className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="insights">
              <Brain className="h-4 w-4 mr-2" />
              {t('aiDashboard.tabInsights')} ({insights.length})
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              <Lightbulb className="h-4 w-4 mr-2" />
              {t('aiDashboard.tabRecommendations')} ({recommendations.length})
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <TrendingUp className="h-4 w-4 mr-2" />
              {t('aiDashboard.tabPredictions')} ({predictions.length})
            </TabsTrigger>
            <TabsTrigger value="patterns">
              <Activity className="h-4 w-4 mr-2" />
              {t('aiDashboard.tabPatterns')} ({patterns.length})
            </TabsTrigger>
            <TabsTrigger value="assistant">
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('aiDashboard.tabAssistant')}
            </TabsTrigger>
          </TabsList>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="space-y-4 mt-6">
            {insights.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Brain className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">{t('aiDashboard.noInsights')}</p>
                  <p className="text-sm">{t('aiDashboard.noInsightsHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {insights.map((insight, index) => {
                  const TypeIcon = getTypeIcon(insight.type);

                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${getPriorityColor(insight.priority)} flex items-center justify-center`}>
                                  <TypeIcon className="h-5 w-5 text-white" />
                                </div>
                                {insight.title}
                                <Badge variant={insight.priority === 'critical' ? 'destructive' : 'default'}>
                                  {insight.priority}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {insight.type}
                                </Badge>
                              </CardTitle>
                              <CardDescription className="mt-2">{insight.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">{t('aiDashboard.insightRecommendationLabel')}</p>
                                <p className="text-sm text-gray-600">{insight.recommendation}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">{t('aiDashboard.insightExpectedImpactLabel')}</p>
                                <p className="text-sm text-gray-600">{insight.impact}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                <span>{t('aiDashboard.confidenceLabel')}: {insight.confidence}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                              </div>
                              {insight.affectedEntities && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  <span>{insight.affectedEntities.length} {t('aiDashboard.affectedLabel')}</span>
                                </div>
                              )}
                            </div>

                            {insight.actions && insight.actions.length > 0 && (
                              <div className="flex gap-2 pt-3 border-t">
                                {insight.actions.map(action => (
                                  <Button
                                    key={action.id}
                                    size="sm"
                                    onClick={() => handleActionClick(action)}
                                  >
                                    {action.label}
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                ))}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDismissInsight(insight.id)}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {t('aiDashboard.dismiss')}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* RECOMMENDATIONS TAB */}
          <TabsContent value="recommendations" className="space-y-4 mt-6">
            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Lightbulb className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">{t('aiDashboard.noRecommendations')}</p>
                  <p className="text-sm">{t('aiDashboard.noRecommendationsHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          <Lightbulb className="h-6 w-6 text-blue-500" />
                          {rec.title}
                          <Badge className={getPriorityColor(rec.priority)}>
                            {rec.priority} {t('aiDashboard.prioritySuffix')}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{rec.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('aiDashboard.rationaleLabel')}</p>
                            <p className="text-sm text-gray-600">{rec.rationale}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-green-50 rounded-lg">
                              <p className="text-xs font-medium text-green-700 mb-1">{t('aiDashboard.expectedImpact')}</p>
                              <p className="text-sm text-green-900">{rec.expectedImpact}</p>
                            </div>
                            {rec.estimatedROI && (
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs font-medium text-blue-700 mb-1">{t('aiDashboard.estimatedRoi')}</p>
                                <p className="text-sm text-blue-900">{rec.estimatedROI}</p>
                              </div>
                            )}
                            {rec.timeToImplement && (
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <p className="text-xs font-medium text-purple-700 mb-1">{t('aiDashboard.timeToImplement')}</p>
                                <p className="text-sm text-purple-900">{rec.timeToImplement}</p>
                              </div>
                            )}
                          </div>

                          {rec.steps && rec.steps.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">{t('aiDashboard.implementationSteps')}</p>
                              <ul className="space-y-1">
                                {rec.steps.map((step, idx) => (
                                  <li key={idx} className="text-sm text-gray-600">{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center gap-4 pt-3 border-t">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Target className="h-4 w-4" />
                              <span>{t('aiDashboard.confidenceLabel')}: {rec.confidence}%</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={() => handleAcceptRecommendation(rec.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t('aiDashboard.accept')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDismissRecommendation(rec.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {t('aiDashboard.dismiss')}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PREDICTIONS TAB */}
          <TabsContent value="predictions" className="space-y-4 mt-6">
            {predictions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">{t('aiDashboard.noPredictions')}</p>
                  <p className="text-sm">{t('aiDashboard.noPredictionsHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictions.map((pred, index) => (
                  <motion.div
                    key={pred.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          <TrendingUp className={`h-6 w-6 ${
                            pred.trend === 'up' ? 'text-green-500' :
                            pred.trend === 'down' ? 'text-red-500' :
                            'text-gray-500'
                          }`} />
                          {pred.metric} {t('aiDashboard.forecast')}
                        </CardTitle>
                        <CardDescription>{pred.timeframe}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-xs font-medium text-gray-600 mb-1">{t('aiDashboard.currentValue')}</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {pred.metric.includes('Revenue') || pred.metric.includes('$')
                                  ? `$${pred.currentValue.toLocaleString()}`
                                  : pred.currentValue}
                              </p>
                            </div>
                            <div className={`p-4 rounded-lg ${
                              pred.trend === 'up' ? 'bg-green-50' :
                              pred.trend === 'down' ? 'bg-red-50' :
                              'bg-gray-50'
                            }`}>
                              <p className="text-xs font-medium text-gray-600 mb-1">{t('aiDashboard.predictedValue')}</p>
                              <p className={`text-2xl font-bold ${
                                pred.trend === 'up' ? 'text-green-600' :
                                pred.trend === 'down' ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {pred.metric.includes('Revenue') || pred.metric.includes('$')
                                  ? `$${pred.predictedValue.toLocaleString()}`
                                  : pred.predictedValue}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('aiDashboard.keyFactors')}</p>
                            <ul className="space-y-1">
                              {pred.factors.map((factor, idx) => (
                                <li key={idx} className="text-sm text-gray-600">• {factor}</li>
                              ))}
                            </ul>
                          </div>

                          {pred.recommendations && pred.recommendations.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">{t('aiDashboard.recommendationsLabel')}</p>
                              <ul className="space-y-1">
                                {pred.recommendations.map((rec, idx) => (
                                  <li key={idx} className="text-sm text-gray-600">• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm text-gray-600 pt-3 border-t">
                            <Target className="h-4 w-4" />
                            <span>{t('aiDashboard.confidenceLabel')}: {pred.confidence}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PATTERNS TAB */}
          <TabsContent value="patterns" className="space-y-4 mt-6">
            {patterns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Activity className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">{t('aiDashboard.noPatterns')}</p>
                  <p className="text-sm">{t('aiDashboard.noPatternsHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {patterns.map((pattern, index) => (
                  <motion.div
                    key={pattern.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          <Activity className="h-6 w-6 text-orange-500" />
                          {pattern.pattern}
                          <Badge variant={
                            pattern.significance === 'high' ? 'destructive' :
                            pattern.significance === 'medium' ? 'default' :
                            'outline'
                          }>
                            {pattern.significance} {t('aiDashboard.significanceSuffix')}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{pattern.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <BarChart3 className="h-4 w-4" />
                              <span>{t('aiDashboard.frequencyPrefix')}: {pattern.frequency} {t('aiDashboard.occurrencesSuffix')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{new Date(pattern.detectedAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {pattern.examples.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">{t('aiDashboard.examples')}</p>
                              <div className="flex flex-wrap gap-2">
                                {pattern.examples.map((example, idx) => (
                                  <Badge key={idx} variant="outline">{example}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-700 mb-1">{t('aiDashboard.suggestedAction')}</p>
                            <p className="text-sm text-blue-900">{pattern.suggestedAction}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* AI ASSISTANT TAB */}
          <TabsContent value="assistant" className="mt-6">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <MessageSquare className="h-6 w-6 text-purple-500" />
                  {t('aiDashboard.assistantTitle')}
                </CardTitle>
                <CardDescription>
                  {t('aiDashboard.assistantDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">{t('aiDashboard.startConversation')}</p>
                      <p className="text-sm">{t('aiDashboard.tryAsking')}</p>
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {AIAssistant.getContextualSuggestions().map((suggestion, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setChatInput(suggestion);
                              handleSendMessage();
                            }}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === 'user'
                            ? 'bg-purple-500 text-white'
                            : 'bg-white border shadow-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-line">{msg.content}</p>

                          {msg.actions && msg.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                              {msg.actions.map(action => (
                                <Button
                                  key={action.id}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleActionClick(action)}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('aiDashboard.chatPlaceholder')}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isProcessing}
                  />
                  <Button onClick={handleSendMessage} disabled={isProcessing || !chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
