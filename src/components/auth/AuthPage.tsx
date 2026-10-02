import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { TEACHER_CONFIG } from '../../lib/constants';
import { GraduationCap, ArrowRight, AlertCircle, CheckCircle2, Sparkles, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, registerStudent } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setSuccessMsg(null);
    if (!identifier.trim() || !password) {
      setError('Veuillez remplir votre identifiant et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(identifier, password);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Erreur lors de la connexion.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setSuccessMsg(null);

    setIsSubmitting(true);
    const res = await registerStudent(firstName, lastName, regPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Erreur lors de la création du compte.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header bar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-xl text-slate-800 tracking-tight flex items-center gap-1.5">
              EduTrain <span className="text-indigo-600">AI</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">CM2</span>
            </span>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-500 font-medium">
          Classe : <strong className="text-slate-700">CM2</strong> • Enseignante : <strong className="text-slate-700">{TEACHER_CONFIG.fullName}</strong>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 sm:p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10">
              <Sparkles className="w-32 h-32" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">EduTrain AI</h1>
            <p className="text-indigo-100 text-sm sm:text-base font-medium">
              Ton entraînement CM2 personnalisé
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                <div>{error}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <div>{successMsg}</div>
              </div>
            )}

            {mode === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Identifiant ou adresse e-mail
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ex: Jules Dupont ou solene"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base bg-slate-50/50"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Élève : ton prénom ou identifiant • Enseignante : solene
                  </span>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base bg-slate-50/50"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Connexion en cours...'
                  ) : (
                    <>
                      <span>Se connecter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs text-slate-400 uppercase">
                    <span className="bg-white px-2">Pas encore de compte ?</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="w-full py-3 px-4 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl transition cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>S'inscrire (Nouvel élève)</span>
                </button>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800">Créer mon compte élève</h2>
                  <p className="text-xs text-slate-500">Ajout automatique à la classe de CM2</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Jules"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: Dupont"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Mot de passe (au moins 6 caractères)
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Choisis un mot de passe facile à retenir"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-slate-50/50"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Création en cours...' : 'Créer mon compte'}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Déjà inscrit ? Revenir à la connexion
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-xs text-slate-400">
        EduTrain AI • Entraînement CM2 • Données réelles & progression personnalisée
      </footer>
    </div>
  );
};
