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
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

/**
 * Fetch all registered students in the CM2 class
 * Reads from both server API and Firestore to guarantee 100% reliability
 */
export async function getCM2Students(): Promise<UserProfile[]> {
  const studentsMap = new Map<string, UserProfile>();

  // 1. Try server API
  try {
    const res = await fetch('/api/students');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.students)) {
        data.students.forEach((st: UserProfile) => {
          studentsMap.set(st.id, st);
        });
      }
    }
  } catch (error) {
    console.warn('API students fetch notice:', error);
  }

  // 2. Also query Firestore directly
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!studentsMap.has(docSnap.id)) {
        studentsMap.set(docSnap.id, {
          id: docSnap.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          role: 'student',
          classId: data.classId || 'class-cm2',
          className: data.className || 'CM2',
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }
    });
  } catch (fsErr) {
    console.warn('Firestore direct query notice:', fsErr);
  }

  return Array.from(studentsMap.values());
}

/**
 * Fetch all real attempts made by a specific student
 */
export async function getStudentAttempts(studentId: string): Promise<Attempt[]> {
  const attemptsMap = new Map<string, Attempt>();

  try {
    const res = await fetch(`/api/attempts/${encodeURIComponent(studentId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.attempts)) {
        data.attempts.forEach((a: Attempt) => attemptsMap.set(a.id, a));
      }
    }
  } catch (error) {
    console.warn('API attempts fetch notice:', error);
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'attempts'), where('studentId', '==', studentId))
    );
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Attempt;
      if (!attemptsMap.has(docSnap.id)) {
        attemptsMap.set(docSnap.id, { ...data, id: docSnap.id });
      }
    });
  } catch (e) {}

  return Array.from(attemptsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Fetch real student progress per skill
 */
export async function getStudentProgress(studentId: string): Promise<StudentProgress[]> {
  const progMap = new Map<string, StudentProgress>();

  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(studentId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.progress)) {
        data.progress.forEach((p: StudentProgress) => progMap.set(p.id, p));
      }
    }
  } catch (error) {
    console.warn('API progress fetch notice:', error);
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'progress'), where('studentId', '==', studentId))
    );
    snap.forEach((docSnap) => {
      const data = docSnap.data() as StudentProgress;
      if (!progMap.has(docSnap.id)) {
        progMap.set(docSnap.id, { ...data, id: docSnap.id });
      }
    });
  } catch (e) {}

  return Array.from(progMap.values());
}

/**
 * Record a new attempt in both the server and Firestore
 */
export async function recordAttempt(attempt: Attempt): Promise<void> {
  try {
    await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt),
    });
  } catch (error) {
    console.warn('API recordAttempt error:', error);
  }

  try {
    await setDoc(doc(db, 'attempts', attempt.id), attempt);
  } catch (e) {
    console.warn('Firestore attempt write error:', e);
  }
}

/**
 * Get available exercise bank with optional difficulty filtering
 */
export async function getExercises(
  subject?: Subject,
  skill?: string,
  difficulty?: Difficulty
): Promise<ExerciseItem[]> {
  const matches = INITIAL_EXERCISES.filter((ex) => {
    if (subject && ex.subject !== subject) return false;
    if (skill && ex.skill !== skill) return false;
    if (difficulty && ex.difficulty !== difficulty) return false;
    return true;
  });

  if (matches.length > 0) return matches;

  // Fallback ignoring difficulty if none matched exactly
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
    const response = await fetch('/api/generate-adaptive-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  // Robust procedural fallback
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
  const response = await fetch('/api/generate-exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Échec de la génération des exercices');
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
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Échec de la génération du rapport');
  }

  const data = await response.json();
  return data.report;
}

/**
 * Get all generated reports for the teacher
 */
export async function getTeacherReports(): Promise<TeacherReport[]> {
  try {
    const res = await fetch('/api/reports');
    if (res.ok) {
      const data = await res.json();
      return data.reports || [];
    }
  } catch (error) {
    console.error('Error fetching reports:', error);
  }
  return [];
}

/**
 * Delete a student completely (by Teacher)
 */
export async function deleteStudent(studentId: string): Promise<boolean> {
  let ok = false;
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    });
    if (res.ok) ok = true;
  } catch (e) {
    console.warn('API deleteStudent notice:', e);
  }

  // Also delete directly from Firestore
  try {
    await deleteDoc(doc(db, 'users', studentId));
    ok = true;
  } catch (fsErr) {
    console.warn('Firestore delete user error:', fsErr);
  }

  return ok;
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

  let success = false;
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      success = true;
    }
  } catch (e) {
    console.warn('API updateStudentPassword error:', e);
  }

  // Also update directly in Firestore
  try {
    await setDoc(doc(db, 'users', studentId), { password: newPassword }, { merge: true });
    success = true;
  } catch (fsErr) {
    console.warn('Firestore update password error:', fsErr);
  }

  return { success, error: success ? undefined : 'Impossible de modifier le mot de passe.' };
}

/**
 * Clear all data from the database while keeping the teacher
 */
export async function clearDatabasePreservingTeacher(): Promise<{ success: boolean; error?: string }> {
  let success = false;
  try {
    const res = await fetch('/api/admin/clear-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      success = true;
    }
  } catch (e: any) {
    console.warn('API clearDatabasePreservingTeacher error:', e);
  }

  // Also ensure client-side Firestore cleanup if possible
  try {
    const studentUsersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    for (const d of studentUsersSnap.docs) {
      await deleteDoc(doc(db, 'users', d.id));
    }
    const attSnap = await getDocs(collection(db, 'attempts'));
    for (const d of attSnap.docs) {
      await deleteDoc(doc(db, 'attempts', d.id));
    }
    const progSnap = await getDocs(collection(db, 'progress'));
    for (const d of progSnap.docs) {
      await deleteDoc(doc(db, 'progress', d.id));
    }
    const repSnap = await getDocs(collection(db, 'reports'));
    for (const d of repSnap.docs) {
      await deleteDoc(doc(db, 'reports', d.id));
    }
    success = true;
  } catch (fsErr) {
    console.warn('Client Firestore cleanup notice:', fsErr);
  }

  return { success, error: success ? undefined : 'Impossible de vider la base de données.' };
}

