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

// ----------------------------------------------------
// NÉO MASCOT TYPES
// ----------------------------------------------------
export type NeoEmotionState =
  | 'neo-idle'
  | 'neo-happy'
  | 'neo-thinking'
  | 'neo-encouraging'
  | 'neo-surprised'
  | 'neo-celebrating'
  | 'neo-talking'
  | 'neo-sad';

export type NeoHintLevel = 1 | 2 | 3 | 4;

export interface NeoChatMessage {
  id: string;
  sender: 'neo' | 'student';
  text: string;
  emotion?: NeoEmotionState;
  timestamp: string;
  hintLevel?: NeoHintLevel;
  suggestedFollowUps?: string[];
}

export interface NeoContextPayload {
  message?: string;
  hintLevel?: NeoHintLevel;
  actionType?: 'hint' | 'explain' | 'step_by_step' | 'chat';
  studentName: string;
  exerciseContext: {
    subject: Subject;
    skill: string;
    difficulty: Difficulty;
    question: string;
    type: QuestionType;
    options?: string[];
    userAnswer?: string;
    isCorrect?: boolean;
    correctAnswer?: string;
    explanation?: string;
  };
  studentProfile?: {
    level: string;
    recentErrors?: string[];
    skillScore?: number;
  };
  conversationHistory: Array<{ role: 'user' | 'neo'; content: string }>;
}

