import {
  UserProfile,
  ExerciseItem,
  Attempt,
  StudentProgress,
  TeacherReport,
  Difficulty,
  Subject,
} from '../types';
import { INITIAL_EXERCISES } from './demoData';
import { generateProceduralExercise } from './proceduralGenerator';
import {
  supabase,
  getAuthHeaders,
  mapUserRow,
  mapExerciseRow,
  mapAttemptRow,
  mapProgressRow,
  mapReportRow,
} from './supabase';

/**
 * Fetch all registered students in the CM2 class (RLS ensures teacher access)
 */
export async function getCM2Students(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] getCM2Students error:', error.message);
    return [];
  }

  return (data || []).map(mapUserRow);
}

/**
 * Fetch all real attempts made by a specific student
 */
export async function getStudentAttempts(studentId: string): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] getStudentAttempts error:', error.message);
    return [];
  }

  return (data || []).map(mapAttemptRow);
}

/**
 * Fetch real student progress per skill
 */
export async function getStudentProgress(studentId: string): Promise<StudentProgress[]> {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] getStudentProgress error:', error.message);
    return [];
  }

  return (data || []).map(mapProgressRow);
}

/**
 * Atomically record a new attempt and recalculate skill progress in Supabase
 */
export async function recordAttempt(attempt: Attempt): Promise<void> {
  const { error } = await supabase.rpc('record_attempt_and_progress', {
    p_id: attempt.id,
    p_exercise_id: attempt.exerciseId,
    p_student_id: attempt.studentId,
    p_student_name: attempt.studentName,
    p_subject: attempt.subject,
    p_skill: attempt.skill,
    p_difficulty: attempt.difficulty || 'moyen',
    p_question: attempt.question,
    p_answer: attempt.answer,
    p_correct_answer: attempt.correctAnswer,
    p_is_correct: attempt.isCorrect,
    p_score: attempt.score,
    p_time_spent: attempt.timeSpent ?? 0,
    p_explanation: attempt.explanation || '',
  });

  if (error) {
    console.error('[Supabase] recordAttempt RPC error:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Get available exercise bank from Supabase with fallback to starter bank
 */
export async function getExercises(
  subject?: Subject,
  skill?: string,
  difficulty?: Difficulty
): Promise<ExerciseItem[]> {
  try {
    let query = supabase.from('exercises').select('*');
    if (subject) query = query.eq('subject', subject);
    if (skill) query = query.eq('skill', skill);
    if (difficulty) query = query.eq('difficulty', difficulty);

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(mapExerciseRow);
    }
  } catch (err) {
    console.warn('[Supabase] getExercises fallback to local starter bank:', err);
  }

  const matches = INITIAL_EXERCISES.filter((ex) => {
    if (subject && ex.subject !== subject) return false;
    if (skill && ex.skill !== skill) return false;
    if (difficulty && ex.difficulty !== difficulty) return false;
    return true;
  });

  if (matches.length > 0) return matches;

  return INITIAL_EXERCISES.filter((ex) => {
    if (subject && ex.subject !== subject) return false;
    if (skill && ex.skill !== skill) return false;
    return true;
  });
}

/**
 * Call backend to generate a real-time adaptive CM2 exercise
 * Tailored dynamically to student's previous answer and progress
 */
export async function callGeminiGenerateAdaptiveExercise(params: {
  studentName: string;
  studentId?: string;
  subject: Subject;
  skill: string;
  questionIndex?: number;
  lastAttempt?: {
    question: string;
    answer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation?: string;
  };
  historyQuestions?: string[];
  difficulty?: Difficulty;
  weakSkills?: string[];
  strongSkills?: string[];
  recentMistakes?: any[];
}): Promise<ExerciseItem> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/generate-adaptive-exercise', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.exercise) {
        return {
          ...data.exercise,
          studentId: params.studentId || 'all',
        };
      }
    }
  } catch (error) {
    console.warn('API adaptive exercise fetch error, using procedural fallback:', error);
  }

  // Robust procedural fallback (also used on static GitHub Pages)
  return generateProceduralExercise(
    params.subject,
    params.skill,
    params.difficulty || 'moyen',
    params.studentName,
    params.historyQuestions || []
  );
}

/**
 * Call Gemini backend to generate adaptive exercises
 */
export async function callGeminiGenerateExercises(params: {
  studentName: string;
  studentId?: string;
  subject: Subject;
  skill: string;
  difficulty: Difficulty;
  count: number;
  accuracy: number;
  recentErrors?: string[];
}): Promise<ExerciseItem[]> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/generate-exercises', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Échec de la génération des exercices');
  }

  const data = await response.json();
  return (data.exercises || []).map((ex: any, idx: number) => ({
    ...ex,
    id: ex.id || `gemini-${Date.now()}-${idx}`,
    studentId: params.studentId || 'all',
  }));
}

/**
 * Call Gemini backend to generate a diagnostic report for the teacher
 */
export async function callGeminiGenerateReport(params: {
  studentId: string;
  studentName: string;
  totalExercises: number;
  overallScore: number;
  skills: { [skill: string]: number };
  recentAttempts: Attempt[];
  recentErrors: Attempt[];
}): Promise<TeacherReport> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/generate-report', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.report) {
        return data.report;
      }
    }
  } catch (err) {
    console.warn('API generate-report fallback:', err);
  }

  // Client-side pedagogical diagnostic fallback when static host has no backend
  const skillEntries = Object.entries(params.skills || {});
  const masteredPoints = skillEntries
    .filter(([_, sc]) => sc >= 75)
    .map(([sk, sc]) => `${sk} : compétence acquise avec ${sc} % de réussite.`);
  const difficulties = skillEntries
    .filter(([_, sc]) => sc < 75)
    .map(([sk, sc]) => `${sk} : notion en cours d'acquisition (${sc} % de réussite), nécessite un renforcement.`);

  const frequentErrors =
    params.recentErrors.length > 0
      ? params.recentErrors
          .slice(0, 3)
          .map((e) => `Erreur en ${e.skill} sur « ${e.question.slice(0, 60)}... » (réponse donnée : ${e.answer})`)
      : ['Aucune erreur récurrente constatée lors des dernières évaluations.'];

  const fallbackReport: TeacherReport = {
    id: `rep-${Date.now()}`,
    studentId: params.studentId,
    studentName: params.studentName,
    teacherId: 'teacher-solene-depibrac',
    summary: `${params.studentName} a réalisé ${params.totalExercises} exercice(s) avec un taux de réussite global de ${params.overallScore} %. ${
      params.overallScore >= 75
        ? 'Le profil montre une très bonne maîtrise des attendus de CM2.'
        : 'Des séances régulières de consolidation permettront de stabiliser les notions fragiles.'
    }`,
    masteredPoints:
      masteredPoints.length > 0
        ? masteredPoints
        : ["Participation active aux premières séances d'évaluation diagnostique."],
    difficulties:
      difficulties.length > 0
        ? difficulties
        : ['Aucune difficulté majeure constatée sur les notions évaluées.'],
    frequentErrors,
    recommendations:
      difficulties.length > 0
        ? [
            'Proposer des séries courtes de remédiation guidée avec manipulation ou schéma.',
            "Encourager l'utilisation des indices progressifs de Néo avant de valider.",
          ]
        : [
            "Poursuivre avec des défis d'approfondissement de fin de CM2 / début 6e.",
            'Varier les problèmes à étapes pour entretenir le raisonnement logique.',
          ],
    nextSteps: [
      "Poursuivre l'entraînement adaptatif quotidien de 5 questions.",
      'Vérifier la stabilité des acquis lors de la prochaine séance.',
    ],
    createdAt: new Date().toISOString(),
  };

  try {
    await supabase.from('reports').insert({
      id: fallbackReport.id,
      student_id: fallbackReport.studentId,
      student_name: fallbackReport.studentName,
      teacher_id: fallbackReport.teacherId,
      summary: fallbackReport.summary,
      mastered_points: fallbackReport.masteredPoints,
      difficulties: fallbackReport.difficulties,
      frequent_errors: fallbackReport.frequentErrors,
      recommendations: fallbackReport.recommendations,
      next_steps: fallbackReport.nextSteps,
      created_at: fallbackReport.createdAt,
    });
  } catch (sbErr) {
    console.warn('[Supabase] save fallback report error:', sbErr);
  }

  return fallbackReport;
}

/**
 * Get all generated reports for the teacher
 */
export async function getTeacherReports(): Promise<TeacherReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] getTeacherReports error:', error.message);
    return [];
  }

  return (data || []).map(mapReportRow);
}

/**
 * Delete a student completely (by Teacher).
 * Uses backend route first (to also clean up auth.users when service role is configured),
 * and falls back to direct Supabase delete (ON DELETE CASCADE cleans attempts/progress/reports).
 */
export async function deleteStudent(studentId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) return true;
  } catch (e) {
    console.warn('API deleteStudent notice, falling back to direct Supabase delete:', e);
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', studentId)
    .eq('role', 'student');

  if (error) {
    console.warn('[Supabase] direct deleteStudent error:', error.message);
    return false;
  }

  return true;
}

/**
 * Modify a student's password (by Teacher)
 */
export async function updateStudentPassword(
  studentId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' };
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ newPassword }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      return {
        success: false,
        error: data.error || 'Impossible de modifier le mot de passe de cet élève.',
      };
    }
  } catch (e) {
    console.warn('API updateStudentPassword error:', e);
  }

  return {
    success: false,
    error:
      'La modification du mot de passe d’un élève nécessite le serveur backend avec SUPABASE_SERVICE_ROLE_KEY configurée.',
  };
}

/**
 * Clear all data from the database while keeping the teacher
 */
export async function clearDatabasePreservingTeacher(): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/clear-database', {
      method: 'POST',
      headers,
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
    }
  } catch (e) {
    console.warn('API clearDatabasePreservingTeacher notice, using direct Supabase cleanup:', e);
  }

  // Direct authenticated teacher cleanup via RLS
  try {
    await supabase.from('reports').delete().neq('id', '');
    await supabase.from('progress').delete().neq('id', '');
    await supabase.from('attempts').delete().neq('id', '');
    const { error } = await supabase.from('users').delete().eq('role', 'student');
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible de vider la base de données.' };
  }
}
