import { UserProfile, ExerciseItem, Attempt, StudentProgress, ClassInfo, TeacherReport } from '../types';
import { TEACHER_CONFIG } from './constants';

export const DEMO_TEACHER: UserProfile = {
  id: 'teacher-solene-depibrac',
  email: TEACHER_CONFIG.email,
  firstName: TEACHER_CONFIG.firstName,
  lastName: TEACHER_CONFIG.lastName,
  role: 'teacher',
  classId: TEACHER_CONFIG.classId,
  className: TEACHER_CONFIG.className,
  createdAt: '2026-09-01T08:00:00.000Z',
};

export const DEMO_CLASS: ClassInfo = {
  id: TEACHER_CONFIG.classId,
  name: 'CM2',
  teacherId: DEMO_TEACHER.id,
  teacherName: TEACHER_CONFIG.fullName,
  studentCount: 0,
  averageSuccessRate: 0,
  totalExercisesCompleted: 0,
  createdAt: '2026-09-01T08:00:00.000Z',
};

// ZERO fake students: only real students registered by the user
export const DEMO_STUDENTS: UserProfile[] = [];

// Curricular starter exercises for CM2 that Gemini or the user can practice with
export const INITIAL_EXERCISES: ExerciseItem[] = [
  // FRACTIONS - FACILE (Remédiation / Bases)
  {
    id: 'ex-frac-facile-1',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'facile',
    question: 'Si on partage une pizza en 4 parts égales et qu\'on en mange 1 part, quelle fraction de la pizza a-t-on mangée ?',
    type: 'qcm',
    options: ['1/2', '1/4', '3/4', '4/1'],
    correctAnswer: '1/4',
    explanation: 'Le dénominateur (4) indique le nombre total de parts égales, et le numérateur (1) indique la part mangée : 1/4.',
  },
  {
    id: 'ex-frac-facile-2',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'facile',
    question: 'Quelle fraction correspond à la moitié d\'une quantité ?',
    type: 'qcm',
    options: ['1/4', '1/3', '1/2', '2/1'],
    correctAnswer: '1/2',
    explanation: 'La moitié correspond exactement à 1 part sur 2, soit la fraction 1/2.',
  },
  // FRACTIONS - MOYEN (Consolidation CM2)
  {
    id: 'ex-frac-moyen-1',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'moyen',
    question: 'Quelle fraction est la plus grande entre 1/2 et 3/4 ?',
    type: 'qcm',
    options: ['1/2', '3/4', 'Elles sont égales'],
    correctAnswer: '3/4',
    explanation: '1/2 = 2/4. Or 3/4 est strictement supérieur à 2/4. Donc 3/4 est la plus grande.',
  },
  {
    id: 'ex-frac-moyen-2',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'moyen',
    question: 'Quelle fraction est égale à 2/4 ?',
    type: 'qcm',
    options: ['1/3', '1/2', '3/6', '4/6'],
    correctAnswer: '1/2',
    explanation: 'En simplifiant par 2 le numérateur et le dénominateur : 2/4 = (2÷2)/(4÷2) = 1/2.',
  },
  // FRACTIONS - DIFFICILE (Approfondissement & Défi)
  {
    id: 'ex-frac-difficile-1',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'difficile',
    question: 'Comment décomposer la fraction 7/4 sous la forme d\'un entier plus une fraction inférieure à 1 ?',
    type: 'qcm',
    options: ['1 + 3/4', '2 + 1/4', '1 + 1/4', '3 + 1/4'],
    correctAnswer: '1 + 3/4',
    explanation: '7/4 = 4/4 + 3/4 = 1 + 3/4 car 4/4 vaut 1 unité complète.',
  },
  {
    id: 'ex-frac-difficile-2',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'difficile',
    question: 'Entre quels deux nombres entiers consécutifs se situe la fraction 11/3 ?',
    type: 'qcm',
    options: ['2 et 3', '3 et 4', '4 et 5', '10 et 12'],
    correctAnswer: '3 et 4',
    explanation: '11 divisé par 3 vaut 3 avec un reste de 2 (3 × 3 = 9 et 3 × 4 = 12). Donc 3 < 11/3 < 4.',
  },
  {
    id: 'ex-frac-difficile-3',
    subject: 'Mathématiques',
    skill: 'Fractions',
    difficulty: 'difficile',
    question: 'Calcule : 3/10 + 25/100. Quelle est la fraction décimale obtenue sur 100 ?',
    type: 'qcm',
    options: ['28/100', '55/100', '28/110', '35/100'],
    correctAnswer: '55/100',
    explanation: 'On met au même dénominateur : 3/10 = 30/100. Puis 30/100 + 25/100 = 55/100.',
  },

  // CALCUL - FACILE, MOYEN, DIFFICILE
  {
    id: 'ex-calc-1',
    subject: 'Mathématiques',
    skill: 'Calcul',
    difficulty: 'facile',
    question: 'Combien font 35 × 10 ?',
    type: 'numeric',
    correctAnswer: '350',
    explanation: 'Pour multiplier un nombre entier par 10, on ajoute un 0 à sa droite : 35 × 10 = 350.',
  },
  {
    id: 'ex-calc-2',
    subject: 'Mathématiques',
    skill: 'Calcul',
    difficulty: 'moyen',
    question: 'Calcule mentalement : 25 × 4 = ?',
    type: 'numeric',
    correctAnswer: '100',
    explanation: '25 × 4 est un calcul repère indispensable en CM2 : 25 + 25 + 25 + 25 = 100.',
  },
  {
    id: 'ex-calc-3',
    subject: 'Mathématiques',
    skill: 'Calcul',
    difficulty: 'difficile',
    question: 'Calcule mentalement : (15 × 6) + (120 ÷ 4) = ?',
    type: 'numeric',
    correctAnswer: '120',
    explanation: '15 × 6 = 90. Et 120 ÷ 4 = 30. Donc 90 + 30 = 120.',
  },

  // PROBLÈMES
  {
    id: 'ex-prob-1',
    subject: 'Mathématiques',
    skill: 'Problèmes',
    difficulty: 'moyen',
    question: 'Léa achète 3 livres à 8 € chacun et un carnet à 5 €. Elle paie avec un billet de 50 €. Combien lui rend-on ?',
    type: 'numeric',
    correctAnswer: '21',
    explanation: 'Total des achats : (3 × 8) + 5 = 24 + 5 = 29 €. Monnaie rendue : 50 - 29 = 21 €.',
  },
  {
    id: 'ex-prob-2',
    subject: 'Mathématiques',
    skill: 'Problèmes',
    difficulty: 'difficile',
    question: 'Un fleuriste prépare 8 bouquets de 12 roses chacun. Il lui reste 16 roses non utilisées. Combien de roses avait-il au départ ?',
    type: 'numeric',
    correctAnswer: '112',
    explanation: '8 bouquets de 12 roses = 8 × 12 = 96 roses. Total initial = 96 + 16 = 112 roses.',
  },

  // GÉOMÉTRIE & FRANÇAIS
  {
    id: 'ex-geom-1',
    subject: 'Mathématiques',
    skill: 'Géométrie',
    difficulty: 'facile',
    question: 'Combien d\'angles droits possède un rectangle ?',
    type: 'numeric',
    correctAnswer: '4',
    explanation: 'Par définition, un rectangle possède toujours 4 angles droits.',
  },
  {
    id: 'ex-gram-1',
    subject: 'Français',
    skill: 'Grammaire',
    difficulty: 'facile',
    question: 'Dans la phrase « Le jeune lion bondit agilement », quelle est la classe grammaticale de « agilement » ?',
    type: 'qcm',
    options: ['Un verbe', 'Un adverbe', 'Un adjectif', 'Un nom commun'],
    correctAnswer: 'Un adverbe',
    explanation: '« Agilement » est un adverbe de manière qui modifie le sens du verbe bondir.',
  },
  {
    id: 'ex-conj-1',
    subject: 'Français',
    skill: 'Conjugaison',
    difficulty: 'moyen',
    question: 'Conjugue le verbe « chanter » au futur avec « nous » : Nous ...',
    type: 'qcm',
    options: ['chantons', 'chanterons', 'chantions', 'chanteront'],
    correctAnswer: 'chanterons',
    explanation: 'Au futur simple, la terminaison avec « nous » est « -ons » ajoutée à l\'infinitif : nous chanterons.',
  },
  {
    id: 'ex-ortho-1',
    subject: 'Français',
    skill: 'Orthographe',
    difficulty: 'moyen',
    question: 'Complète : « Les élèves ... réjouis de leurs résultats. »',
    type: 'qcm',
    options: ['son', 'sont', 'sons'],
    correctAnswer: 'sont',
    explanation: '« Sont » est le verbe être au présent (remplaçable par « étaient » : les élèves étaient réjouis).',
  },
];

// ZERO fake attempts: only real attempts performed by actual students
export const DEMO_ATTEMPTS: Attempt[] = [];

// ZERO fake progress: real students start with 0% and empty progress
export const DEMO_PROGRESS: StudentProgress[] = [];

// ZERO fake reports: only real reports generated by Solène
export const DEMO_REPORT: TeacherReport | null = null;
