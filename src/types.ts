export type Role = 'student' | 'teacher';

export type Subject = 'Mathématiques' | 'Français';

export type Difficulty = 'facile' | 'moyen' | 'difficile';

export type QuestionType = 'qcm' | 'numeric' | 'boolean' | 'text';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  classId: string;
  className?: string;
  createdAt: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  averageSuccessRate?: number;
  totalExercisesCompleted?: number;
  createdAt: string;
}

export interface ExerciseItem {
  id: string;
  studentId?: string; // If personalized for a specific student, or 'all'
  subject: Subject;
  skill: string;
  difficulty: Difficulty;
  question: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  assignedBy?: string;
  createdAt?: string;
}

export interface Attempt {
  id: string;
  exerciseId: string;
  studentId: string;
  studentName: string;
  subject: Subject;
  skill: string;
  difficulty?: Difficulty;
  question: string;
  answer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number; // 0 or 100
  timeSpent?: number; // seconds
  explanation: string;
  createdAt: string;
}

export interface StudentProgress {
  id: string;
  studentId: string;
  subject: Subject;
  skill: string;
  score: number; // 0 to 100 %
  totalAttempts: number;
  correctAttempts: number;
  level: Difficulty;
  updatedAt: string;
}

export interface TeacherReport {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  summary: string;
  masteredPoints: string[];
  difficulties: string[];
  frequentErrors: string[];
  recommendations: string[];
  nextSteps: string[];
  createdAt: string;
}

export interface StudentOverview {
  user: UserProfile;
  overallScore: number;
  totalExercises: number;
  skills: { [skill: string]: number };
  weakSkills: string[];
  strongSkills: string[];
  recentAttempts: Attempt[];
  recentErrors: Attempt[];
}
