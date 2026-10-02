import { Subject } from '../types';

export const TEACHER_CONFIG = {
  firstName: 'Solène',
  lastName: 'De Pibrac',
  fullName: 'Solène De Pibrac',
  email: 'solene.depibrac@edutrain.fr',
  role: 'teacher' as const,
  className: 'CM2',
  classId: 'class-cm2',
};

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  subject: Subject;
  iconName: string;
}

export const CM2_SUBJECTS: {
  [key in Subject]: {
    name: string;
    description: string;
    skills: SkillDefinition[];
  };
} = {
  Mathématiques: {
    name: 'Mathématiques',
    description: 'Nombres, calculs, géométrie, grandeurs et résolution de problèmes en CM2',
    skills: [
      { id: 'calcul', name: 'Calcul', description: 'Calcul mental et opérations posées', subject: 'Mathématiques', iconName: 'Calculator' },
      { id: 'fractions', name: 'Fractions', description: 'Comparer, ordonner et décomposer des fractions', subject: 'Mathématiques', iconName: 'PieChart' },
      { id: 'problemes', name: 'Problèmes', description: 'Problèmes mathématiques à plusieurs étapes', subject: 'Mathématiques', iconName: 'HelpCircle' },
      { id: 'nombres-decimaux', name: 'Nombres décimaux', description: 'Placer, comparer et calculer avec les décimaux', subject: 'Mathématiques', iconName: 'Hash' },
      { id: 'geometrie', name: 'Géométrie', description: 'Figures planes, angles, polygones et périmètres', subject: 'Mathématiques', iconName: 'Shapes' },
      { id: 'mesures', name: 'Mesures & Grandeurs', description: 'Unités de longueur, masse, contenance et durées', subject: 'Mathématiques', iconName: 'Ruler' },
      { id: 'operations', name: 'Opérations', description: 'Multiplications complexes et divisions euclidiennes', subject: 'Mathématiques', iconName: 'Percent' },
      { id: 'proportionnalite', name: 'Proportionnalité', description: 'Tableaux de proportionnalité et pourcentages simples', subject: 'Mathématiques', iconName: 'TrendingUp' },
      { id: 'logique', name: 'Logique & Réflexion', description: 'Énigmes mathématiques et déduction', subject: 'Mathématiques', iconName: 'Lightbulb' },
    ],
  },
  Français: {
    name: 'Français',
    description: 'Maîtrise de la langue, grammaire, conjugaison, orthographe et lecture en CM2',
    skills: [
      { id: 'grammaire', name: 'Grammaire', description: 'Nature des mots, sujet, verbe, COD, COI, compléments circonstanciels', subject: 'Français', iconName: 'BookOpen' },
      { id: 'conjugaison', name: 'Conjugaison', description: 'Présent, futur, imparfait, passé composé, passé simple', subject: 'Français', iconName: 'Clock' },
      { id: 'orthographe', name: 'Orthographe', description: 'Accords sujet-verbe, accord dans le groupe nominal, homophones', subject: 'Français', iconName: 'CheckSquare' },
      { id: 'vocabulaire', name: 'Vocabulaire', description: 'Synonymes, antonymes, familles de mots, préfixes et suffixes', subject: 'Français', iconName: 'Languages' },
      { id: 'comprehension', name: 'Compréhension de texte', description: 'Lire et comprendre un texte littéraire ou informatif', subject: 'Français', iconName: 'FileText' },
      { id: 'redaction', name: 'Rédaction & Syntaxe', description: 'Construction de phrases complexes et ponctuation', subject: 'Français', iconName: 'Edit3' },
    ],
  },
};
