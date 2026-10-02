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
 * Get available exercise bank
 */
export async function getExercises(
  subject?: Subject,
  skill?: string
): Promise<ExerciseItem[]> {
  return INITIAL_EXERCISES.filter((ex) => {
    if (subject && ex.subject !== subject) return false;
    if (skill && ex.skill !== skill) return false;
    return true;
  });
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
