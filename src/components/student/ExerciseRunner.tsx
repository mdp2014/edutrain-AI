import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { ExerciseItem, Attempt, Difficulty } from '../../types';
import { recordAttempt } from '../../lib/dataService';
import { useAuth } from '../../lib/authContext';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Calculator,
} from 'lucide-react';

interface ExerciseRunnerProps {
  exercises: ExerciseItem[];
  onFinish: () => void;
  onExit: () => void;
}

export const ExerciseRunner: React.FC<ExerciseRunnerProps> = ({
  exercises,
  onFinish,
  onExit,
}) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionResults, setSessionResults] = useState<{ isCorrect: boolean }[]>([]);

  // Scratchpad modal for calculations
  const [showDraft, setShowDraft] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

  const currentExercise = exercises[currentIndex];
  const progressPercent = Math.round(((currentIndex) / exercises.length) * 100);

  const cleanString = (str: string) =>
    str.toLowerCase().trim().replace(/\s+/g, ' ').replace(',', '.');

  const handleValidate = async () => {
    if (!selectedOption.trim() || isValidated) return;

    const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const userAns = selectedOption.trim();
    const targetAns = currentExercise.correctAnswer.trim();

    // Check correctness
    let correct = false;
    if (currentExercise.type === 'numeric') {
      const numUser = parseFloat(userAns.replace(',', '.'));
      const numTarget = parseFloat(targetAns.replace(',', '.'));
      correct = !isNaN(numUser) && !isNaN(numTarget) && Math.abs(numUser - numTarget) < 0.001;
    } else {
      correct = cleanString(userAns) === cleanString(targetAns);
    }

    setIsCorrect(correct);
    setIsValidated(true);
    setSessionResults((prev) => [...prev, { isCorrect: correct }]);

    // Trigger celebratory confetti on correct answer
    if (correct) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    }

    // Save attempt to database and local store
    if (user) {
      const attempt: Attempt = {
        id: `att-${user.id}-${Date.now()}`,
        exerciseId: currentExercise.id,
        studentId: user.id,
        studentName: `${user.firstName} ${user.lastName}`,
        subject: currentExercise.subject,
        skill: currentExercise.skill,
        difficulty: currentExercise.difficulty,
        question: currentExercise.question,
        answer: userAns,
        correctAnswer: targetAns,
        isCorrect: correct,
        score: correct ? 100 : 0,
        timeSpent,
        explanation: currentExercise.explanation,
        createdAt: new Date().toISOString(),
      };
      await recordAttempt(attempt);
    }
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption('');
      setIsValidated(false);
      setStartTime(Date.now());
    } else {
      setCompleted(true);
      const totalCorrect = sessionResults.filter((r) => r.isCorrect).length + (isCorrect ? 1 : 0);
      const finalScore = Math.round((totalCorrect / exercises.length) * 100);

      if (finalScore >= 70) {
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 },
        });
      }
    }
  };

  if (!currentExercise && !completed) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-slate-200">
        <p className="text-slate-600 mb-4">Aucun exercice disponible pour cette sélection.</p>
        <button
          onClick={onExit}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Summary screen
  if (completed) {
    const totalCorrect = sessionResults.filter((r) => r.isCorrect).length;
    const finalScore = Math.round((totalCorrect / exercises.length) * 100);

    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
          <Trophy className="w-10 h-10" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">
          {finalScore >= 80 ? '🎉 Fantastique travail !' : finalScore >= 50 ? '👏 Bien joué !' : '💪 Continue tes efforts !'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Tu as terminé la série de {exercises.length} exercices en <strong>{exercises[0]?.skill}</strong>.
        </p>

        {/* Score pill */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 mb-6">
          <div className="text-4xl font-extrabold text-indigo-600 mb-1">
            {finalScore} %
          </div>
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {totalCorrect} bonne{totalCorrect > 1 ? 's' : ''} réponse{totalCorrect > 1 ? 's' : ''} sur {exercises.length}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
            {finalScore >= 80 && (
              <span className="text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full">
                📈 Ton niveau s'améliore : passage aux exercices intermédiaires !
              </span>
            )}
            {finalScore < 60 && (
              <span className="text-amber-800 font-bold bg-amber-100 px-3 py-1 rounded-full">
                🎯 Gemini va te proposer des exercices de révision adaptés.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onFinish}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition cursor-pointer"
          >
            Retourner au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
            {currentExercise.subject}
          </span>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
            {currentExercise.skill}
          </span>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            Niveau {currentExercise.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDraft(!showDraft)}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Brouillon</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            Quitter
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scratchpad (Brouillon) */}
      {showDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-amber-700" />
              Zone de brouillon pour poser tes calculs
            </span>
            <button
              onClick={() => setShowDraft(false)}
              className="text-xs text-amber-800 hover:underline"
            >
              Fermer
            </button>
          </div>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Ex : 25 x 4 = 100..."
            className="w-full h-24 p-3 bg-white border border-amber-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      {/* Question Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Question {currentIndex + 1} / {exercises.length}
          </span>
        </div>

        {/* Question Text */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug mb-6">
          {currentExercise.question}
        </h3>

        {/* Interactive Response Area */}
        {currentExercise.type === 'qcm' || currentExercise.type === 'boolean' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {(currentExercise.options || ['Vrai', 'Faux']).map((option, idx) => {
              const isSelected = selectedOption === option;
              let btnClass = 'p-4 rounded-2xl font-semibold text-sm sm:text-base border-2 text-left transition cursor-pointer flex items-center justify-between ';

              if (!isValidated) {
                btnClass += isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 text-slate-700';
              } else {
                if (option === currentExercise.correctAnswer) {
                  btnClass += 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                } else if (isSelected && !isCorrect) {
                  btnClass += 'border-rose-400 bg-rose-50 text-rose-900';
                } else {
                  btnClass += 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isValidated}
                  onClick={() => setSelectedOption(option)}
                  className={btnClass}
                >
                  <span>{option}</span>
                  {isValidated && option === currentExercise.correctAnswer && (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isValidated && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-600 mb-2">
              {currentExercise.type === 'numeric' ? 'Saisis un nombre :' : 'Tape ta réponse :'}
            </label>
            <input
              type={currentExercise.type === 'numeric' ? 'text' : 'text'}
              inputMode={currentExercise.type === 'numeric' ? 'decimal' : 'text'}
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              disabled={isValidated}
              placeholder={currentExercise.type === 'numeric' ? 'Ex: 24 ou 3.5' : 'Ta réponse...'}
              className={`w-full px-5 py-4 text-lg font-bold rounded-2xl border-2 focus:outline-none transition ${
                !isValidated
                  ? 'border-slate-200 focus:border-indigo-600 bg-slate-50'
                  : isCorrect
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-rose-400 bg-rose-50 text-rose-900'
              }`}
            />
          </div>
        )}

        {/* Action Button: Validate or Next */}
        {!isValidated ? (
          <button
            type="button"
            onClick={handleValidate}
            disabled={!selectedOption.trim()}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-indigo-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Valider ma réponse
          </button>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Feedback Box */}
            <div
              className={`p-5 rounded-2xl border-2 ${
                isCorrect
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5 font-extrabold text-lg mb-2">
                {isCorrect ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                    <span>✅ Bonne réponse !</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    <span>❌ Pas tout à fait</span>
                  </>
                )}
              </div>

              {!isCorrect && (
                <div className="text-sm font-semibold mb-2">
                  <span>Ta réponse : </span>
                  <span className="line-through text-rose-700 font-bold">{selectedOption}</span>
                  <br />
                  <span>La bonne réponse : </span>
                  <strong className="text-emerald-700 font-bold">{currentExercise.correctAnswer}</strong>
                </div>
              )}

              {/* Pedagogical Explanation */}
              <div className="text-xs sm:text-sm leading-relaxed mt-2 pt-2 border-t border-black/10">
                <strong className="font-bold">Explication : </strong>
                {currentExercise.explanation}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full py-4 px-6 bg-slate-900 hover:bg-black text-white font-extrabold text-base rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{currentIndex < exercises.length - 1 ? 'Question suivante' : 'Voir mon bilan'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
