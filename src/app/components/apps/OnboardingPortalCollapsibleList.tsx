import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Edit, Trash2, User, Users, CheckCircle, Circle, AlertCircle, Calendar,
  ChevronDown, ChevronUp, Shield, Key, Mail, Copy
} from 'lucide-react';

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: 'pending' | 'completed';
  dueDate?: string;
  completedDate?: string;
}

interface Onboarding {
  id: string;
  employeeName: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  manager: string;
  buddy?: string;
  status: string;
  progress: number;
  completedTasks: number;
  totalTasks: number;
  notes?: string;
  tasks: OnboardingTask[];
  portalAccessEnabled?: boolean;
  tempPassword?: string;
  accountCreatedDate?: string;
}

interface Props {
  onboardings: Onboarding[];
  canManageOnboarding: boolean;
  canDeleteOnboarding: boolean;
  onEdit: (onboarding: Onboarding) => void;
  onDelete: (id: string) => void;
  onToggleTask: (onboardingId: string, taskId: string) => void;
  onEnablePortalAccess: (onboarding: Onboarding) => void;
  getStatusColor: (status: string) => string;
  getTaskCategoryIcon: (category: string) => any;
  getPriorityColor: (priority: string) => string;
  copyToClipboard: (text: string, label: string) => void;
}

export function OnboardingCollapsibleList({
  onboardings,
  canManageOnboarding,
  canDeleteOnboarding,
  onEdit,
  onDelete,
  onToggleTask,
  onEnablePortalAccess,
  getStatusColor,
  getTaskCategoryIcon,
  getPriorityColor,
  copyToClipboard
}: Props) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-2">
      {onboardings.map(onboarding => {
        const isExpanded = expandedCards.has(onboarding.id);

        return (
          <Card key={onboarding.id} className="hover:shadow-sm transition-shadow">
            {/* Compact Header - Table Row Style */}
            <div
              onClick={() => toggleCard(onboarding.id)}
              className="cursor-pointer hover:bg-gray-50 transition-colors p-3"
            >
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Name & Position - 3 columns */}
                <div className="col-span-3 min-w-0">
                  <div className="font-semibold text-sm truncate">{onboarding.employeeName}</div>
                  <div className="text-xs text-gray-600 truncate">{onboarding.position}</div>
                </div>

                {/* Department - 2 columns */}
                <div className="col-span-2 min-w-0">
                  <Badge variant="outline" className="text-xs truncate max-w-full block">{onboarding.department}</Badge>
                </div>

                {/* Start Date - 2 columns */}
                <div className="col-span-2 text-xs text-gray-600 truncate">
                  {new Date(onboarding.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Status - 2 columns */}
                <div className="col-span-2 min-w-0">
                  <Badge className={`text-xs truncate max-w-full block ${getStatusColor(onboarding.status)}`}>
                    {onboarding.status.replace('-', ' ')}
                  </Badge>
                </div>

                {/* Progress - 2 columns */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Progress value={onboarding.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-gray-600 w-10 text-right flex-shrink-0">{onboarding.progress}%</span>
                  </div>
                </div>

                {/* Tasks Count - 1 column */}
                <div className="col-span-1 text-xs text-gray-600 text-center">
                  {onboarding.completedTasks}/{onboarding.totalTasks}
                </div>

                {/* Actions - flexible */}
                <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                  {canManageOnboarding && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(onboarding)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {canDeleteOnboarding && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(onboarding.id)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
            
            {/* Expandable Content - Only Visible When Expanded */}
            {isExpanded && (
              <CardContent className="space-y-4 border-t pt-4">
                {/* Manager and Buddy Info */}
                <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium truncate">{onboarding.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Manager:</span>
                    <span className="font-medium">{onboarding.manager}</span>
                  </div>
                  {onboarding.buddy && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Buddy:</span>
                      <span className="font-medium">{onboarding.buddy}</span>
                    </div>
                  )}
                </div>

                {/* Tasks */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Onboarding Tasks
                  </h4>
                  <div className="space-y-2">
                    {onboarding.tasks.map(task => {
                      const CategoryIcon = getTaskCategoryIcon(task.category);
                      return (
                        <div 
                          key={task.id}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <button
                            onClick={() => onToggleTask(onboarding.id, task.id)}
                            className="mt-0.5"
                          >
                            {task.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5 text-green-500 fill-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CategoryIcon className="h-4 w-4 text-gray-400" />
                              <span className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                              </span>
                              <AlertCircle className={`h-3 w-3 ${getPriorityColor(task.priority)}`} />
                            </div>
                            <p className="text-sm text-gray-600">{task.description}</p>
                            {task.dueDate && task.status !== 'completed' && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </p>
                            )}
                            {task.completedDate && (
                              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Completed: {new Date(task.completedDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {onboarding.notes && (
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-gray-700"><strong>Notes:</strong> {onboarding.notes}</p>
                  </div>
                )}

                {/* Portal Access Section */}
                {canManageOnboarding && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-gray-400" />
                        <h4 className="font-semibold">Portal Access</h4>
                      </div>
                      {onboarding.portalAccessEnabled ? (
                        <Badge className="bg-green-100 text-green-700">
                          <Key className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50">
                          <Key className="h-3 w-3 mr-1" />
                          Not Enabled
                        </Badge>
                      )}
                    </div>

                    {onboarding.portalAccessEnabled ? (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-900">Portal account created successfully</span>
                          </div>
                          <div className="pl-6 space-y-1 text-sm text-green-800">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <span className="font-mono">{onboarding.email}</span>
                              <button
                                onClick={() => copyToClipboard(onboarding.email, 'Email')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            {onboarding.tempPassword && (
                              <div className="flex items-center gap-2">
                                <Key className="h-3 w-3" />
                                <span className="font-mono">{onboarding.tempPassword}</span>
                                <button
                                  onClick={() => copyToClipboard(onboarding.tempPassword!, 'Password')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            {onboarding.accountCreatedDate && (
                              <div className="text-xs text-green-600 mt-2">
                                Created: {new Date(onboarding.accountCreatedDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {onboarding.progress === 100 ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900 mb-2">
                                  🎉 All onboarding tasks completed! Ready to enable portal access.
                                </p>
                                <Button
                                  onClick={() => onEnablePortalAccess(onboarding)}
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <Key className="h-4 w-4 mr-2" />
                                  Enable Portal Access
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-amber-900 mb-1">
                                  Portal access disabled
                                </p>
                                <p className="text-sm text-amber-800 mb-3">
                                  Complete all onboarding tasks to enable portal access. Currently at {onboarding.progress}% ({onboarding.completedTasks}/{onboarding.totalTasks} tasks completed).
                                </p>
                                <Button
                                  disabled
                                  size="sm"
                                  variant="outline"
                                  className="opacity-50 cursor-not-allowed"
                                >
                                  <Key className="h-4 w-4 mr-2" />
                                  Enable Portal Access
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}