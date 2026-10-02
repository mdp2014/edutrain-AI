import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import { getCM2Students, getTeacherReports, getStudentAttempts, getStudentProgress } from '../../lib/dataService';
import { UserProfile, TeacherReport, Attempt, StudentProgress } from '../../types';
import { TEACHER_CONFIG } from '../../lib/constants';
import { StudentDetailModal } from './StudentDetailModal';
import { db } from '../../lib/firebase';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import {
  GraduationCap,
  Users,
  TrendingUp,
  FileText,
  Settings,
  Sparkles,
  LogOut,
  Search,
  Key,
  ChevronRight,
  AlertCircle,
  PieChart,
  UserPlus,
  RotateCw,
} from 'lucide-react';

export const TeacherView: React.FC = () => {
  const { user, logout, updateUserPassword } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'reports' | 'settings'>('dashboard');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-student real stats: { [studentId]: { total: number, score: number } }
  const [studentStats, setStudentStats] = useState<{ [id: string]: { total: number; score: number } }>({});
  const [totalClassExercises, setTotalClassExercises] = useState(0);
  const [classAverageScore, setClassAverageScore] = useState(0);

  // Password update form
  const [newPassword, setNewPassword] = useState('');
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stList, repList] = await Promise.all([
        getCM2Students(),
        getTeacherReports(),
      ]);
      setStudents(stList);
      setReports(repList);

      // Compute real statistics for each real student
      const statsMap: { [id: string]: { total: number; score: number } } = {};
      let classTotalExercises = 0;
      let sumScores = 0;
      let studentsWithAttempts = 0;

      for (const st of stList) {
        const attempts = await getStudentAttempts(st.id);
        const total = attempts.length;
        const correct = attempts.filter((a) => a.isCorrect).length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;

        statsMap[st.id] = { total, score };
        classTotalExercises += total;

        if (total > 0) {
          sumScores += score;
          studentsWithAttempts++;
        }
      }

      setStudentStats(statsMap);
      setTotalClassExercises(classTotalExercises);
      setClassAverageScore(studentsWithAttempts > 0 ? Math.round(sumScores / studentsWithAttempts) : 0);
    } catch (e) {
      console.error('Error loading teacher data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 1. Auto-refresh polling every 5 seconds
    const interval = setInterval(loadData, 5000);

    // 2. Real-time Firestore listener for instant updates
    let unsubscribe = () => {};
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      unsubscribe = onSnapshot(q, () => {
        loadData();
      }, (err) => {
        console.warn('TeacherView onSnapshot notice:', err);
      });
    } catch (e) {
      console.warn('onSnapshot error:', e);
    }

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [activeTab]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccess(null);
    setPassError(null);

    if (newPassword.length < 6) {
      setPassError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setIsUpdatingPass(true);
    const res = await updateUserPassword(newPassword);
    setIsUpdatingPass(false);

    if (res.success) {
      setPassSuccess('Votre mot de passe a été mis à jour avec succès.');
      setNewPassword('');
    } else {
      setPassError(res.error || 'Erreur lors du changement de mot de passe.');
    }
  };

  const filteredStudents = students.filter(
    (st) =>
      st.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Teacher Header Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">
                EduTrain <span className="text-indigo-400">AI</span>
              </span>
              <span className="ml-2 text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Espace Enseignant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-200">
                {TEACHER_CONFIG.fullName}
              </div>
              <div className="text-[11px] text-slate-400">
                Professeure des écoles • CM2
              </div>
            </div>

            <button
              onClick={logout}
              title="Se déconnecter"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Teacher Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 sm:gap-6 border-t border-slate-800 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Tableau de bord</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'students'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Élèves ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Rapports Gemini ({reports.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Paramètres</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* TAB 1: TABLEAU DE BORD (Section 14) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header Greeting */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                  Bonjour Solène
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Voici le tableau de bord en direct de votre classe de CM2.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-2 rounded-2xl text-xs font-bold shrink-0">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Données réelles • Gemini CM2</span>
              </div>
            </div>

            {/* Real Class Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classe</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1">CM2</div>
                <p className="text-xs text-slate-400 mt-1">École élémentaire</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Élèves inscrits</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">
                  {students.length}
                </div>
                <p className="text-xs text-slate-400 mt-1">Dans la base de données</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Réussite moyenne</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
                  {classAverageScore} %
                </div>
                <p className="text-xs text-slate-400 mt-1">Calculée sur les vraies réponses</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exercices réalisés</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-sky-600 mt-1">
                  {totalClassExercises}
                </div>
                <p className="text-xs text-slate-400 mt-1">Tentatives effectives des élèves</p>
              </div>
            </div>

            {/* List of Students */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">Élèves de la classe CM2</h2>
                  <p className="text-xs text-slate-500">
                    Cliquez sur un élève pour consulter ses réponses, identifier ses difficultés et générer son rapport.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un élève..."
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={loadData}
                    disabled={isLoading}
                    title="Actualiser la liste des élèves"
                    className="p-2 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-xl bg-white text-slate-500 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                    <span className="hidden sm:inline">Actualiser</span>
                  </button>
                </div>
              </div>

              {/* Empty state or real students */}
              {students.length === 0 ? (
                <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base mb-1">
                    Aucun élève inscrit pour le moment
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    La classe de CM2 est vierge de toute donnée fictive. Dès qu'un élève s'inscrit via le bouton <strong>S'inscrire</strong> sur la page de connexion, sa fiche apparaîtra ici avec son suivi personnalisé.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredStudents.map((st) => {
                    const stats = studentStats[st.id] || { total: 0, score: 0 };
                    const hasAttempts = stats.total > 0;
                    const score = stats.score;
                    const isHigh = score >= 80;
                    const isMid = score >= 60 && score < 80;

                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedStudent(st)}
                        className="py-4 flex items-center justify-between hover:bg-slate-50/80 px-3 rounded-2xl transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm group-hover:bg-indigo-600 group-hover:text-white transition">
                            {st.firstName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-sm sm:text-base text-slate-800 group-hover:text-indigo-600 transition">
                              {st.firstName} {st.lastName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {st.email} • {stats.total} exercice{stats.total > 1 ? 's' : ''} réalisé{stats.total > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Progress Bar & Score */}
                          <div className="hidden sm:flex items-center gap-3 w-48">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${
                                  !hasAttempts
                                    ? 'bg-slate-300'
                                    : isHigh
                                    ? 'bg-emerald-500'
                                    : isMid
                                    ? 'bg-indigo-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${hasAttempts ? score : 0}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-sm text-slate-700 w-16 text-right">
                              {hasAttempts ? `${score} %` : 'Nouveau'}
                            </span>
                          </div>

                          <span className="sm:hidden font-extrabold text-sm text-slate-700">
                            {hasAttempts ? `${score} %` : 'Nouveau'}
                          </span>

                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TOUS LES ÉLÈVES */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800">Gestion des élèves CM2</h2>
                <p className="text-xs text-slate-500">
                  Consultez la fiche individuelle et l'historique complet des réponses de chaque élève.
                </p>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                Aucun élève inscrit dans la classe pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((st) => {
                  const stats = studentStats[st.id] || { total: 0, score: 0 };
                  const hasAttempts = stats.total > 0;

                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center">
                            {st.firstName.charAt(0)}
                          </div>
                          <span className="font-extrabold text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                            {hasAttempts ? `${stats.score} % réussite` : 'Nouveau compte'}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-base text-slate-800">
                          {st.firstName} {st.lastName}
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">{st.email}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-bold">
                        <span>Consulter la fiche détaillée</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RAPPORTS GEMINI */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800">Rapports Pédagogiques Gemini</h2>
              <p className="text-xs text-slate-500">
                Consultez les analyses générées par Gemini à partir des résultats réels des élèves de CM2.
              </p>
            </div>

            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center border border-slate-200 text-slate-500">
                  <p className="mb-2">Aucun rapport n'a encore été généré.</p>
                  <p className="text-xs text-slate-400">
                    Ouvrez la fiche d'un élève dans le tableau de bord et cliquez sur "Générer un rapport avec Gemini".
                  </p>
                </div>
              ) : (
                reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-800">
                            Rapport d'évaluation : {rep.studentName}
                          </h3>
                          <span className="text-xs text-slate-400">
                            Généré le {new Date(rep.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {rep.summary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-emerald-50 rounded-xl text-emerald-950">
                        <strong className="block font-bold text-emerald-800 mb-1">Points maîtrisés :</strong>
                        <ul className="list-disc pl-4 space-y-1">
                          {rep.masteredPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 bg-rose-50 rounded-xl text-rose-950">
                        <strong className="block font-bold text-rose-800 mb-1">Difficultés :</strong>
                        <ul className="list-disc pl-4 space-y-1">
                          {rep.difficulties.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PARAMÈTRES */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-extrabold text-slate-800 mb-1">Paramètres du compte</h2>
              <p className="text-xs text-slate-500 mb-6">
                Enseignante : <strong>{TEACHER_CONFIG.fullName}</strong> • Classe de CM2
              </p>

              {passSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <span>{passSuccess}</span>
                </div>
              )}

              {passError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{passError}</span>
                </div>
              )}

              {/* Password Change Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="font-bold text-sm text-slate-800 mb-1">Modifier mon mot de passe</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Mettez à jour le mot de passe d'accès au compte enseignant de Solène De Pibrac.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPass}
                  className="py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  <span>{isUpdatingPass ? 'Mise à jour...' : 'Enregistrer le nouveau mot de passe'}</span>
                </button>
              </form>
            </div>

            {/* School & Class Info Card */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-800 mb-2">EduTrain AI • Configuration</h4>
              <div className="flex justify-between">
                <span>Niveau :</span>
                <strong className="text-slate-800">CM2</strong>
              </div>
              <div className="flex justify-between">
                <span>Enseignante :</span>
                <strong className="text-slate-800">Solène De Pibrac</strong>
              </div>
              <div className="flex justify-between">
                <span>Identifiant de connexion :</span>
                <code className="text-indigo-600 font-mono">solene</code>
              </div>
              <div className="flex justify-between">
                <span>Base de données :</span>
                <strong className="text-slate-800">Données réelles (aucune donnée fictive)</strong>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => {
            setSelectedStudent(null);
            loadData();
          }}
          onStudentDeleted={(deletedId) => {
            setSelectedStudent(null);
            setStudents((prev) => prev.filter((s) => s.id !== deletedId));
            loadData();
          }}
          onReportGenerated={(rep) => {
            setReports((prev) => [rep, ...prev]);
          }}
        />
      )}
    </div>
  );
};
