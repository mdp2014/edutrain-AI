import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import {
  getStudentAttempts,
  getStudentProgress,
  getExercises,
  callGeminiGenerateExercises,
} from '../../lib/dataService';
import {
  Attempt,
  StudentProgress,
  ExerciseItem,
  Subject,
  Difficulty,
} from '../../types';
import { CM2_SUBJECTS, TEACHER_CONFIG } from '../../lib/constants';
import { ExerciseRunner } from './ExerciseRunner';
import {
  BookOpen,
  PieChart,
  History,
  User,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  LogOut,
  GraduationCap,
  Play,
  RotateCw,
} from 'lucide-react';

export const StudentView: React.FC = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'home' | 'exercises' | 'progress' | 'history' | 'profile'>('home');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [progressList, setProgressList] = useState<StudentProgress[]>([]);
  const [activeExerciseSession, setActiveExerciseSession] = useState<ExerciseItem[] | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genMessage, setGenMessage] = useState<string>('');

  // Selected subject for "Mes exercices" tab
  const [selectedSubject, setSelectedSubject] = useState<Subject>('Mathématiques');

  // Load student data
  const loadData = async () => {
    if (!user) return;
    const [attList, progList] = await Promise.all([
      getStudentAttempts(user.id),
      getStudentProgress(user.id),
    ]);
    setAttempts(attList);
    setProgressList(progList);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Compute metrics strictly from real attempts
  const totalExercises = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const overallSuccess = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;

  // Identify weak skills for "À travailler" from real progress
  const weakSkills = progressList
    .filter((p) => p.totalAttempts > 0 && p.score < 75)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Default suggested skills to start with if new student
  const displayWeakSkills = weakSkills.length > 0 ? weakSkills : [
    { skill: 'Fractions', score: 0, subject: 'Mathématiques' as Subject, isNew: true },
    { skill: 'Calcul', score: 0, subject: 'Mathématiques' as Subject, isNew: true },
    { skill: 'Problèmes', score: 0, subject: 'Mathématiques' as Subject, isNew: true },
  ];

  // Recommended exercise: primary weak skill or fractions
  const recommendedSkill = displayWeakSkills[0] || {
    skill: 'Fractions',
    score: 0,
    subject: 'Mathématiques' as Subject,
    isNew: true,
  };

  /**
   * Start an exercise session with preset or Gemini-generated exercises
   */
  const startExerciseSession = async (
    subject: Subject,
    skill: string,
    forcedDifficulty?: Difficulty,
    useGemini = true
  ) => {
    setIsGenerating(true);
    setGenMessage(`Gemini prépare 5 exercices de CM2 en ${skill}...`);

    try {
      if (useGemini) {
        // Collect recent errors for this skill to feed Gemini
        const recentErrors = attempts
          .filter((a) => a.skill === skill && !a.isCorrect)
          .map((a) => a.question)
          .slice(0, 3);

        const skillProgress = progressList.find((p) => p.skill === skill);
        const accuracy = skillProgress?.score || 70;
        const difficulty = forcedDifficulty || skillProgress?.level || (accuracy < 60 ? 'facile' : 'moyen');

        const generated = await callGeminiGenerateExercises({
          studentName: user?.firstName || 'Élève',
          studentId: user?.id,
          subject,
          skill,
          difficulty,
          count: 5,
          accuracy,
          recentErrors,
        });

        if (generated.length > 0) {
          setActiveExerciseSession(generated);
          setIsGenerating(false);
          return;
        }
      }

      // Fallback to library exercises
      const existing = await getExercises(subject, skill);
      if (existing.length > 0) {
        setActiveExerciseSession(existing.slice(0, 5));
      } else {
        const allExercises = await getExercises();
        setActiveExerciseSession(allExercises.slice(0, 5));
      }
    } catch (err) {
      console.warn('Gemini generation fallback to local exercises:', err);
      const fallback = await getExercises(subject, skill);
      setActiveExerciseSession(fallback.length > 0 ? fallback.slice(0, 5) : await getExercises());
    } finally {
      setIsGenerating(false);
    }
  };

  if (activeExerciseSession) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
        <ExerciseRunner
          exercises={activeExerciseSession}
          onFinish={() => {
            setActiveExerciseSession(null);
            loadData();
          }}
          onExit={() => {
            setActiveExerciseSession(null);
            loadData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-200">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-800 tracking-tight">
                EduTrain <span className="text-indigo-600">AI</span>
              </span>
              <span className="ml-2 text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                CM2
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[11px] text-slate-500">
                Enseignante : {TEACHER_CONFIG.fullName}
              </div>
            </div>

            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border-2 border-emerald-300">
              {user?.firstName?.charAt(0) || 'E'}
            </div>

            <button
              onClick={logout}
              title="Se déconnecter"
              className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 sm:gap-4 overflow-x-auto border-t border-slate-100 py-1 text-xs sm:text-sm font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'home'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Accueil</span>
          </button>

          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'exercises'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Mes exercices</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'progress'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Ma progression</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historique</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Mon profil</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Loading Overlay when Gemini is generating */}
        {isGenerating && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center animate-spin">
                <RotateCw className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">Génération avec Gemini</h3>
              <p className="text-xs text-slate-500">{genMessage}</p>
            </div>
          </div>
        )}

        {/* TAB 1: ACCUEIL */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Welcome Greeting */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-200 bg-white/10 px-3 py-1 rounded-full inline-block mb-3">
                  Classe de CM2
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
                  Bonjour {user?.firstName} 👋
                </h1>
                <p className="text-indigo-100 text-sm sm:text-base font-medium max-w-xl">
                  Bienvenue dans ton espace d'entraînement. Gemini adapte chaque question pour t'aider à progresser à ton rythme.
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Ta progression */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ta progression
                  </span>
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">
                  {overallSuccess} %
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${overallSuccess}%` }}
                  />
                </div>
              </div>

              {/* Card 2: Exercices réalisés */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Exercices réalisés
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">
                  {totalExercises}
                </div>
                <p className="text-xs text-slate-400 mt-1">Questions complétées</p>
              </div>

              {/* Card 3: Réussite moyenne */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Réussite moyenne
                  </span>
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">
                  {overallSuccess} %
                </div>
                <p className="text-xs text-slate-400 mt-1">Sur l'ensemble des matières</p>
              </div>
            </div>

            {/* Main Action Block: À travailler & Recommandations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* À travailler */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2">
                    <span>À travailler</span>
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Les compétences où tu peux le plus progresser cette semaine :
                  </p>

                  <div className="space-y-3 mb-6">
                    {displayWeakSkills.map((ws, idx) => {
                      const isRed = ws.score < 60;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-indigo-50/40 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">{isRed ? '🔴' : '🟠'}</span>
                            <div>
                              <div className="font-bold text-sm text-slate-800">
                                {ws.skill}
                              </div>
                              <div className="text-[11px] text-slate-400">{ws.subject}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600">
                              {ws.score} %
                            </span>
                            <button
                              type="button"
                              onClick={() => startExerciseSession(ws.subject, ws.skill)}
                              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                            >
                              S'entraîner
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => startExerciseSession(recommendedSkill.subject, recommendedSkill.skill)}
                  className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-indigo-200 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Commencer un exercice</span>
                </button>
              </div>

              {/* 🎯 Pour toi (Exercices recommandés par Gemini) */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-indigo-50/50 rounded-3xl p-6 border-2 border-amber-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>🎯 Pour toi</span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 mb-1">
                    {recommendedSkill.subject}
                  </h3>
                  <div className="text-lg font-bold text-indigo-700 mb-2">
                    {recommendedSkill.skill}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                    Gemini a analysé tes dernières réponses et a préparé <strong>5 exercices adaptés</strong> à ton niveau actuel pour consolider cette compétence.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Explications détaillées pas à pas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Difficulté progressive</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => startExerciseSession(recommendedSkill.subject, recommendedSkill.skill)}
                    className="w-full mt-2 py-4 px-6 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-amber-200 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Commencer la série recommandée</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MES EXERCICES (Choix par matière et compétence) */}
        {activeTab === 'exercises' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800">Choisis une compétence à travailler</h2>
              <p className="text-sm text-slate-500">
                Chaque série de 5 exercices est générée et ajustée en direct par Gemini selon ton niveau CM2.
              </p>
            </div>

            {/* Subject Selector */}
            <div className="flex gap-3">
              {(['Mathématiques', 'Français'] as Subject[]).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubject(subj)}
                  className={`px-5 py-3 rounded-2xl font-bold text-sm transition cursor-pointer flex items-center gap-2 ${
                    selectedSubject === subj
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{subj}</span>
                </button>
              ))}
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CM2_SUBJECTS[selectedSubject].skills.map((sk) => {
                const prog = progressList.find((p) => p.skill === sk.name);
                const hasAttempts = prog && prog.totalAttempts > 0;
                const score = hasAttempts ? prog.score : 0;
                const level = prog?.level || 'CM2';

                return (
                  <div
                    key={sk.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          Niveau {level}
                        </span>
                        <span className="text-xs font-extrabold text-slate-700">
                          {hasAttempts ? `${score} %` : 'Nouveau'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-base text-slate-800 mb-1">
                        {sk.name}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        {sk.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => startExerciseSession(selectedSubject, sk.name)}
                      className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Série adaptée Gemini (5 questions)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MA PROGRESSION */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Détail de tes compétences</h2>
              <p className="text-sm text-slate-500 mb-6">
                Visualise tes acquis et les points où tu peux t'entraîner davantage.
              </p>

              <div className="space-y-4">
                {(['Mathématiques', 'Français'] as Subject[]).map((subj) => (
                  <div key={subj} className="space-y-3 pt-4 first:pt-0">
                    <h3 className="font-extrabold text-lg text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      <span>{subj}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CM2_SUBJECTS[subj].skills.map((sk) => {
                        const prog = progressList.find((p) => p.skill === sk.name);
                        const hasAttempts = prog && prog.totalAttempts > 0;
                        const score = hasAttempts ? prog.score : 0;
                        const isHigh = score >= 80;
                        const isMid = score >= 60 && score < 80;

                        return (
                          <div
                            key={sk.id}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-sm text-slate-800">
                                {sk.name}
                              </span>
                              <span
                                className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                                  !hasAttempts
                                    ? 'bg-slate-200 text-slate-600'
                                    : isHigh
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isMid
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {hasAttempts ? `${score} %` : '0 % (Non débuté)'}
                              </span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                              <div
                                className={`h-2 rounded-full ${
                                  !hasAttempts
                                    ? 'bg-slate-300'
                                    : isHigh
                                    ? 'bg-emerald-500'
                                    : isMid
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Niveau : {prog?.level || 'CM2'}</span>
                              <button
                                type="button"
                                onClick={() => startExerciseSession(subj, sk.name)}
                                className="text-indigo-600 font-bold hover:underline"
                              >
                                S'entraîner
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORIQUE */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800">Historique de tes exercices</h2>
              <p className="text-sm text-slate-500">
                Consulte tes réponses et les explications pédagogiques pour comprendre tes réussites et tes erreurs.
              </p>
            </div>

            <div className="space-y-3">
              {attempts.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">
                  Tu n'as pas encore réalisé d'exercices. Lance ta première série sur l'accueil !
                </div>
              ) : (
                attempts.map((att) => (
                  <div
                    key={att.id}
                    className={`bg-white rounded-2xl p-5 border-2 transition ${
                      att.isCorrect
                        ? 'border-emerald-100 hover:border-emerald-300'
                        : 'border-rose-100 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {att.subject} • {att.skill}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(att.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 font-bold text-xs">
                        {att.isCorrect ? (
                          <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Réussi (+100 pts)
                          </span>
                        ) : (
                          <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            À revoir
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="font-bold text-sm text-slate-800 mb-2">
                      {att.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl mb-2">
                      <div>
                        <span className="text-slate-500">Ta réponse : </span>
                        <strong className={att.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                          {att.answer}
                        </strong>
                      </div>
                      {!att.isCorrect && (
                        <div>
                          <span className="text-slate-500">Bonne réponse : </span>
                          <strong className="text-emerald-700">{att.correctAnswer}</strong>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                      <strong>Explication : </strong>
                      {att.explanation}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MON PROFIL */}
        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-indigo-100 text-indigo-700 font-extrabold text-2xl flex items-center justify-center">
              {user?.firstName?.charAt(0)}
            </div>

            <h2 className="text-2xl font-extrabold text-slate-800">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Compte élève • Identifiant : {user?.email}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-600 border border-slate-200/70 mb-6">
              <div className="flex justify-between">
                <span>Classe :</span>
                <strong className="text-slate-800">CM2</strong>
              </div>
              <div className="flex justify-between">
                <span>Enseignante :</span>
                <strong className="text-slate-800">{TEACHER_CONFIG.fullName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Exercices terminés :</span>
                <strong className="text-slate-800">{totalExercises}</strong>
              </div>
              <div className="flex justify-between">
                <span>Réussite générale :</span>
                <strong className="text-indigo-600 font-extrabold">{overallSuccess} %</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full py-3.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
