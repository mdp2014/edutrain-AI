import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
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
const ai = new GoogleGenAI();

async function callGemini(prompt: string): Promise<string> {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

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

    if (existing) {
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
 * Generate adaptive CM2 exercises with Gemini
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

  const prompt = `
Tu es un concepteur pédagogique expert de l'école primaire française, spécialisé dans le niveau CM2 (enfants de 10-11 ans).
Tu dois créer une série de ${count} exercices personnalisés pour l'élève "${studentName}".

Paramètres de l'élève :
- Classe : CM2 (France)
- Matière : ${subject}
- Compétence ciblée : ${skill}
- Taux de réussite actuel : ${accuracy}%
- Niveau de difficulté : ${difficulty}
- Dernières erreurs observées chez cet élève : ${JSON.stringify(recentErrors)}

Consignes strictes :
1. Les exercices doivent correspondre rigoureusement aux attendus de fin de cycle 3 / CM2 en France.
2. Énoncés clairs, bienveillants et motivants pour un enfant de 10-11 ans.
3. Progression pédagogique : commence par des questions accessibles, puis monte légèrement le niveau.
4. Types de questions variés : "qcm" (avec 3 ou 4 options), "numeric" (réponse sous forme d'un nombre entier ou décimal), "boolean" (Vrai ou Faux), ou "text" (mot ou phrase courte).
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
    console.error('Gemini exercise generation error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la génération IA des exercices.' });
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

Données RÉELLES de l'élève :
- Nombre d'exercices réalisés : ${totalExercises}
- Réussite moyenne globale : ${overallScore}%
- Détail par compétence : ${JSON.stringify(skills)}
- Échantillon des dernières tentatives : ${JSON.stringify(recentAttempts.slice(0, 8))}
- Dernières erreurs constatées : ${JSON.stringify(recentErrors.slice(0, 8))}

Rédige un rapport clair, constructif, professionnel et directement exploitable par l'enseignante de CM2.
Le rapport doit impérativement respecter ce schéma JSON :
{
  "summary": "Synthèse globale de 2 à 4 phrases sur le profil d'apprentissage de l'élève, son engagement et ses résultats généraux.",
  "masteredPoints": [
    "Point fort 1 constaté avec pourcentage ou exemple concret",
    "Point fort 2 constaté"
  ],
  "difficulties": [
    "Difficulté majeure 1 identifiée",
    "Difficulté 2 identifiée"
  ],
  "frequentErrors": [
    "Type d'erreur récurrente observée",
    "Autre erreur observée"
  ],
  "recommendations": [
    "Recommandation concrète pour l'enseignante en classe",
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
