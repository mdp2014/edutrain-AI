import React, { useState, useEffect } from 'react';
import { UserProfile, Attempt, StudentProgress, TeacherReport, ExerciseItem } from '../../types';
import {
  getStudentAttempts,
  getStudentProgress,
  callGeminiGenerateReport,
  callGeminiGenerateExercises,
  deleteStudent,
  updateStudentPassword,
} from '../../lib/dataService';
import {
  X,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Send,
  FileText,
  Printer,
  RotateCw,
  PlusCircle,
  Key,
  Trash2,
} from 'lucide-react';

interface StudentDetailModalProps {
  student: UserProfile;
  onClose: () => void;
  onReportGenerated?: (report: TeacherReport) => void;
  onStudentDeleted?: (studentId: string) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onReportGenerated,
  onStudentDeleted,
}) => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector modal for a single attempt click
  const [inspectedAttempt, setInspectedAttempt] = useState<Attempt | null>(null);

  // Gemini Report state
  const [activeReport, setActiveReport] = useState<TeacherReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Gemini Custom Series state
  const [isGeneratingSeries, setIsGeneratingSeries] = useState(false);
  const [generatedSeries, setGeneratedSeries] = useState<ExerciseItem[] | null>(null);
  const [seriesSuccessMsg, setSeriesSuccessMsg] = useState<string | null>(null);

  // Password & deletion management state
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [attList, progList] = await Promise.all([
        getStudentAttempts(student.id),
        getStudentProgress(student.id),
      ]);
      setAttempts(attList);
      setProgress(progList);
      setLoading(false);
    };
    fetchData();
  }, [student.id]);

  // Overall metrics strictly from real attempts
  const totalExercises = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const overallSuccess = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;

  const recentErrors = attempts.filter((a) => !a.isCorrect);

  // Generate Report with Gemini
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const skillsMap: { [skill: string]: number } = {};
      progress.forEach((p) => {
        skillsMap[p.skill] = p.score;
      });

      const report = await callGeminiGenerateReport({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        totalExercises,
        overallScore: overallSuccess,
        skills: skillsMap,
        recentAttempts: attempts.slice(0, 10),
        recentErrors: recentErrors.slice(0, 8),
      });

      setActiveReport(report);
      if (onReportGenerated) onReportGenerated(report);
    } catch (err) {
      console.error(err);
      alert('Impossible de générer le rapport avec Gemini.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Generate Custom Exercise Series with Gemini
  const handleGenerateCustomSeries = async () => {
    setIsGeneratingSeries(true);
    setSeriesSuccessMsg(null);
    try {
      // Find weakest skills
      const sortedSkills = [...progress].sort((a, b) => a.score - b.score);
      const primaryWeak = sortedSkills[0]?.skill || 'Fractions';
      const weakSubject = sortedSkills[0]?.subject || 'Mathématiques';
      const targetScore = sortedSkills[0]?.score || 60;

      const exercises = await callGeminiGenerateExercises({
        studentName: `${student.firstName} ${student.lastName}`,
        studentId: student.id,
        subject: weakSubject,
        skill: primaryWeak,
        difficulty: targetScore < 60 ? 'facile' : 'moyen',
        count: 5,
        accuracy: targetScore,
        recentErrors: recentErrors.map((e) => e.question).slice(0, 4),
      });

      setGeneratedSeries(exercises);
      setSeriesSuccessMsg(`Série de ${exercises.length} exercices personnalisés générée et enregistrée dans le compte de ${student.firstName} !`);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la génération de la série.');
    } finally {
      setIsGeneratingSeries(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPasswordInput.length < 6) {
      setPasswordFeedback({
        message: 'Le mot de passe doit comporter au moins 6 caractères.',
        isError: true,
      });
      return;
    }

    setIsUpdatingPassword(true);
    const res = await updateStudentPassword(student.id, newPasswordInput);
    setIsUpdatingPassword(false);

    if (res.success) {
      setPasswordFeedback({
        message: `Mot de passe de ${student.firstName} modifié avec succès !`,
        isError: false,
      });
      setNewPasswordInput('');
    } else {
      setPasswordFeedback({
        message: res.error || 'Erreur lors de la mise à jour du mot de passe.',
        isError: true,
      });
    }
  };

  const handleDeleteStudent = async () => {
    setIsDeleting(true);
    const ok = await deleteStudent(student.id);
    setIsDeleting(false);

    if (ok) {
      if (onStudentDeleted) {
        onStudentDeleted(student.id);
      }
      onClose();
    } else {
      alert('Impossible de supprimer cet élève. Veuillez réessayer.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 font-extrabold text-xl flex items-center justify-center border border-indigo-500/30">
              {student.firstName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {student.firstName} {student.lastName}
              </h2>
              <p className="text-xs text-slate-400">
                Classe CM2 • {student.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Progression générale</span>
              <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                {overallSuccess} %
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${overallSuccess}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Exercices réalisés</span>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">
                {totalExercises}
              </div>
              <p className="text-xs text-slate-400 mt-1">Questions répondues</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Réussite moyenne</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                {overallSuccess} %
              </div>
              <p className="text-xs text-slate-400 mt-1">Sur toutes les compétences</p>
            </div>
          </div>

          {/* Teacher Actions Toolbar */}
          <div className="flex flex-wrap gap-3 p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
            <button
              onClick={handleGenerateCustomSeries}
              disabled={isGeneratingSeries}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isGeneratingSeries ? 'Génération en cours...' : 'Générer une nouvelle série personnalisée'}</span>
            </button>

            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>{isGeneratingReport ? 'Analyse Gemini...' : 'Générer un rapport avec Gemini'}</span>
            </button>
          </div>

          {/* Feedback message for generated series */}
          {seriesSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{seriesSuccessMsg}</span>
            </div>
          )}

          {/* Generated Gemini Series Preview */}
          {generatedSeries && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Série générée sur-mesure pour {student.firstName} ({generatedSeries[0]?.skill})
                </h4>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Prête pour l'élève
                </span>
              </div>

              <div className="space-y-2">
                {generatedSeries.map((ex, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div className="font-bold text-slate-800 mb-1">
                      {i + 1}. {ex.question}
                    </div>
                    <div className="text-slate-500">
                      Réponse attendue : <strong className="text-emerald-700">{ex.correctAnswer}</strong> • Type : {ex.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Pedagogical Report Display */}
          {activeReport && (
            <div className="p-5 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/50 border-2 border-indigo-200 rounded-3xl space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800">
                      Rapport Pédagogique Gemini CM2
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Élève : {activeReport.studentName} • Enseignante : Solène De Pibrac
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Progression & Synthèse
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                  {activeReport.summary}
                </p>
              </div>

              {/* Grid 2 cols for Strengths & Difficulties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mastered Points */}
                <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
                  <h4 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Points maîtrisés
                  </h4>
                  <ul className="space-y-1.5 text-xs text-emerald-950">
                    {activeReport.masteredPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Difficulties */}
                <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-2xl">
                  <h4 className="text-xs font-extrabold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Difficultés observées
                  </h4>
                  <ul className="space-y-1.5 text-xs text-rose-950">
                    {activeReport.difficulties.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Frequent Errors */}
              <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl">
                <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider mb-2">
                  Erreurs fréquentes relevées
                </h4>
                <ul className="space-y-1.5 text-xs text-amber-950">
                  {activeReport.frequentErrors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations & Next Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                    Recommandations pour Solène
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {activeReport.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-indigo-500 font-bold">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                    Prochaine étape conseillée
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {activeReport.nextSteps.map((st, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Section: Compétences (Section 15) */}
          <div>
            <h3 className="text-base font-extrabold text-slate-800 mb-3">
              Maîtrise des compétences CM2
            </h3>
            {progress.length === 0 ? (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
                Cet élève n'a pas encore réalisé d'exercices. Les résultats s'afficheront dès qu'il aura répondu à ses premières questions.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {progress.map((prog) => {
                  const isHigh = prog.score >= 80;
                  const isMid = prog.score >= 60 && prog.score < 80;

                  return (
                    <div
                      key={prog.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800">
                          {prog.skill} ({prog.subject})
                        </span>
                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                            isHigh
                              ? 'bg-emerald-100 text-emerald-800'
                              : isMid
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {prog.score} %
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-1.5">
                        <div
                          className={`h-2 rounded-full ${
                            isHigh
                              ? 'bg-emerald-500'
                              : isMid
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${prog.score}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Niveau : {prog.level}</span>
                        <span>{prog.correctAttempts} / {prog.totalAttempts} réussites</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Dernières erreurs (Section 15) */}
          {recentErrors.length > 0 && (
            <div>
              <h3 className="text-base font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Dernières erreurs de {student.firstName}</span>
              </h3>

              <div className="space-y-2">
                {recentErrors.slice(0, 3).map((err) => (
                  <div
                    key={err.id}
                    onClick={() => setInspectedAttempt(err)}
                    className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-2xl hover:bg-rose-100/60 transition cursor-pointer flex items-center justify-between"
                  >
                    <div className="pr-4">
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                        {err.skill}
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                        {err.question}
                      </p>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Réponse de l'élève : <span className="text-rose-700 font-bold">{err.answer}</span> • Bonne réponse : <span className="text-emerald-700 font-bold">{err.correctAnswer}</span>
                      </div>
                    </div>

                    <span className="text-xs text-indigo-600 font-bold shrink-0">
                      Voir détails →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Historique complet des tentatives (Section 15 & 16) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                Historique des tentatives (cliquer pour inspecter)
              </h3>
              <span className="text-xs text-slate-400">{attempts.length} enregistrées</span>
            </div>

            <div className="space-y-2">
              {attempts.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                  Aucune tentative pour le moment.
                </div>
              ) : (
                attempts.map((att) => (
                  <div
                    key={att.id}
                    onClick={() => setInspectedAttempt(att)}
                    className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-2xs transition cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">
                        {att.isCorrect ? '✅' : '❌'}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 line-clamp-1">
                          {att.question}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {att.subject} • {att.skill} • {new Date(att.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          att.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {att.isCorrect ? 'Correct' : 'Erreur'}
                      </span>
                      <span className="text-slate-400">→</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Gestion du compte de l'élève */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Key className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-slate-800 text-base">Gestion du compte de l'élève</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Modifier le mot de passe */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>Modifier le mot de passe</span>
                </div>
                <p className="text-xs text-slate-500">
                  Attribuer un nouveau mot de passe pour {student.firstName} (utile en cas d'oubli).
                </p>

                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Nouveau mot de passe (min 6 car.)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {passwordFeedback && (
                    <div
                      className={`text-xs p-2.5 rounded-xl ${
                        passwordFeedback.isError
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700 font-bold'
                      }`}
                    >
                      {passwordFeedback.message}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isUpdatingPassword || !newPasswordInput}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingPassword ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
                  </button>
                </form>
              </div>

              {/* Option 2: Supprimer l'élève */}
              <div className="bg-white p-5 rounded-2xl border border-rose-100 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer définitivement l'élève</span>
                </div>
                <p className="text-xs text-slate-500">
                  Retire cet élève de la classe et supprime tout son historique d'entraînement.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2.5 px-4 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer cet élève</span>
                  </button>
                ) : (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-start gap-2 text-rose-800 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>
                        Confirmer la suppression irréversible de{' '}
                        <strong>
                          {student.firstName} {student.lastName}
                        </strong>{' '}
                        ?
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteStudent}
                        disabled={isDeleting}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {isDeleting ? 'Suppression...' : 'Oui, supprimer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSPECT ATTEMPT MODAL (Section 16 requirement) */}
      {inspectedAttempt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                Détail de la tentative • {inspectedAttempt.skill}
              </span>
              <button
                onClick={() => setInspectedAttempt(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase">Question posée</span>
              <p className="text-base font-bold text-slate-800 mt-1">
                {inspectedAttempt.question}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
              <div>
                <span className="text-slate-500">Réponse de {student.firstName} : </span>
                <strong className={inspectedAttempt.isCorrect ? 'text-emerald-700 text-sm' : 'text-rose-700 text-sm'}>
                  {inspectedAttempt.answer}
                </strong>
              </div>

              <div>
                <span className="text-slate-500">Bonne réponse : </span>
                <strong className="text-emerald-700 text-sm">{inspectedAttempt.correctAnswer}</strong>
              </div>

              <div>
                <span className="text-slate-500">Résultat : </span>
                <strong className={inspectedAttempt.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                  {inspectedAttempt.isCorrect ? '✅ Correct (+100 pts)' : '❌ Incorrect (0 pt)'}
                </strong>
              </div>

              {inspectedAttempt.timeSpent && (
                <div>
                  <span className="text-slate-500">Temps de réponse : </span>
                  <strong className="text-slate-700">{inspectedAttempt.timeSpent} secondes</strong>
                </div>
              )}
            </div>

            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl text-xs text-slate-700">
              <strong className="font-bold text-indigo-900 block mb-1">Explication pédagogique :</strong>
              {inspectedAttempt.explanation}
            </div>

            <button
              onClick={() => setInspectedAttempt(null)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
