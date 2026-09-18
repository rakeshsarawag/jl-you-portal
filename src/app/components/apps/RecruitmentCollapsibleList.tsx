import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  Edit, Trash2, ChevronDown, ChevronUp, Calendar, Star, Send
} from 'lucide-react';

interface Interview {
  id: string;
  date: string;
  interviewer: string;
  type: 'phone' | 'technical' | 'behavioral' | 'final';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no-show';
  feedback?: string;
  rating?: number;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  source: string;
  appliedDate: string;
  experience: number;
  expectedSalary?: string;
  hiringManager: string;
  interviews: Interview[];
  notes?: string;
}

interface Props {
  candidates: Candidate[];
  canUpdateCandidate: boolean;
  canDeleteCandidate: boolean;
  canScheduleInterview: boolean;
  canMakeOffer: boolean;
  onEdit: (candidate: Candidate) => void;
  onDelete: (id: string) => void;
  onScheduleInterview: (candidate: Candidate) => void;
  onMakeOffer: (id: string) => void;
  onInterviewClick: (candidate: Candidate, interview: Interview) => void;
  getStatusColor: (status: string) => string;
  getInterviewStatusColor: (status: string) => string;
  getInterviewTypeIcon: (type: string) => any;
}

export function RecruitmentCollapsibleList({
  candidates,
  canUpdateCandidate,
  canDeleteCandidate,
  canScheduleInterview,
  canMakeOffer,
  onEdit,
  onDelete,
  onScheduleInterview,
  onMakeOffer,
  onInterviewClick,
  getStatusColor,
  getInterviewStatusColor,
  getInterviewTypeIcon
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
      {candidates.map(candidate => {
        const isExpanded = expandedCards.has(candidate.id);

        return (
          <Card key={candidate.id} className="hover:shadow-sm transition-shadow">
            {/* Compact Header - Table Row Style */}
            <div
              onClick={() => toggleCard(candidate.id)}
              className="cursor-pointer hover:bg-gray-50 transition-colors p-3"
            >
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Name & Position - 3 columns */}
                <div className="col-span-3 min-w-0">
                  <div className="font-semibold text-sm truncate">{candidate.name}</div>
                  <div className="text-xs text-gray-600 truncate">{candidate.position}</div>
                </div>

                {/* Department - 2 columns */}
                <div className="col-span-2 min-w-0">
                  <Badge variant="outline" className="text-xs truncate max-w-full block">{candidate.department}</Badge>
                </div>

                {/* Applied Date - 2 columns */}
                <div className="col-span-2 text-xs text-gray-600 truncate">
                  {new Date(candidate.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Status - 2 columns */}
                <div className="col-span-2 min-w-0">
                  <Badge className={`text-xs truncate max-w-full block ${getStatusColor(candidate.status)}`}>
                    {candidate.status}
                  </Badge>
                </div>

                {/* Interviews Count - 1 column */}
                <div className="col-span-1 text-xs text-gray-600 text-center">
                  {candidate.interviews.length}
                </div>

                {/* Experience - 1 column */}
                <div className="col-span-1 text-xs text-gray-600 text-center">
                  {candidate.experience}y
                </div>

                {/* Actions - flexible */}
                <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                  {canUpdateCandidate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(candidate)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canDeleteCandidate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(candidate.id)}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
                {/* Contact & Details */}
                <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium truncate">{candidate.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">{candidate.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Hiring Manager</p>
                    <p className="font-medium">{candidate.hiringManager}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Source</p>
                    <p className="font-medium">{candidate.source}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Expected Salary</p>
                    <p className="font-medium">{candidate.expectedSalary || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Experience</p>
                    <p className="font-medium">{candidate.experience} years</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Applied Date</p>
                    <p className="font-medium">{candidate.appliedDate}</p>
                  </div>
                </div>

                {/* Interviews */}
                {candidate.interviews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Interviews ({candidate.interviews.length})
                    </h4>
                    <div className="space-y-2">
                      {candidate.interviews.map(interview => (
                        <div
                          key={interview.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                          onClick={() => onInterviewClick(candidate, interview)}
                        >
                          <div className="flex items-center gap-3">
                            {getInterviewTypeIcon(interview.type)}
                            <div>
                              <p className="text-sm font-medium capitalize">{interview.type} Interview</p>
                              <p className="text-xs text-gray-600">
                                {interview.date} • {interview.interviewer}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {interview.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm font-semibold">{interview.rating}</span>
                              </div>
                            )}
                            <Badge className={getInterviewStatusColor(interview.status)} variant="outline">
                              {interview.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {candidate.notes && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-600 font-semibold mb-1">Notes:</p>
                    <p className="text-sm text-blue-900">{candidate.notes}</p>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2 flex-wrap">
                  {canScheduleInterview && (
                    <Button
                      onClick={() => onScheduleInterview(candidate)}
                      size="sm"
                      variant="outline"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Interview
                    </Button>
                  )}

                  {canMakeOffer && candidate.status === 'interview' && (
                    <Button
                      onClick={() => onMakeOffer(candidate.id)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Make Offer
                    </Button>
                  )}

                  {canUpdateCandidate && (
                    <Button
                      onClick={() => onEdit(candidate)}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}

                  {canDeleteCandidate && (
                    <Button
                      onClick={() => onDelete(candidate.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
