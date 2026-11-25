import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateProceduralExercise } from './src/lib/proceduralGenerator.ts';

// Load public dev config (.env.local) and host environment (.env)
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// SUPABASE SERVER CONFIGURATION
// ---------------------------------------------------------------------------
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function createUserSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

interface AuthenticatedContext {
  authUserId: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'teacher' | 'student';
    class_id: string;
    class_name: string;
    created_at: string;
  };
  client: SupabaseClient;
}

/**
 * Verifies the caller's Supabase Auth JWT and loads their public.users profile
 */
async function getAuthenticatedContext(req: express.Request): Promise<AuthenticatedContext | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const userClient = createUserSupabaseClient(token);
  const { data: authData, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !authData?.user) return null;

  const { data: profile, error: profErr } = await userClient
    .from('users')
    .select('id, first_name, last_name, email, role, class_id, class_name, created_at')
    .eq('auth_id', authData.user.id)
    .maybeSingle();

  if (profErr || !profile) return null;

  return {
    authUserId: authData.user.id,
    profile: profile as AuthenticatedContext['profile'],
    client: userClient,
  };
}

// ---------------------------------------------------------------------------
// GEMINI AI CLIENT
// ---------------------------------------------------------------------------
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
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Gemini AI] Model ${model} error:`, err?.status || err?.message || err);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw new Error('Tous les modèles Gemini ont échoué.');
}

// ---------------------------------------------------------------------------
// AUTH & ADMIN ROUTES (SUPABASE)
// ---------------------------------------------------------------------------

/**
 * Fallback student registration with auto-confirmed email when SUPABASE_SERVICE_ROLE_KEY is configured
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Désactivez « Confirm email » dans Supabase (Authentication → Providers → Email) ou configurez SUPABASE_SERVICE_ROLE_KEY sur le serveur.',
      });
    }

    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!firstName || !lastName || firstName.length > 64 || lastName.length > 64) {
      return res.status(400).json({ success: false, error: 'Prénom et nom valides requis.' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit comporter entre 6 et 128 caractères.',
      });
    }

    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const email = `${sanitize(firstName)}.${sanitize(lastName)}@cm2.edutrain.fr`;

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Un compte avec ce prénom et ce nom existe déjà. Veuillez vous connecter.',
      });
    }

    const { data: authCreated, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'student',
      },
    });

    if (authErr || !authCreated?.user) {
      return res.status(400).json({
        success: false,
        error: authErr?.message || 'Impossible de créer le compte Auth.',
      });
    }

    const studentId = `student-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({
        id: studentId,
        auth_id: authCreated.user.id,
        first_name: firstName,
        last_name: lastName,
        email,
        role: 'student',
        class_id: 'class-cm2',
        class_name: 'CM2',
      })
      .select('id, first_name, last_name, email, role, class_id, class_name, created_at')
      .single();

    if (insertErr || !inserted) {
      await supabaseAdmin.auth.admin.deleteUser(authCreated.user.id);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du profil élève.',
      });
    }

    return res.json({
      success: true,
      user: {
        id: inserted.id,
        firstName: inserted.first_name,
        lastName: inserted.last_name,
        email: inserted.email,
        role: inserted.role,
        classId: inserted.class_id,
        className: inserted.class_name,
        createdAt: inserted.created_at,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur lors de la création du compte.' });
  }
});

/**
 * Update a student's password (Teacher only, requires SUPABASE_SERVICE_ROLE_KEY on server)
 */
app.post('/api/students/:id/password', async (req, res) => {
  try {
    const auth = await getAuthenticatedContext(req);
    if (!auth || auth.profile.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Accès réservé à l’enseignante.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Configurez SUPABASE_SERVICE_ROLE_KEY dans les secrets serveur pour réinitialiser le mot de passe d’un élève.',
      });
    }

    const studentId = String(req.params.id || '').trim();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!studentId || newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.',
      });
    }

    const { data: student, error: findErr } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, role')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle();

    if (findErr || !student || !student.auth_id) {
      return res.status(404).json({ success: false, error: 'Compte élève introuvable.' });
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(student.auth_id, {
      password: newPassword,
    });

    if (updateErr) {
      return res.status(500).json({ success: false, error: updateErr.message });
    }

    return res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    console.error('Error modifying student password:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la modification du mot de passe.' });
  }
});

/**
 * Delete a student completely (Teacher only)
 */
app.delete('/api/students/:id', async (req, res) => {
  try {
    const auth = await getAuthenticatedContext(req);
    if (!auth || auth.profile.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Accès réservé à l’enseignante.' });
    }

    const studentId = String(req.params.id || '').trim();
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Identifiant élève manquant.' });
    }

    const dbClient = supabaseAdmin || auth.client;
    const { data: target } = await dbClient
      .from('users')
      .select('id, auth_id, role')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle();

    const { error: delErr } = await dbClient
      .from('users')
      .delete()
      .eq('id', studentId)
      .eq('role', 'student');

    if (delErr) {
      return res.status(500).json({ success: false, error: delErr.message });
    }

    if (supabaseAdmin && target?.auth_id) {
      await supabaseAdmin.auth.admin.deleteUser(target.auth_id);
    }

    return res.json({ success: true, message: 'Élève supprimé avec succès.' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ success: false, error: "Erreur lors de la suppression de l'élève." });
  }
});

/**
 * Clear all student data while keeping the teacher account intact (Teacher only)
 */
app.post('/api/admin/clear-database', async (req, res) => {
  try {
    const auth = await getAuthenticatedContext(req);
    if (!auth || auth.profile.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Accès réservé à l’enseignante.' });
    }

    const dbClient = supabaseAdmin || auth.client;

    const { data: students } = await dbClient
      .from('users')
      .select('id, auth_id')
      .eq('role', 'student');

    await dbClient.from('reports').delete().neq('id', '');
    await dbClient.from('progress').delete().neq('id', '');
    await dbClient.from('attempts').delete().neq('id', '');
    const { error: userDelErr } = await dbClient.from('users').delete().eq('role', 'student');

    if (userDelErr) {
      return res.status(500).json({ success: false, error: userDelErr.message });
    }

    if (supabaseAdmin && Array.isArray(students)) {
      for (const st of students) {
        if (st.auth_id) {
          await supabaseAdmin.auth.admin.deleteUser(st.auth_id).catch(() => {});
        }
      }
    }

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

// ---------------------------------------------------------------------------
// REAL GEMINI AI INTEGRATION (AUTHENTICATED)
// ---------------------------------------------------------------------------

/**
 * Generate a single real-time adaptive CM2 exercise with Gemini
 */
app.post('/api/generate-adaptive-exercise', async (req, res) => {
  const auth = await getAuthenticatedContext(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Authentification requise.' });
  }

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
  } = req.body || {};

  // Students can only query their own history; teacher can inspect any student
  const targetStudentId =
    auth.profile.role === 'teacher' && typeof studentId === 'string' && studentId
      ? studentId
      : auth.profile.id;

  let pastSkillAttempts: Array<{ question: string; is_correct: boolean }> = [];
  try {
    const { data } = await auth.client
      .from('attempts')
      .select('question, is_correct')
      .eq('student_id', targetStudentId)
      .eq('skill', String(skill))
      .order('created_at', { ascending: false })
      .limit(20);
    if (Array.isArray(data)) {
      pastSkillAttempts = data;
    }
  } catch (err) {
    console.warn('[Supabase] Error reading past attempts for adaptive exercise:', err);
  }

  const totalSkillAttempts = pastSkillAttempts.length;
  const correctSkillAttempts = pastSkillAttempts.filter((a) => a.is_correct).length;
  const currentSkillScore =
    totalSkillAttempts > 0 ? Math.round((correctSkillAttempts / totalSkillAttempts) * 100) : 70;

  let difficulty =
    requestedDifficulty || (currentSkillScore >= 80 ? 'difficile' : currentSkillScore < 60 ? 'facile' : 'moyen');

  let adaptationContext = '';
  if (lastAttempt) {
    if (!lastAttempt.isCorrect) {
      if (difficulty === 'difficile') difficulty = 'moyen';
      else if (difficulty === 'moyen') difficulty = 'facile';

      adaptationContext = `
ÉLÉMENT CRUCIAL D'ADAPTATION PÉDAGOGIQUE (L'ÉLÈVE VIENT D'ÉCHOUER SUR LA QUESTION PRÉCÉDENTE) :
- Question précédente ratée : "${lastAttempt.question}"
- Réponse incorrecte saisie par l'élève : "${lastAttempt.answer}"
- Réponse attendue : "${lastAttempt.correctAnswer}"
- OBJECTIF DE CETTE NOUVELLE QUESTION : Proposer une question de REMÉDIATION immédiate et bienveillante sur la même notion. La question doit décomposer la difficulté, proposer une approche plus visuelle ou concrète, et redonner confiance à l'élève avec un niveau de difficulté adapté (${difficulty}).`;
    } else {
      if (difficulty === 'facile' && questionIndex >= 2) difficulty = 'moyen';
      else if (difficulty === 'moyen' && questionIndex >= 3) difficulty = 'difficile';

      adaptationContext = `
ÉLÉMENT CRUCIAL D'ADAPTATION PÉDAGOGIQUE (L'ÉLÈVE A RÉUSSI LA QUESTION PRÉCÉDENTE) :
- Question précédente réussie : "${lastAttempt.question}"
- OBJECTIF DE CETTE NOUVELLE QUESTION : L'élève progresse bien ! Propose un exercice qui approfondit la compétence avec un angle nouveau, des nombres différents ou un problème stimulant de niveau ${difficulty}, sans refaire la même chose.`;
    }
  }

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
- Compétences maîtrisées (points forts) : ${Array.isArray(strongSkills) && strongSkills.length > 0 ? strongSkills.join(', ') : "En cours d'évaluation"}
- Compétences à consolider (points faibles) : ${Array.isArray(weakSkills) && weakSkills.length > 0 ? weakSkills.join(', ') : 'Aucune fragilité majeure'}
- Erreurs récentes constatées : ${Array.isArray(recentMistakes) && recentMistakes.length > 0 ? JSON.stringify(recentMistakes.slice(0, 3)) : 'Aucune'}`;

  const allHistory = Array.from(
    new Set([
      ...(Array.isArray(historyQuestions) ? historyQuestions : []),
      ...pastSkillAttempts.map((a) => a.question).slice(0, 10),
    ])
  );

  const historyWarning =
    allHistory.length > 0
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
- Position dans la session : Question ${Number(questionIndex) + 1} sur 5

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

    if (exercise.type === 'qcm') {
      if (!Array.isArray(exercise.options)) {
        exercise.options = [exercise.correctAnswer, 'Choix 2', 'Choix 3'];
      } else if (!exercise.options.includes(exercise.correctAnswer)) {
        exercise.options.unshift(exercise.correctAnswer);
      }
      exercise.options.sort(() => Math.random() - 0.5);
    }

    return res.json({ success: true, exercise, aiModel: 'gemini-3.1-flash-lite' });
  } catch (error: any) {
    console.warn('[Gemini Adaptive Fallback] Utilisation du générateur procédural:', error?.message);
    const fallbackEx = generateProceduralExercise(
      subject as any,
      String(skill),
      difficulty as any,
      String(studentName),
      allHistory
    );
    return res.json({ success: true, exercise: fallbackEx, aiModel: 'procedural-fallback' });
  }
});

/**
 * Generate adaptive CM2 exercises batch with Gemini
 */
app.post('/api/generate-exercises', async (req, res) => {
  const auth = await getAuthenticatedContext(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Authentification requise.' });
  }

  const {
    studentName = 'Élève',
    subject = 'Mathématiques',
    skill = 'Fractions',
    difficulty = 'facile',
    count = 5,
    accuracy = 0,
    recentErrors = [],
  } = req.body || {};

  const safeCount = Math.min(Math.max(Number(count) || 5, 1), 10);

  let difficultyGuidelines = '';
  if (difficulty === 'difficile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU DIFFICILE (Approfondissement & Défi pour élève très performant avec >= 85% de réussite) :
- L'élève maîtrise déjà les bases fondamentales. Propose des exercices stimulants de fin de CM2 / Cycle 3.`;
  } else if (difficulty === 'facile') {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU FACILE (Remédiation bienveillante pour élève en difficulté avec < 60% de réussite) :
- Propose des questions très claires, visuelles et accessibles.`;
  } else {
    difficultyGuidelines = `
EXIGENCE STRICTE - NIVEAU MOYEN (Consolidation standard de niveau CM2 pour réussite entre 60% et 84%) :
- Exercices équilibrés correspondant au niveau moyen attendu en cours d'année de CM2.`;
  }

  const prompt = `
Tu es un concepteur pédagogique expert de l'école primaire française, spécialisé dans le niveau CM2 (enfants de 10-11 ans).
Tu dois créer une série de ${safeCount} exercices personnalisés pour l'élève "${studentName}".

Paramètres de l'élève :
- Classe : CM2 (France)
- Matière : ${subject}
- Compétence ciblée : ${skill}
- Taux de réussite évalué : ${accuracy}%
- Niveau de difficulté ciblé : ${difficulty}
- Dernières erreurs de l'élève : ${JSON.stringify(recentErrors)}

${difficultyGuidelines}

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
    "correctAnswer": "La réponse exacte attendue",
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
    const proceduralList = Array.from({ length: safeCount }, () =>
      generateProceduralExercise(subject as any, String(skill), difficulty as any, String(studentName))
    );
    return res.json({ success: true, exercises: proceduralList, aiModel: 'procedural-fallback' });
  }
});

/**
 * Generate a detailed pedagogical report for the teacher with Gemini and persist in Supabase
 */
app.post('/api/generate-report', async (req, res) => {
  const auth = await getAuthenticatedContext(req);
  if (!auth || auth.profile.role !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Accès réservé à l’enseignante.' });
  }

  const {
    studentId,
    studentName,
    totalExercises = 0,
    overallScore = 0,
    skills = {},
    recentAttempts = [],
    recentErrors = [],
  } = req.body || {};

  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ success: false, error: 'Identifiant élève requis.' });
  }

  const prompt = `
Tu es un conseiller pédagogique de l'Éducation Nationale française.
Tu rédiges un rapport d'évaluation diagnostique pour Solène De Pibrac, professeure des écoles en classe de CM2.
Le rapport concerne l'élève : "${studentName}".

Données RÉELLES et PRÉCISES de l'élève :
- Nombre d'exercices réalisés : ${totalExercises}
- Réussite moyenne globale : ${overallScore}%
- Détail par compétence (scores réels) : ${JSON.stringify(skills)}
- Échantillon des dernières tentatives : ${JSON.stringify(Array.isArray(recentAttempts) ? recentAttempts.slice(0, 8) : [])}
- Dernières erreurs constatées : ${JSON.stringify(Array.isArray(recentErrors) ? recentErrors.slice(0, 8) : [])}

RÈGLES ABSOLUES ET VITALES D'EXACTITUDE :
1. Une compétence avec un taux de réussite >= 75% ou 100% est un POINT FORT INCONTESTABLE. Elle DOIT OBLIGATOIREMENT figurer dans 'masteredPoints'.
2. IL EST STRICTEMENT INTERDIT de classer une compétence ayant >= 75% ou 100% de réussite dans 'difficulties' ou 'frequentErrors'.
3. Si l'élève a 100% de réussite globale ou 0 erreur, 'difficulties' DOIT contenir ["Aucune difficulté constatée : l'élève a réussi l'ensemble des exercices avec brio."] et 'frequentErrors' DOIT valoir ["Aucune erreur récurrente constatée lors des évaluations."].
4. Dans ce cas de réussite totale, les recommandations doivent porter sur l'approfondissement et des défis de niveau supérieur.

Le rapport doit impérativement respecter ce schéma JSON :
{
  "summary": "Synthèse globale de 2 à 4 phrases...",
  "masteredPoints": ["Point fort 1", "Point fort 2"],
  "difficulties": ["Difficulté réelle constatée"],
  "frequentErrors": ["Type d'erreur récurrente observée"],
  "recommendations": ["Recommandation concrète 1", "Conseil d'entraînement 2"],
  "nextSteps": ["Action pédagogique 1", "Action pédagogique 2"]
}
`;

  try {
    const text = await callGemini(prompt);
    const reportData = JSON.parse(text);

    const highSkills = Object.entries(skills)
      .filter(([_, score]) => Number(score) >= 75)
      .map(([name]) => name.toLowerCase());

    if (reportData.difficulties && Array.isArray(reportData.difficulties)) {
      reportData.difficulties = reportData.difficulties.filter((diff: string) => {
        const lower = diff.toLowerCase();
        return !highSkills.some(
          (h) => lower.includes(h) && (lower.includes('difficult') || lower.includes('faiblesse') || lower.includes('fragil'))
        );
      });
      if (reportData.difficulties.length === 0) {
        reportData.difficulties = ['Aucune difficulté constatée sur les notions évaluées.'];
      }
    }

    if (overallScore === 100) {
      reportData.difficulties = ["Aucune difficulté constatée : l'élève a obtenu 100 % de réussite sur les exercices réalisés."];
      reportData.frequentErrors = ["Aucune erreur relevée lors de cette session d'évaluation."];
    }

    const newReport = {
      id: `rep-${Date.now()}`,
      studentId,
      studentName: String(studentName || 'Élève'),
      teacherId: auth.profile.id,
      summary: String(reportData.summary || ''),
      masteredPoints: Array.isArray(reportData.masteredPoints) ? reportData.masteredPoints : [],
      difficulties: Array.isArray(reportData.difficulties) ? reportData.difficulties : [],
      frequentErrors: Array.isArray(reportData.frequentErrors) ? reportData.frequentErrors : [],
      recommendations: Array.isArray(reportData.recommendations) ? reportData.recommendations : [],
      nextSteps: Array.isArray(reportData.nextSteps) ? reportData.nextSteps : [],
      createdAt: new Date().toISOString(),
    };

    const { error: saveErr } = await auth.client.from('reports').insert({
      id: newReport.id,
      student_id: newReport.studentId,
      student_name: newReport.studentName,
      teacher_id: newReport.teacherId,
      summary: newReport.summary,
      mastered_points: newReport.masteredPoints,
      difficulties: newReport.difficulties,
      frequent_errors: newReport.frequentErrors,
      recommendations: newReport.recommendations,
      next_steps: newReport.nextSteps,
      created_at: newReport.createdAt,
    });

    if (saveErr) {
      console.warn('[Supabase] Error saving generated report:', saveErr.message);
    }

    return res.json({ success: true, report: newReport, aiModel: 'gemini-3.1-flash-lite' });
  } catch (error) {
    console.error('Gemini report generation error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la génération IA du rapport.' });
  }
});

// ---------------------------------------------------------------------------
// NÉO AI COMPANION (GEMINI SOCRATIC ASSISTANT)
// ---------------------------------------------------------------------------
app.post('/api/neo/chat', async (req, res) => {
  try {
    const auth = await getAuthenticatedContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        reply: 'Connecte-toi pour discuter avec Néo !',
        emotion: 'neo-idle',
      });
    }

    const {
      message = '',
      hintLevel = 1,
      actionType = 'chat',
      studentName = 'Élève',
      exerciseContext = {},
      conversationHistory = [],
    } = req.body || {};

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

    let hintGuidance = '';
    if (actionType === 'hint' || hintLevel) {
      if (hintLevel === 1) {
        hintGuidance = `
MODE INDICE NIVEAU 1 (Petit indice / Piste) :
- Ne donne AUCUN calcul final ni solution.
- Attire simplement l'attention de l'élève sur un mot-clé ou un élément essentiel de l'énoncé.`;
      } else if (hintLevel === 2) {
        hintGuidance = `
MODE INDICE NIVEAU 2 (Question guidée) :
- Pose une question simple à l'élève pour qu'il trouve la première étape par lui-même.`;
      } else if (hintLevel === 3) {
        hintGuidance = `
MODE INDICE NIVEAU 3 (Méthode étape par étape) :
- Rappelle la règle de cours ou la démarche méthodologique de CM2 de façon claire, sans faire le calcul à sa place.`;
      } else if (hintLevel === 4) {
        hintGuidance = `
MODE INDICE NIVEAU 4 (Aide détaillée / Déblocage) :
- L'élève est vraiment bloqué. Guide-le pas à pas jusqu'à l'avant-dernière étape, en lui laissant conclure la dernière étape.`;
      }
    }

    const conversationSnippet =
      Array.isArray(conversationHistory) && conversationHistory.length > 0
        ? conversationHistory.map((h: any) => `${h.role === 'user' ? 'Élève' : 'Néo'}: "${h.content}"`).join('\n')
        : 'Aucun échange préalable.';

    const prompt = `
Tu es Néo, la mascotte robotique et le compagnon d'apprentissage préféré des élèves de CM2 sur EduTrain AI.
Identité de Néo :
- Tu es un petit robot bleu, blanc et jaune, très sympathique, souriant et rassurant.
- Tu t'adresses à un enfant de 10-11 ans en classe de CM2 en France nommé "${studentName}".
- Tu utilises le tutoiement bienveillant ("tu"), un ton complice, chaleureux et enthousiaste.

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
1. RÈGLE D'OR SOCRATIQUE : Ne donne JAMAIS directement la réponse finale dans le message.
2. Si l'élève demande la réponse directement, encourage-le gentiment et pose une question simple pour débloquer la première étape.
3. Vocabulaire adapté au CM2 : phrases courtes et dynamiques.
4. Si l'élève a commis une erreur (${isCorrect === false ? "OUI, il s'est trompé" : 'NON'}), reste très positif.

FORMAT DE SORTIE JSON STRICT :
{
  "reply": "Ton message d'aide de Néo (2 à 4 phrases dynamiques et pédagogiques)",
  "emotion": "neo-thinking" | "neo-encouraging" | "neo-happy" | "neo-talking" | "neo-celebrating",
  "suggestedFollowUps": ["Court texte bouton 1", "Court texte bouton 2"]
}
`;

    try {
      const aiResultText = await callGemini(prompt);
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
      let fallbackReply = `Coucou ${studentName} ! 🤖 Regardons bien la question ensemble. `;
      let fallbackEmotion = 'neo-encouraging';
      const followUps = ['Donne-moi un autre indice', 'Je réessaie tout de suite !'];

      if (actionType === 'hint' || hintLevel === 1) {
        fallbackReply += `Relis attentivement l'énoncé : quelle est l'information la plus importante dans "${String(question).slice(0, 45)}..." ?`;
        fallbackEmotion = 'neo-thinking';
      } else if (hintLevel === 2) {
        fallbackReply += `Quelle première étape pourrais-tu faire pour cette notion de ${skill} ?`;
        fallbackEmotion = 'neo-thinking';
      } else if (hintLevel === 3) {
        fallbackReply += `Pense à la méthode qu'on utilise en CM2 : décompose le problème en deux petites étapes !`;
        fallbackEmotion = 'neo-encouraging';
      } else {
        fallbackReply += `Tu es tout proche du but ! Revois calmement : ${explanation ? String(explanation).slice(0, 100) + '...' : 'avance étape par étape !'}`;
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
  } catch (err) {
    console.error('Error in /api/neo/chat:', err);
    return res.status(500).json({
      success: false,
      reply: 'Bip bip ! 🤖 Néo recharge ses circuits... Peux-tu me reposer ta question ?',
      emotion: 'neo-idle',
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'EduTrain AI CM2',
    database: 'supabase',
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    adminConfigured: Boolean(supabaseAdmin),
    aiModel: 'gemini-3.1-flash-lite',
  });
});

// Setup Vite or static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
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
  console.log(`EduTrain AI Server (Supabase) listening on port ${PORT}`);
});
