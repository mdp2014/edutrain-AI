import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import {
  DEMO_STUDENTS,
  DEMO_TEACHER,
  DEMO_CLASS,
  INITIAL_EXERCISES,
  DEMO_ATTEMPTS,
  DEMO_PROGRESS,
  DEMO_REPORT,
} from '../../lib/demoData';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  Database,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  FileJson,
  Layers,
  Users,
  BookOpen,
  History,
  TrendingUp,
  FileText,
  Copy,
  Check,
  AlertCircle,
  Eye,
} from 'lucide-react';

export const DatabaseExplorer: React.FC = () => {
  const [activeCollection, setActiveCollection] = useState<string>('users');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;

  const collections = [
    { id: 'users', label: 'Utilisateurs (users)', icon: Users, desc: 'Enseignante Solène et élèves de CM2' },
    { id: 'classes', label: 'Classe (classes)', icon: Layers, desc: 'Classe unique de CM2' },
    { id: 'exercises', label: 'Exercices (exercises)', icon: BookOpen, desc: 'Exercices CM2 générés & adaptés' },
    { id: 'attempts', label: 'Tentatives (attempts)', icon: History, desc: 'Réponses et erreurs des élèves' },
    { id: 'progress', label: 'Progression (progress)', icon: TrendingUp, desc: 'Scores par compétence' },
    { id: 'reports', label: 'Rapports (reports)', icon: FileText, desc: 'Rapports pédagogiques Gemini' },
  ];

  const fetchCollectionDocs = async (colName: string) => {
    setLoading(true);
    setSelectedDoc(null);
    try {
      const snap = await getDocs(collection(db, colName));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ _id: d.id, ...d.data() });
      });
      setDocuments(list);
    } catch (err: any) {
      console.warn('Could not read from Firestore directly, loading in-memory cache:', err);
      // Fallback display from in-memory data
      if (colName === 'users') setDocuments([DEMO_TEACHER, ...DEMO_STUDENTS]);
      else if (colName === 'classes') setDocuments([DEMO_CLASS]);
      else if (colName === 'exercises') setDocuments(INITIAL_EXERCISES);
      else if (colName === 'attempts') setDocuments(DEMO_ATTEMPTS);
      else if (colName === 'progress') setDocuments(DEMO_PROGRESS);
      else if (colName === 'reports') setDocuments([DEMO_REPORT]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollectionDocs(activeCollection);
  }, [activeCollection]);

  // Synchronize and write initial demo dataset to Firestore
  const handlePushDataToFirestore = async () => {
    setLoading(true);
    setSyncStatus(null);
    setSyncError(null);

    try {
      let count = 0;

      // 1. Teacher & Students
      await setDoc(doc(db, 'users', DEMO_TEACHER.id), DEMO_TEACHER);
      count++;
      for (const st of DEMO_STUDENTS) {
        await setDoc(doc(db, 'users', st.id), st);
        count++;
      }

      // 2. Class
      await setDoc(doc(db, 'classes', DEMO_CLASS.id), DEMO_CLASS);
      count++;

      // 3. Exercises
      for (const ex of INITIAL_EXERCISES) {
        await setDoc(doc(db, 'exercises', ex.id), ex);
        count++;
      }

      // 4. Attempts
      for (const att of DEMO_ATTEMPTS) {
        await setDoc(doc(db, 'attempts', att.id), att);
        count++;
      }

      // 5. Progress
      for (const prog of DEMO_PROGRESS) {
        await setDoc(doc(db, 'progress', prog.id), prog);
        count++;
      }

      // 6. Reports
      if (DEMO_REPORT) {
        await setDoc(doc(db, 'reports', DEMO_REPORT.id), DEMO_REPORT);
        count++;
      }

      setSyncStatus(`Succès ! ${count} documents ont été injectés dans votre base Firestore.`);
      await fetchCollectionDocs(activeCollection);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Erreur lors de la synchronisation Firestore');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(documents, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Direct Access to Firebase Console */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 mb-3">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Google Cloud Firestore</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Accès Direct à la Base de Données
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            Votre base Firestore est active et hébergée sur Google Cloud. Vous pouvez l'explorer ici ou l'ouvrir directement dans la Console Firebase officielle.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-slate-300">
              Projet : <strong className="text-white">{firebaseConfig.projectId}</strong>
            </span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-slate-300">
              Database : <strong className="text-white">{firebaseConfig.firestoreDatabaseId}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <span>Ouvrir Console Firebase</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={handlePushDataToFirestore}
            disabled={loading}
            className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/20 transition cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>{loading ? 'Synchronisation...' : 'Pousser les données'}</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {syncError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Explorer Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections List Sidebar */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-3">
            Collections Firestore
          </h3>

          {collections.map((col) => {
            const Icon = col.icon;
            const isSelected = activeCollection === col.id;

            return (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-900 shadow-xs'
                    : 'hover:bg-slate-50 border-2 border-transparent text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm leading-tight">{col.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{col.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Collection Documents View */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <span>Collection :</span>
                  <code className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-sm font-mono">
                    /{activeCollection}
                  </code>
                </h3>
                <span className="text-xs text-slate-400">
                  {documents.length} document{documents.length > 1 ? 's' : ''} disponible{documents.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchCollectionDocs(activeCollection)}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>

                <button
                  onClick={handleCopyJson}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié !' : 'Copier JSON'}</span>
                </button>
              </div>
            </div>

            {/* Documents List */}
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Chargement des données Firestore...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Aucun document trouvé dans cette collection. Cliquez sur "Pousser les données" pour initialiser.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {documents.map((item, idx) => {
                  const docId = item.id || item._id || `doc-${idx}`;
                  const title = item.fullName || item.name || item.question || item.studentName || item.skill || docId;
                  const isSelected = selectedDoc === item;

                  return (
                    <div
                      key={docId}
                      className={`p-4 rounded-2xl border transition ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/30'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            ID: {docId}
                          </code>
                          {item.role && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                              {item.role}
                            </span>
                          )}
                          {item.difficulty && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              {item.difficulty}
                            </span>
                          )}
                          {item.isCorrect !== undefined && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.isCorrect ? 'Réussi' : 'Erreur'}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedDoc(isSelected ? null : item)}
                          className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Masquer JSON' : 'Voir JSON'}</span>
                        </button>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 mb-1 line-clamp-2">
                        {title}
                      </div>

                      {/* Expanded JSON view */}
                      {isSelected && (
                        <pre className="mt-3 p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
