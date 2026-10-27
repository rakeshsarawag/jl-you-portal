import { describe, expect, it } from 'vitest';
import {
  Course,
  Enrollment,
  dedupeTrainingEnrollments,
} from '../../../src/app/hooks/useTrainingData';

const course = (overrides: Partial<Course>): Course => ({
  id: 'course',
  title: 'Course',
  description: '',
  category: 'Compliance',
  level: 'Beginner',
  mode: 'Online',
  duration: '1 hour',
  instructor: '',
  mandatory: false,
  assessmentRequired: false,
  passingScore: 80,
  deadlineDays: 30,
  renewalMonths: 12,
  content: [],
  standardReferences: [],
  enrolledCount: 0,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const enrollment = (overrides: Partial<Enrollment>): Enrollment => ({
  id: 'enrollment',
  courseId: 'course',
  courseName: 'Course',
  employeeId: 'employee-1',
  employeeName: 'Employee',
  status: 'Not Started',
  progress: 0,
  mandatory: false,
  assessmentRequired: false,
  startDate: '',
  assessmentPassed: false,
  assessmentAttempts: 0,
  ...overrides,
});

describe('dedupeTrainingEnrollments', () => {
  it('merges legacy and canonical course titles for the same employee', () => {
    const canonical = course({
      id: 'canonical-course',
      title: 'Information Security, Phishing & Account Protection',
    });
    const result = dedupeTrainingEnrollments([
      enrollment({
        id: 'legacy-enrollment',
        courseId: 'legacy-course',
        courseName: 'Information Security Awareness',
        progress: 20,
      }),
      enrollment({
        id: 'canonical-enrollment',
        courseId: canonical.id,
        courseName: canonical.title,
        status: 'Completed',
        progress: 100,
      }),
    ], [canonical]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'canonical-enrollment',
      courseId: canonical.id,
      courseName: canonical.title,
    });
  });

  it('does not merge the same course across different employees', () => {
    const items = [
      enrollment({ id: 'first', employeeId: 'employee-1' }),
      enrollment({ id: 'second', employeeId: 'employee-2' }),
    ];

    expect(dedupeTrainingEnrollments(items)).toHaveLength(2);
  });
});
