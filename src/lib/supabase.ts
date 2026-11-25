import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  ExerciseItem,
  Attempt,
  StudentProgress,
  TeacherReport,
  Difficulty,
  Subject,
} from '../types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseProjectRef = (() => {
  try {
    if (!supabaseUrl) return '';
    return new URL(supabaseUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
})();

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Returns HTTP headers including the active Supabase Auth JWT Bearer token
 * for authenticated calls to the Express backend (/api/*).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No active session
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Row mappers: PostgreSQL snake_case -> TypeScript camelCase
// ---------------------------------------------------------------------------

export function mapUserRow(row: any): UserProfile {
  return {
    id: row.id,
    firstName: row.first_name ?? row.firstName ?? '',
    lastName: row.last_name ?? row.lastName ?? '',
    email: row.email ?? '',
    role: row.role === 'teacher' ? 'teacher' : 'student',
    classId: row.class_id ?? row.classId ?? 'class-cm2',
    className: row.class_name ?? row.className ?? 'CM2',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

export function mapExerciseRow(row: any): ExerciseItem {
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId ?? 'all',
    subject: (row.subject as Subject) || 'Mathématiques',
    skill: row.skill ?? '',
    difficulty: (row.difficulty as Difficulty) || 'moyen',
    question: row.question ?? '',
    type: (row.type as ExerciseItem['type']) || 'qcm',
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer ?? row.correctAnswer ?? '',
    explanation: row.explanation ?? '',
    assignedBy: row.assigned_by ?? row.assignedBy ?? undefined,
  };
}

export function mapAttemptRow(row: any): Attempt {
  return {
    id: row.id,
    exerciseId: row.exercise_id ?? row.exerciseId ?? '',
    studentId: row.student_id ?? row.studentId ?? '',
    studentName: row.student_name ?? row.studentName ?? '',
    subject: (row.subject as Subject) || 'Mathématiques',
    skill: row.skill ?? '',
    difficulty: (row.difficulty as Difficulty) || 'moyen',
    question: row.question ?? '',
    answer: row.answer ?? '',
    correctAnswer: row.correct_answer ?? row.correctAnswer ?? '',
    isCorrect: Boolean(row.is_correct ?? row.isCorrect),
    score: Number(row.score ?? 0),
    timeSpent: Number(row.time_spent ?? row.timeSpent ?? 0),
    explanation: row.explanation ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

export function mapProgressRow(row: any): StudentProgress {
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId ?? '',
    subject: (row.subject as Subject) || 'Mathématiques',
    skill: row.skill ?? '',
    score: Number(row.score ?? 0),
    totalAttempts: Number(row.total_attempts ?? row.totalAttempts ?? 0),
    correctAttempts: Number(row.correct_attempts ?? row.correctAttempts ?? 0),
    level: (row.level as Difficulty) || 'moyen',
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
}

export function mapReportRow(row: any): TeacherReport {
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId ?? '',
    studentName: row.student_name ?? row.studentName ?? '',
    teacherId: row.teacher_id ?? row.teacherId ?? 'teacher-solene-depibrac',
    summary: row.summary ?? '',
    masteredPoints: Array.isArray(row.mastered_points)
      ? row.mastered_points
      : Array.isArray(row.masteredPoints)
      ? row.masteredPoints
      : [],
    difficulties: Array.isArray(row.difficulties) ? row.difficulties : [],
    frequentErrors: Array.isArray(row.frequent_errors)
      ? row.frequent_errors
      : Array.isArray(row.frequentErrors)
      ? row.frequentErrors
      : [],
    recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
    nextSteps: Array.isArray(row.next_steps)
      ? row.next_steps
      : Array.isArray(row.nextSteps)
      ? row.nextSteps
      : [],
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}
