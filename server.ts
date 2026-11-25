import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { generateProceduralExercise } from './src/lib/proceduralGenerator.ts';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Read Firebase Config
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

// Initialize Firebase client SDK with the named database
const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Persistent Local Database Backup Directory & File
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'edutrain_db.json');

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'student';
  classId: string;
  className: string;
  password: string;
  createdAt: string;
}

interface AttemptRecord {
  id: string;
  exerciseId: string;
  studentId: string;
  studentName: string;
  subject: string;
  skill: string;
  difficulty?: string;
  question: string;
  answer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
  timeSpent?: number;
  explanation: string;
  createdAt: string;
}

interface ProgressRecord {
  id: string;
  studentId: string;
  subject: string;
  skill: string;
  score: number;
  totalAttempts: number;
  correctAttempts: number;
  level: string;
  updatedAt: string;
}

interface ReportRecord {
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

interface DatabaseSchema {
  users: UserRecord[];
  attempts: AttemptRecord[];
  progress: ProgressRecord[];
  reports: ReportRecord[];
}

const TEACHER_USER: UserRecord = {
  id: 'teacher-solene-depibrac',
  firstName: 'Solène',
  lastName: 'De Pibrac',
  email: 'solene.depibrac@edutrain.fr',
  role: 'teacher',
  classId: 'class-cm2',
  className: 'CM2',
  password: 'marinetpaul',
  createdAt: '2026-09-01T08:00:00.000Z',
};

function initDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const hasTeacher = parsed.users?.some((u: any) => u.role === 'teacher');
      if (!hasTeacher) {
        parsed.users = [TEACHER_USER, ...(parsed.users || [])];
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      }
      return parsed;
    } catch (e) {
      console.error('Error reading local db file:', e);
    }
  }

  const initialDb: DatabaseSchema = {
    users: [TEACHER_USER],
    attempts: [],
    progress: [],
    reports: [],
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  return initialDb;
}

function getDb(): DatabaseSchema {
  return initDb();
}

function saveDb(data: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Sync Teacher to Firestore on startup
async function syncTeacherToFirestore() {
  try {
    await setDoc(doc(firestoreDb, 'users', TEACHER_USER.id), {
      id: TEACHER_USER.id,
      firstName: TEACHER_USER.firstName,
      lastName: TEACHER_USER.lastName,
      fullName: 'Solène De Pibrac',
      email: TEACHER_USER.email,
      identifier: 'solene',
      role: 'teacher',
      classId: 'class-cm2',
      className: 'CM2',
      createdAt: TEACHER_USER.createdAt,
    });
    console.log('[Firestore] Teacher Solène De Pibrac synced to Firestore.');
  } catch (err: any) {
    console.warn('[Firestore] Sync teacher warning:', err?.message);
  }
}
syncTeacherToFirestore();

// Initialize Gemini SDK with high-performance model
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function callGemini(prompt: string): Promise<string> {
  const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      console.log(`[Gemini AI] Calling model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        console.log(`[Gemini AI] Success with model: ${model}`);
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Gemini AI] Model ${model} returned error:`, err?.status || err?.message || err);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw new Error('Tous les modèles Gemini ont échoué.');
}

// ----------------------------------------------------
// AUTHENTICATION & USERS (Dual Sync: Firestore + Local DB)
// ----------------------------------------------------

/**
 * Register a new student in the database (writes to Firestore AND local DB)
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, password } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ success: false, error: 'Prénom et nom requis.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const sanitize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    const email = `${sanitize(cleanFirst)}.${sanitize(cleanLast)}@cm2.edutrain.fr`;
    const db = getDb();

    // Check existing in local db
    const existing = db.users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() ||
        (u.firstName.toLowerCase() === cleanFirst.toLowerCase() &&
          u.lastName.toLowerCase() === cleanLast.toLowerCase())
    );

    // Also check Firestore for duplicate names
    let existsInFirestore = false;
    try {
      const snap = await getDocs(query(collection(firestoreDb, 'users'), where('role', '==', 'student')));
      snap.forEach((d) => {
        const data = d.data();
        const sameEmail = (data.email || '').toLowerCase() === email.toLowerCase();
        const sameName =
          (data.firstName || '').toLowerCase() === cleanFirst.toLowerCase() &&
          (data.lastName || '').toLowerCase() === cleanLast.toLowerCase();
        if (sameEmail || sameName) {
          existsInFirestore = true;
        }
      });
    } catch (e) {
      console.warn('Notice checking duplicate in Firestore:', e);
    }

    if (existing || existsInFirestore) {
      return res.status(400).json({
        success: false,
        error: 'Un compte avec ce prénom et ce nom existe déjà. Veuillez vous connecter.',
      });
    }

    const newUser: UserRecord = {
      id: `student-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      firstName: cleanFirst,
      lastName: cleanLast,
      email,
      role: 'student',
      classId: 'class-cm2',
      className: 'CM2',
      password,
      createdAt: new Date().toISOString(),
    };

    // 1. Save to local DB
    db.users.push(newUser);
    saveDb(db);

    // 2. Save directly to Firestore users collection
    try {
      await setDoc(doc(firestoreDb, 'users', newUser.id), {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: 'student',
        classId: 'class-cm2',
        className: 'CM2',
        password: newUser.password,
        createdAt: newUser.createdAt,
      });
      console.log(`[Firestore] New student written to Firestore: ${newUser.firstName} ${newUser.lastName} (${newUser.id})`);
    } catch (fsErr: any) {
      console.warn('[Firestore] Notice during user write:', fsErr?.message);
    }

    console.log(`[EduTrain DB] Student registered: ${newUser.firstName} ${newUser.lastName} (ID: ${newUser.id})`);

    const { password: _, ...safeUser } = newUser;
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur lors de la création du compte.' });
  }
});

/**
 * Login with strict credentials verification
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis.' });
    }

    const db = getDb();
    const cleanId = identifier.trim().toLowerCase();

    // 1. Check Teacher Solène De Pibrac
    if (
      cleanId === 'solene' ||
      cleanId === 'solène' ||
      cleanId === 'solene.depibrac' ||
      cleanId === 'solene.depibrac@edutrain.fr'
    ) {
      const teacher = db.users.find((u) => u.role === 'teacher') || TEACHER_USER;
      if (teacher.password === password) {
        const { password: _, ...safeTeacher } = teacher;
        return res.json({ success: true, user: safeTeacher });
      }
      return res.status(401).json({ success: false, error: 'Mot de passe incorrect pour le compte enseignant.' });
    }

    // 2. Check registered students in local DB
    let student = db.users.find(
      (u) =>
        u.role === 'student' &&
        (u.email.toLowerCase() === cleanId ||
          `${u.firstName.toLowerCase()} ${u.lastName.toLowerCase()}` === cleanId ||
          `${u.firstName.toLowerCase()}.${u.lastName.toLowerCase()}` === cleanId ||
          u.firstName.toLowerCase() === cleanId)
    );

    // If not found in local db, check Firestore
    if (!student) {
      try {
        const snap = await getDocs(query(collection(firestoreDb, 'users'), where('role', '==', 'student')));
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const email = (data.email || '').toLowerCase();
          const name = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase().trim();
          const first = (data.firstName || '').toLowerCase();
          if (email === cleanId || name === cleanId || first === cleanId) {
            student = {
              id: docSnap.id,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              role: 'student',
              classId: data.classId || 'class-cm2',
              className: data.className || 'CM2',
              password: data.password || '',
              createdAt: data.createdAt || new Date().toISOString(),
            };
          }
        });
      } catch (err: any) {
        console.warn('[Firestore] Error finding user in Firestore:', err?.message);
      }
    }

    if (student) {
      if (student.password && student.password === password) {
        const { password: _, ...safeStudent } = student;
        return res.json({ success: true, user: safeStudent });
      }
      return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
    }

    return res.status(401).json({ success: false, error: 'Identifiant introuvable. Veuillez vérifier ou vous inscrire.' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur lors de la connexion.' });
  }
});

/**
 * Update teacher or general user password
 */
app.post('/api/auth/update-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const db = getDb();
    const userIndex = db.users.findIndex((u) => u.id === userId || (u.role === 'teacher' && !userId));
    if (userIndex !== -1) {
      db.users[userIndex].password = newPassword;
      saveDb(db);

      // Update in Firestore
      try {
        const targetId = db.users[userIndex].id;
        await setDoc(doc(firestoreDb, 'users', targetId), { password: newPassword }, { merge: true });
      } catch (e) {}

      return res.json({ success: true });
    }

    return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour.' });
  }
});

/**
 * Update student password (by Teacher Solène)
 */
app.post('/api/students/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.',
      });
    }

    const db = getDb();
    const studentIdx = db.users.findIndex((u) => u.id === id && u.role === 'student');

    if (studentIdx !== -1) {
      db.users[studentIdx].password = newPassword;
      saveDb(db);
    }

    // Always update in Firestore
    try {
      await setDoc(doc(firestoreDb, 'users', id), { password: newPassword }, { merge: true });
      console.log(`[Firestore] Password updated for student: ${id}`);
    } catch (fsErr) {
      console.warn('Firestore password update error:', fsErr);
    }

    return res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    console.error('Error modifying student password:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la modification du mot de passe.' });
  }
});

/**
 * Delete a student completely (by Teacher Solène)
 */
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 1. Remove from local DB
    db.users = db.users.filter((u) => u.id !== id);
    db.attempts = db.attempts.filter((a) => a.studentId !== id);
    db.progress = db.progress.filter((p) => p.studentId !== id);
    db.reports = db.reports.filter((r) => r.studentId !== id);
    saveDb(db);

    // 2. Delete from Firestore
    try {
      await deleteDoc(doc(firestoreDb, 'users', id));
      console.log(`[Firestore] Deleted student document: ${id}`);
    } catch (fsErr) {
      console.warn('Firestore delete user error:', fsErr);
    }

    return res.json({ success: true, message: 'Élève supprimé avec succès.' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'élève.' });
  }
});

/**
 * Clear all data in database while keeping the teacher
 */
app.post('/api/admin/clear-database', async (req, res) => {
  try {
    const db = getDb();
    const teacher = db.users.find((u) => u.role === 'teacher') || TEACHER_USER;

    // Reset local database
    db.users = [teacher];
    db.attempts = [];
    db.progress = [];
    db.reports = [];
    saveDb(db);

    // Sync Firestore: keep teacher, clear other docs
    try {
      await setDoc(doc(firestoreDb, 'users', teacher.id), {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        fullName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        identifier: 'solene',
        role: 'teacher',
        classId: teacher.classId || 'class-cm2',
        className: teacher.className || 'CM2',
        password: teacher.password,
        createdAt: teacher.createdAt,
      });

      // Clear users except teacher
      const usersSnap = await getDocs(collection(firestoreDb, 'users'));
      for (const uDoc of usersSnap.docs) {
        if (uDoc.id !== teacher.id) {
          await deleteDoc(doc(firestoreDb, 'users', uDoc.id));
        }
      }

      // Clear attempts
      const attSnap = await getDocs(collection(firestoreDb, 'attempts'));
      for (const aDoc of attSnap.docs) {
        await deleteDoc(doc(firestoreDb, 'attempts', aDoc.id));
      }

      // Clear progress
      const progSnap = await getDocs(collection(firestoreDb, 'progress'));
      for (const pDoc of progSnap.docs) {
        await deleteDoc(doc(firestoreDb, 'progress', pDoc.id));
      }

      // Clear reports
      const repSnap = await getDocs(collection(firestoreDb, 'reports'));
      for (const rDoc of repSnap.docs) {
        await deleteDoc(doc(firestoreDb, 'reports', rDoc.id));
      }
    } catch (fsErr: any) {
      console.warn('[Firestore] Notice during clear-database:', fsErr?.message);
    }

    console.log('[EduTrain DB] Base de données vidée (enseignant conservé).');
    return res.json({
      success: true,
      message: 'Base de données vidée avec succès. Seul le compte enseignant a été conservé.',
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du vidage de la base de données.',
    });
  }
});

/**
 * Get all registered students (reads from Firestore + local DB)
 */
app.get('/api/students', async (req, res) => {
  const db = getDb();
  const studentsMap = new Map<string, any>();

  // 1. Add students from local DB
  db.users
    .filter((u) => u.role === 'student')
    .forEach(({ password, ...u }) => {
      studentsMap.set(u.id, u);
    });

  // 2. Fetch from Firestore users collection
  try {
    const snap = await getDocs(query(collection(firestoreDb, 'users'), where('role', '==', 'student')));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!studentsMap.has(docSnap.id)) {
        studentsMap.set(docSnap.id, {
          id: docSnap.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: 'student',
          classId: data.classId || 'class-cm2',
          className: data.className || 'CM2',
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }
    });
  } catch (fsErr: any) {
    console.warn('[Firestore] Notice fetching students from Firestore:', fsErr?.message);
  }

  const students = Array.from(studentsMap.values());
  return res.json({ success: true, students });
});

// ----------------------------------------------------
// ATTEMPTS & PROGRESS (Dual Sync)
// ----------------------------------------------------

/**
 * Get attempts for a specific student
 */
app.get('/api/attempts/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const db = getDb();

  const attemptsMap = new Map<string, AttemptRecord>();

  // From local DB
  db.attempts
    .filter((a) => a.studentId === studentId)
    .forEach((a) => attemptsMap.set(a.id, a));

  // From Firestore
  try {
    const snap = await getDocs(
      query(collection(firestoreDb, 'attempts'), where('studentId', '==', studentId))
    );
    snap.forEach((docSnap) => {
      const data = docSnap.data() as AttemptRecord;
      if (!attemptsMap.has(docSnap.id)) {
        attemptsMap.set(docSnap.id, { ...data, id: docSnap.id });
      }
    });
  } catch (fsErr: any) {
    console.warn('[Firestore] Notice fetching attempts:', fsErr?.message);
  }

  const studentAttempts = Array.from(attemptsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return res.json({ success: true, attempts: studentAttempts });
});

/**
 * Record a real attempt and update skill progress
 */
app.post('/api/attempts', async (req, res) => {
  try {
    const attempt: AttemptRecord = req.body;
    if (!attempt || !attempt.studentId) {
      return res.status(400).json({ success: false, error: 'Données de tentative invalides.' });
    }

    const db = getDb();
    db.attempts.unshift(attempt);

    // Compute updated progress for this student and skill
    const studentSkillAttempts = db.attempts.filter(
      (a) => a.studentId === attempt.studentId && a.skill === attempt.skill
    );

    const total = studentSkillAttempts.length;
    const correct = studentSkillAttempts.filter((a) => a.isCorrect).length;
    const score = Math.round((correct / total) * 100);

    const recentThree = studentSkillAttempts.slice(0, 3);
    let level = 'moyen';
    if (recentThree.length >= 3 && recentThree.every((a) => a.isCorrect)) {
      level = score > 85 ? 'difficile' : 'moyen';
    } else if (recentThree.length >= 2 && recentThree.slice(0, 2).every((a) => !a.isCorrect)) {
      level = 'facile';
    } else {
      level = score >= 75 ? 'moyen' : 'facile';
    }

    const progId = `prog-${attempt.studentId}-${attempt.skill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const progIndex = db.progress.findIndex((p) => p.id === progId);

    const updatedProg: ProgressRecord = {
      id: progId,
      studentId: attempt.studentId,
      subject: attempt.subject,
      skill: attempt.skill,
      score,
      totalAttempts: total,
      correctAttempts: correct,
      level,
      updatedAt: new Date().toISOString(),
    };

    if (progIndex !== -1) {
      db.progress[progIndex] = updatedProg;
    } else {
      db.progress.push(updatedProg);
    }

    saveDb(db);

    // Write to Firestore asynchronously
    try {
      await Promise.all([
        setDoc(doc(firestoreDb, 'attempts', attempt.id), attempt),
        setDoc(doc(firestoreDb, 'progress', updatedProg.id), updatedProg),
      ]);
      console.log(`[Firestore] Attempt & progress saved for student ${attempt.studentId}`);
    } catch (fsErr: any) {
      console.warn('[Firestore] Error saving attempt to Firestore:', fsErr?.message);
    }

    return res.json({ success: true, attempt, progress: updatedProg });
  } catch (error) {
    console.error('Error recording attempt:', error);
    return res.status(500).json({ success: false, error: 'Impossible d\'enregistrer la tentative.' });
  }
});

/**
 * Get progress records for a student
 */
app.get('/api/progress/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const db = getDb();
  const progMap = new Map<string, ProgressRecord>();

  db.progress
    .filter((p) => p.studentId === studentId)
    .forEach((p) => progMap.set(p.id, p));

  try {
    const snap = await getDocs(
      query(collection(firestoreDb, 'progress'), where('studentId', '==', studentId))
    );
    snap.forEach((docSnap) => {
      const data = docSnap.data() as ProgressRecord;
      if (!progMap.has(docSnap.id)) {
        progMap.set(docSnap.id, { ...data, id: docSnap.id });
      }
    });
  } catch (fsErr: any) {
    console.warn('[Firestore] Notice fetching progress:', fsErr?.message);
  }

  return res.json({ success: true, progress: Array.from(progMap.values()) });
});

/**
 * Get all teacher reports
 */
app.get('/api/reports', (req, res) => {
  const db = getDb();
  return res.json({ success: true, reports: db.reports });
});

// ----------------------------------------------------
// REAL GEMINI AI INTEGRATION
// ----------------------------------------------------

/**
 * Generate a single real-time adaptive CM2 exercise with Gemini
 * Dynamically adapts according to student's previous answer (remediation vs progression)
 */
app.post('/api/generate-adaptive-exercise', async (req, res) => {
  const {
    studentId,
    studentName = 'Élève',
    subject = 'Mathématiques',
    skill = 'Fractions',
    questionIndex = 0,
    lastAttempt,
    historyQuestions = [],
    difficulty: requestedDifficulty,
    weakSkills = [],
    strongSkills = [],
    recentMistakes = [],
  } = req.body;

  const db = getDb();
  // Fetch real past attempts of this student for this skill
  const pastSkillAttempts = db.attempts.filter(
    (a) => a.studentId === studentId && a.skill === skill
  );
  const totalSkillAttempts = pastSkillAttempts.length;
  const correctSkillAttempts = pastSkillAttempts.filter((a) => a.isCorrect).length;
  const currentSkillScore = totalSkillAttempts > 0 ? Math.round((correctSkillAttempts / totalSkillAttempts) * 100) : 70;

  // Determine dynamic adaptive difficulty:
  let difficulty = requestedDifficulty || (currentSkillScore >= 80 ? 'difficile' : currentSkillScore < 60 ? 'facile' : 'moyen');

  let adaptationContext = '';
  if (lastAttempt) {
    if (!lastAttempt.isCorrect) {
      // Immediate remediation adaptation
      if (difficulty === 'difficile') difficulty = 'moyen';
      else if (difficulty === 'moyen') difficulty = 'facile';

      adaptationContext = `
ÉLÉMENT CRUCIAL D'ADAPTATION PÉDAGOGIQUE (L'ÉLÈVE VIENT D'ÉCHOUER SUR LA QUESTION PRÉCÉDENTE) :
- Question précédente ratée : "${lastAttempt.question}"
- Réponse incorrecte saisie par l'élève : "${lastAttempt.answer}"
- Réponse attendue : "${lastAttempt.correctAnswer}"
- OBJECTIF DE CETTE NOUVELLE QUESTION : Proposer une question de REMÉDIATION immédiate et bienveillante sur la même notion. La question doit décomposer la difficulté, proposer une approche plus visuelle ou concrète, et redonner confiance à l'élève avec un niveau de difficulté adapté (${difficulty}).`;
    } else {
      // Progression / Deepening adaptation
      if (difficulty === 'facile' && questionIndex >= 2) difficulty = 'moyen';
      else if (difficulty === 'moyen' && questionIndex >= 3) difficulty = 'difficile';

      adaptationContext = `
ÉLÉMENT CRUCIAL D'ADAPTATION PÉDAGOGIQUE (L'ÉLÈVE A RÉUSSI LA QUESTION PRÉCÉDENTE) :
- Question précédente réussie : "${lastAttempt.question}"
- OBJECTIF DE CETTE NOUVELLE QUESTION : L'élève progresse bien ! Propose un exercice qui approfondit la compétence avec un angle nouveau, des nombres différents ou un problème stimulant de niveau ${difficulty}, sans refaire la même chose.`;
    }
  }

  // Guidelines depending on targeted difficulty
  let difficultyGuidelines = '';
  if (difficulty === 'difficile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU DIFFICILE (Approfondissement & Défi CM2 / Cycle 3) :
- L'élève maîtrise déjà les bases. Ne lui propose SURTOUT PAS de questions simplistes ou directes.
- Propose des situations stimulantes : calculs à étapes, fractions supérieures à 1, encadrements, nombres décimaux avec retenues, recherche de compléments, raisonnement logique.`;
  } else if (difficulty === 'facile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU FACILE (Remédiation bienveillante & consolidation des bases) :
- Questions claires, très rassurantes et immédiatement compréhensibles.
- Vocabulaire fondamental explicite, références concrètes de la vie quotidienne de CM2.
- Évite les énoncés trop longs ou les calculs intimidants.`;
  } else {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU MOYEN (Consolidation standard CM2) :
- Exercice équilibré correspondant aux attendus réguliers en classe de CM2 en France.`;
  }

  const profileNotes = `
PROFIL D'APPRENTISSAGE DE L'ÉLÈVE :
- Compétences maîtrisées (points forts) : ${strongSkills.length > 0 ? strongSkills.join(', ') : 'En cours d\'évaluation'}
- Compétences à consolider (points faibles) : ${weakSkills.length > 0 ? weakSkills.join(', ') : 'Aucune fragilité majeure'}
- Erreurs récentes constatées : ${recentMistakes.length > 0 ? JSON.stringify(recentMistakes.slice(0, 3)) : 'Aucune'}`;

  // Combine past questions to prevent ANY repetition
  const allHistory = Array.from(new Set([
    ...historyQuestions,
    ...pastSkillAttempts.map((a) => a.question).slice(-10),
  ]));

  const historyWarning = allHistory.length > 0
    ? `INTERDICTION ABSOLUE DE RÉPÉTITION : L'élève a déjà répondu aux questions suivantes, tu NE DOIS EN AUCUN CAS les répéter ni réutiliser les mêmes valeurs ou les mêmes contextes :\n${allHistory.map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
    : '';

  const prompt = `
Tu es un concepteur pédagogique expert de l'école primaire française pour la classe de CM2 (élèves de 10-11 ans).
Tu dois créer UN SEUL exercice personnalisé, inédit et adapté pour l'élève "${studentName}".

CONTEXTE PÉDAGOGIQUE :
- Matière : ${subject}
- Compétence ciblée : ${skill}
- Niveau de difficulté ciblé : ${difficulty}
- Taux de réussite antérieur sur cette notion : ${currentSkillScore}%
- Position dans la session : Question ${questionIndex + 1} sur 5

${profileNotes}

${adaptationContext}

${difficultyGuidelines}

${historyWarning}

CONSIGNES STRICTES :
1. Énoncé 100% inédit, captivant, diversifié et adapté au CM2 en France (change les prénoms, les objets, les nombres et les mises en situation).
2. Varie les types : "qcm" (avec 3 ou 4 options crédibles dont obligatoirement la bonne réponse), "numeric" (nombre entier ou décimal avec virgule), "boolean" (Vrai ou Faux), ou "text" (mot court).
3. La réponse attendue ("correctAnswer") doit être rigoureusement exacte et sans ambiguïté.
4. Fournis une explication pédagogique limpide ("explanation") étape par étape.
5. Fournis un court indice encourageant ("hint") pour Néo sans révéler la solution finale.

FORMAT DE SORTIE JSON STRICT OBLIGATOIRE (un seul objet JSON valide sans texte avant ni après) :
{
  "id": "gen-adapt-${Date.now()}",
  "subject": "${subject}",
  "skill": "${skill}",
  "difficulty": "${difficulty}",
  "question": "Énoncé complet...",
  "type": "qcm" | "numeric" | "boolean" | "text",
  "options": ["Choix 1", "Choix 2", "Choix 3", "Choix 4"],
  "correctAnswer": "...",
  "explanation": "...",
  "hint": "..."
}
`;

  try {
    const text = await callGemini(prompt);
    const exercise = JSON.parse(text);

    // Ensure options array contains the correct answer if type is qcm
    if (exercise.type === 'qcm') {
      if (!Array.isArray(exercise.options)) {
        exercise.options = [exercise.correctAnswer, 'Choix 2', 'Choix 3'];
      } else if (!exercise.options.includes(exercise.correctAnswer)) {
        exercise.options.unshift(exercise.correctAnswer);
      }
      // Shuffle options so correct answer is not always first
      exercise.options.sort(() => Math.random() - 0.5);
    }

    return res.json({ success: true, exercise, aiModel: 'gemini-3.1-flash-lite' });
  } catch (error: any) {
    console.warn('[Gemini Adaptive Fallback] Utilisation du générateur procédural:', error?.message);
    const fallbackEx = generateProceduralExercise(subject as any, skill, difficulty as any, studentName, allHistory);
    return res.json({ success: true, exercise: fallbackEx, aiModel: 'procedural-fallback' });
  }
});

/**
 * Generate adaptive CM2 exercises batch with Gemini
 */
app.post('/api/generate-exercises', async (req, res) => {
  const {
    studentName = 'Élève',
    subject = 'Mathématiques',
    skill = 'Fractions',
    difficulty = 'facile',
    count = 5,
    accuracy = 0,
    recentErrors = [],
  } = req.body;

  let difficultyGuidelines = '';
  if (difficulty === 'difficile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU DIFFICILE (Approfondissement & Défi pour élève très performant avec >= 85% de réussite) :
- L'élève maîtrise déjà les bases fondamentales. Il ne faut SURTOUT PAS lui poser de questions simplistes ou évidentes (comme reconnaître 1/2 ou 3/4).
- Propose des exercices stimulants de fin de CM2 / Cycle 3 :
  * Fractions supérieures à 1 (ex: 7/4 = 1 + 3/4)
  * Encadrement d'une fraction entre deux nombres entiers consécutifs (ex: 2 < 7/3 < 3)
  * Écritures fractionnaires et fractions décimales (ex: 15/10 = 1,5 = 1 + 5/10)
  * Additions de fractions simples de même dénominateur ou de dénominateurs multiples (ex: 1/2 + 1/4 = 3/4)
  * Problèmes de partage ou de proportionnalité à plusieurs étapes logiques.`;
  } else if (difficulty === 'facile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU FACILE (Remédiation bienveillante pour élève en difficulté avec < 60% de réussite) :
- L'élève a besoin de consolider les bases sans se décourager.
- Propose des questions très claires, visuelles et accessibles :
  * Vocabulaire fondamental (numérateur = parts prises, dénominateur = parts totales)
  * Fractions usuelles simples (1/2, 1/4, 3/4) avec références familières (parts de gâteau, pizza, segments)
  * Évite les calculs lourds ou les énoncés longs.`;
  } else {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU MOYEN (Consolidation standard de niveau CM2 pour réussite entre 60% et 84%) :
- Exercices équilibrés correspondant au niveau moyen attendu en cours d'année de CM2.
- Comparaison de fractions simples, fractions sur droite graduée, équivalences simples (2/4 = 1/2).`;
  }

  const prompt = `
Tu es un concepteur pédagogique expert de l'école primaire française, spécialisé dans le niveau CM2 (enfants de 10-11 ans).
Tu dois créer une série de ${count} exercices personnalisés pour l'élève "${studentName}".

Paramètres de l'élève :
- Classe : CM2 (France)
- Matière : ${subject}
- Compétence ciblée : ${skill}
- Taux de réussite évalué : ${accuracy}%
- Niveau de difficulté ciblé : ${difficulty}
- Dernières erreurs de l'élève : ${JSON.stringify(recentErrors)}

${difficultyGuidelines}

Consignes strictes :
1. Les exercices doivent correspondre rigoureusement aux attendus du cycle 3 / CM2 en France.
2. Énoncés clairs, bienveillants et motivants pour un enfant de 10-11 ans.
3. Progression pédagogique : questions adaptées au niveau spécifié (${difficulty}).
4. Types de questions variés : "qcm" (avec 3 ou 4 options claires), "numeric" (réponse numérique entière ou décimale), "boolean" (Vrai ou Faux), ou "text" (mot ou phrase courte).
5. Fournis toujours une explication très claire, étape par étape, que l'élève lira en cas d'erreur ou de succès.
6. Ne donne JAMAIS la réponse dans la question.

Format de réponse OBLIGATOIRE : un tableau JSON valide respectant cette structure exacte :
[
  {
    "id": "gen-${Date.now()}-1",
    "subject": "${subject}",
    "skill": "${skill}",
    "difficulty": "${difficulty}",
    "question": "Énoncé complet et clair de la question...",
    "type": "qcm" | "numeric" | "boolean" | "text",
    "options": ["Choix 1", "Choix 2", "Choix 3", "Choix 4"],
    "correctAnswer": "La réponse exacte attendue (ex: '3/4', '24', 'Vrai')",
    "explanation": "Explication pédagogique adaptée à un élève de CM2..."
  }
]
`;

  try {
    const text = await callGemini(prompt);
    const exercises = JSON.parse(text);
    return res.json({ success: true, exercises, aiModel: 'gemini-3.1-flash-lite' });
  } catch (error) {
    console.warn('Gemini exercise generation fallback procedural:', error);
    const proceduralList = Array.from({ length: count }, () =>
      generateProceduralExercise(subject as any, skill, difficulty as any, studentName)
    );
    return res.json({ success: true, exercises: proceduralList, aiModel: 'procedural-fallback' });
  }
});

/**
 * Generate a detailed pedagogical report for Solène with Gemini
 */
app.post('/api/generate-report', async (req, res) => {
  const {
    studentId,
    studentName,
    totalExercises = 0,
    overallScore = 0,
    skills = {},
    recentAttempts = [],
    recentErrors = [],
  } = req.body;

  const prompt = `
Tu es un conseiller pédagogique de l'Éducation Nationale française.
Tu rédiges un rapport d'évaluation diagnostique pour Solène De Pibrac, professeure des écoles en classe de CM2.
Le rapport concerne l'élève : "${studentName}".

Données RÉELLES et PRÉCISES de l'élève :
- Nombre d'exercices réalisés : ${totalExercises}
- Réussite moyenne globale : ${overallScore}%
- Détail par compétence (scores réels) : ${JSON.stringify(skills)}
- Échantillon des dernières tentatives : ${JSON.stringify(recentAttempts.slice(0, 8))}
- Dernières erreurs constatées : ${JSON.stringify(recentErrors.slice(0, 8))}

RÈGLES ABSOLUES ET VITALES D'EXACTITUDE :
1. Une compétence avec un taux de réussite >= 75% ou 100% (par exemple Fractions à 100%) est un POINT FORT INCONTESTABLE. Elle DOIT OBLIGATOIREMENT figurer dans 'masteredPoints'.
2. IL EST STRICTEMENT INTERDIT de classer une compétence ayant >= 75% ou 100% de réussite dans 'difficulties' ou 'frequentErrors'. Ne jamais inventer de fausse difficulté sur une compétence totalement réussie.
3. Si l'élève a 100% de réussite globale ou 0 erreur, la section 'difficulties' DOIT OBLIGATOIREMENT contenir :
   ["Aucune difficulté constatée : l'élève a réussi l'ensemble des exercices avec brio."]
   et 'frequentErrors' DOIT valoir :
   ["Aucune erreur récurrente constatée lors des évaluations."]
4. Dans ce cas de réussite totale, les recommandations doivent porter sur l'approfondissement et des défis de niveau supérieur, et non sur de la remédiation.

Rédige un rapport clair, constructif, professionnel et directement exploitable par l'enseignante de CM2.
Le rapport doit impérativement respecter ce schéma JSON :
{
  "summary": "Synthèse globale de 2 à 4 phrases sur le profil d'apprentissage de l'élève, son engagement et ses résultats généraux.",
  "masteredPoints": [
    "Point fort 1 constaté avec pourcentage ou exemple concret",
    "Point fort 2 constaté"
  ],
  "difficulties": [
    "Difficulté réelle constatée (ou 'Aucune difficulté constatée' si tout est réussi)"
  ],
  "frequentErrors": [
    "Type d'erreur récurrente observée (ou 'Aucune erreur constatée' si réussite totale)"
  ],
  "recommendations": [
    "Recommandation concrète pour l'enseignante en classe (approfondissement si élève performant, remédiation si difficultés)",
    "Conseil d'entraînement individualisé"
  ],
  "nextSteps": [
    "Action pédagogique 1 immédiate proposée",
    "Action pédagogique 2 proposée"
  ]
}
`;

  try {
    const text = await callGemini(prompt);
    const reportData = JSON.parse(text);

    // Post-process sanitation: guarantee that no skill with >= 75% score appears in difficulties
    const highSkills = Object.entries(skills)
      .filter(([_, score]) => (score as number) >= 75)
      .map(([name]) => name.toLowerCase());

    if (reportData.difficulties && Array.isArray(reportData.difficulties)) {
      reportData.difficulties = reportData.difficulties.filter((diff: string) => {
        const lower = diff.toLowerCase();
        // If this difficulty claims a weakness in a skill that is >= 75%, remove it
        return !highSkills.some((h) => lower.includes(h) && (lower.includes('difficult') || lower.includes('faiblesse') || lower.includes('fragil')));
      });
      if (reportData.difficulties.length === 0) {
        reportData.difficulties = ["Aucune difficulté constatée sur les notions évaluées."];
      }
    }

    if (overallScore === 100) {
      reportData.difficulties = ["Aucune difficulté constatée : l'élève a obtenu 100 % de réussite sur les exercices réalisés."];
      reportData.frequentErrors = ["Aucune erreur relevée lors de cette session d'évaluation."];
    }

    const db = getDb();
    const newReport: ReportRecord = {
      id: `rep-${Date.now()}`,
      studentId: studentId || 'unknown',
      studentName: studentName || 'Élève',
      teacherId: 'teacher-solene-depibrac',
      ...reportData,
      createdAt: new Date().toISOString(),
    };

    db.reports.unshift(newReport);
    saveDb(db);

    try {
      await setDoc(doc(firestoreDb, 'reports', newReport.id), newReport);
    } catch (fsErr: any) {
      console.warn('[Firestore] Error saving report:', fsErr?.message);
    }

    return res.json({ success: true, report: newReport, aiModel: 'gemini-3.1-flash-lite' });
  } catch (error) {
    console.error('Gemini report generation error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la génération IA du rapport.' });
  }
});

// ----------------------------------------------------
// NÉO AI COMPANION (GEMINI SOCRATIC ASSISTANT)
// ----------------------------------------------------
app.post('/api/neo/chat', async (req, res) => {
  try {
    const {
      message = '',
      hintLevel = 1,
      actionType = 'chat',
      studentName = 'Élève',
      exerciseContext = {},
      studentProfile = {},
      conversationHistory = [],
    } = req.body;

    const {
      subject = 'Mathématiques',
      skill = 'Général',
      difficulty = 'moyen',
      question = '',
      type = 'qcm',
      options = [],
      userAnswer = '',
      isCorrect,
      correctAnswer = '',
      explanation = '',
    } = exerciseContext;

    // Hint guidelines
    let hintGuidance = '';
    if (actionType === 'hint' || hintLevel) {
      if (hintLevel === 1) {
        hintGuidance = `
MODE INDICE NIVEAU 1 (Petit indice / Piste) :
- Ne donne AUCUN calcul final ni solution.
- Attire simplement l'attention de l'élève sur un mot-clé ou un élément essentiel de l'énoncé.
- Ex: "Regarde bien le dénominateur de chaque fraction..." ou "Pense à ce que représente le mot 'tiers'."`;
      } else if (hintLevel === 2) {
        hintGuidance = `
MODE INDICE NIVEAU 2 (Question guidée) :
- Pose une question simple à l'élève pour qu'il trouve la première étape par lui-même.
- Ex: "Avant de comparer, est-ce que ces deux fractions ont le même dénominateur ? Que pourrais-tu faire ?"`;
      } else if (hintLevel === 3) {
        hintGuidance = `
MODE INDICE NIVEAU 3 (Méthode étape par étape) :
- Rappelle la règle de cours ou la démarche méthodologique de CM2 de façon claire, sans faire le calcul à sa place.
- Ex: "Pour additionner des fractions de même dénominateur, la règle est d'additionner les numérateurs et de garder le dénominateur commun."`;
      } else if (hintLevel === 4) {
        hintGuidance = `
MODE INDICE NIVEAU 4 (Aide détaillée / Déblocage) :
- L'élève est vraiment bloqué. Guide-le pas à pas jusqu'à l'avant-dernière étape, en lui laissant conclure la dernière étape.`;
      }
    }

    const conversationSnippet = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? conversationHistory.map((h: any) => `${h.role === 'user' ? 'Élève' : 'Néo'}: "${h.content}"`).join('\n')
      : 'Aucun échange préalable.';

    const prompt = `
Tu es Néo, la mascotte robotique et le compagnon d'apprentissage préféré des élèves de CM2 sur EduTrain AI.
Identité de Néo :
- Tu es un petit robot bleu, blanc et jaune, très sympathique, souriant et rassurant.
- Tu t'adresses à un enfant de 10-11 ans en classe de CM2 en France nommé "${studentName}".
- Tu utilises le tutoiement bienveillant ("tu"), un ton complice, chaleureux et enthousiaste.
- Utilise quelques emojis appropriés (🤖, 💡, 🌟, 👍, 😊, 🚀).

CONTEXTE DE L'EXERCICE ACTUEL :
- Matière : ${subject}
- Compétence : ${skill} (Niveau CM2, difficulté : ${difficulty})
- Question posée à l'élève : "${question}"
- Type d'exercice : ${type}
- Options proposées : ${JSON.stringify(options)}
- Réponse saisie par l'élève : "${userAnswer || 'Pas encore répondu'}"
- État de validation : ${isCorrect === undefined ? 'En cours de réflexion' : isCorrect ? 'Réussi !' : 'Erreur'}
- Solution attendue (POUR TON INFORMATION SEULEMENT - NE LA RÉVÈLE PAS BRUTALEMENT) : "${correctAnswer}"
- Explication pédagogique associée : "${explanation}"

HISTORIQUE DE LA CONVERSATION POUR CET EXERCICE :
${conversationSnippet}

DEMANDE ACTUELLE DE L'ÉLÈVE :
"${message || `Demande d'indice de niveau ${hintLevel}`}"

ACTION DEMANDÉE : ${actionType} (Indice niveau ${hintLevel})
${hintGuidance}

RÈGLES PÉDAGOGIQUES ABSOLUES :
1. RÈGLE D'OR SOCRATIQUE : Ne donne JAMAIS directement la réponse finale dans le message. Tu dois éveiller la réflexion de l'élève.
2. Si l'élève te dit "Donne-moi la réponse", "C'est quoi la solution ?" ou "Je sais pas", ne cède pas : encourage-le gentiment et pose une question simple pour débloquer la première étape.
3. Vocabulaire adapté au CM2 : pas de jargon de collège ou d'adulte. Phrases courtes et dynamiques.
4. Si l'élève a commis une erreur (${isCorrect === false ? "OUI, il s'est trompé" : "NON"}), reste hyper positif : "Ce n'est pas grave du tout, c'est comme ça qu'on apprend ! Regardons ensemble..."
5. Conserve le fil de la discussion si l'élève réagit à ce que tu as dit précédemment.

FORMAT DE SORTIE JSON STRICT :
{
  "reply": "Ton message d'aide de Néo (2 à 4 phrases dynamiques et pédagogiques)",
  "emotion": "neo-thinking" | "neo-encouraging" | "neo-happy" | "neo-talking" | "neo-celebrating",
  "suggestedFollowUps": ["Court texte bouton 1", "Court texte bouton 2"]
}
`;

    let aiResultText = '';
    try {
      aiResultText = await callGemini(prompt);
      const parsed = JSON.parse(aiResultText);
      return res.json({
        success: true,
        reply: parsed.reply,
        emotion: parsed.emotion || (hintLevel > 2 ? 'neo-encouraging' : 'neo-thinking'),
        suggestedFollowUps: parsed.suggestedFollowUps || ['Explique-moi encore', 'Je crois que j ai trouvé !'],
        hintLevel,
      });
    } catch (geminiError: any) {
      console.warn('[Gemini Néo fallback]', geminiError?.message || geminiError);
      // High-quality smart fallback
      let fallbackReply = `Coucou ${studentName} ! 🤖 Regardons bien la question ensemble. `;
      let fallbackEmotion = 'neo-encouraging';
      const followUps = ['Donne-moi un autre indice', 'Je réessaie tout de suite !'];

      if (actionType === 'hint' || hintLevel === 1) {
        fallbackReply += `Relis attentivement l'énoncé : quelle est l'information la plus importante dans "${question.slice(0, 45)}..." ?`;
        fallbackEmotion = 'neo-thinking';
      } else if (hintLevel === 2) {
        fallbackReply += `Quelle première étape pourrais-tu faire pour cette notion de ${skill} ? Pose-toi la question du sens de ce qu'on te demande !`;
        fallbackEmotion = 'neo-thinking';
      } else if (hintLevel === 3) {
        fallbackReply += `Pense à la méthode qu'on utilise en CM2 : observe bien les détails, décompose le problème en deux petites étapes !`;
        fallbackEmotion = 'neo-encouraging';
      } else {
        fallbackReply += `Tu es tout proche du but ! Revois calmement : ${explanation ? explanation.slice(0, 100) + '...' : 'avance étape par étape !'}`;
        fallbackEmotion = 'neo-celebrating';
      }

      return res.json({
        success: true,
        reply: fallbackReply,
        emotion: fallbackEmotion,
        suggestedFollowUps: followUps,
        hintLevel,
      });
    }
  } catch (err: any) {
    console.error('Error in /api/neo/chat:', err);
    return res.status(500).json({
      success: false,
      reply: 'Bip bip ! 🤖 Néo recharge ses circuits... Peux-tu me reposer ta question ?',
      emotion: 'neo-idle',
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const db = getDb();
  let firestoreStudentsCount = 0;
  try {
    const snap = await getDocs(query(collection(firestoreDb, 'users'), where('role', '==', 'student')));
    firestoreStudentsCount = snap.size;
  } catch (e) {}

  res.json({
    status: 'ok',
    service: 'EduTrain AI CM2',
    teacher: 'Solène De Pibrac',
    localStudentsCount: db.users.filter((u) => u.role === 'student').length,
    firestoreStudentsCount,
    aiModel: 'gemini-3.1-flash-lite',
  });
});

// Setup Vite or static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EduTrain AI Server listening on port ${PORT}`);
});
