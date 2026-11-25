import React, { useState, useEffect } from 'react';
import { supabase, supabaseProjectRef } from '../../lib/supabase';
import { clearDatabasePreservingTeacher } from '../../lib/dataService';
import {
  Database,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
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
  Trash2,
} from 'lucide-react';

export const DatabaseExplorer: React.FC = () => {
  const [activeTable, setActiveTable] = useState<string>('users');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const consoleUrl = supabaseProjectRef
    ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/editor`
    : 'https://supabase.com/dashboard';

  const tables = [
    { id: 'users', label: 'Utilisateurs (users)', icon: Users, desc: 'Enseignante Solène & élèves CM2' },
    { id: 'attempts', label: 'Tentatives (attempts)', icon: History, desc: 'Réponses des élèves' },
    { id: 'progress', label: 'Progression (progress)', icon: TrendingUp, desc: 'Scores par compétence' },
    { id: 'reports', label: 'Rapports (reports)', icon: FileText, desc: 'Rapports pédagogiques Gemini' },
    { id: 'classes', label: 'Classe (classes)', icon: Layers, desc: 'Classe unique de CM2' },
    { id: 'exercises', label: 'Exercices (exercises)', icon: BookOpen, desc: 'Exercices CM2 générés & adaptés' },
  ];

  const fetchTableRows = async (tableName: string) => {
    setLoading(true);
    setSelectedRow(null);
    setSyncError(null);
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(200);
      if (error) {
        setSyncError(`Erreur Supabase sur la table ${tableName} : ${error.message}`);
        setRows([]);
      } else {
        setRows(data || []);
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Erreur lors de la lecture de la table Supabase.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableRows(activeTable);
  }, [activeTable]);

  const handleClearDatabase = async () => {
    setLoading(true);
    setSyncStatus(null);
    setSyncError(null);
    try {
      const res = await clearDatabasePreservingTeacher();
      if (res.success) {
        setSyncStatus('Base de données vidée avec succès ! Seul le compte enseignant est conservé.');
        setConfirmClear(false);
        await fetchTableRows(activeTable);
      } else {
        setSyncError(res.error || 'Erreur lors du vidage de la base.');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Direct Access to Supabase Dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-3">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supabase PostgreSQL • RLS Actif</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Accès Direct à la Base de Données
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            Votre base PostgreSQL Supabase est active et protégée par Row Level Security. Vous pouvez explorer les tables ici ou ouvrir directement votre tableau de bord Supabase.
          </p>

          {supabaseProjectRef && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-slate-300">
                Projet Supabase : <strong className="text-white">{supabaseProjectRef}</strong>
              </span>
              <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-slate-300">
                Schéma : <strong className="text-white">public</strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <span>Ouvrir Supabase</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          {confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearDatabase}
                disabled={loading}
                className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{loading ? 'Vidage...' : 'Confirmer le vidage'}</span>
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-2xl text-xs"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={loading}
              className="px-5 py-3.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Vider la base (garder enseignant)</span>
            </button>
          )}
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
        {/* Tables List Sidebar */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-3">
            Tables Supabase
          </h3>

          {tables.map((tbl) => {
            const Icon = tbl.icon;
            const isSelected = activeTable === tbl.id;

            return (
              <button
                key={tbl.id}
                onClick={() => setActiveTable(tbl.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 shadow-xs'
                    : 'hover:bg-slate-50 border-2 border-transparent text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm leading-tight">{tbl.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{tbl.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Table Rows View */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <span>Table :</span>
                  <code className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-sm font-mono">
                    public.{activeTable}
                  </code>
                </h3>
                <span className="text-xs text-slate-400">
                  {rows.length} ligne{rows.length > 1 ? 's' : ''} chargée{rows.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchTableRows(activeTable)}
                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>

                <button
                  onClick={handleCopyJson}
                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié !' : 'Copier JSON'}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Chargement des données Supabase...
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Aucune ligne trouvée dans cette table.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {rows.map((item, idx) => {
                  const rowId = item.id || `row-${idx}`;
                  const title =
                    item.full_name ||
                    item.name ||
                    item.question ||
                    item.student_name ||
                    item.skill ||
                    rowId;
                  const isSelected = selectedRow === item;

                  return (
                    <div
                      key={rowId}
                      className={`p-4 rounded-2xl border transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/30'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            ID: {rowId}
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
                          {item.is_correct !== undefined && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.is_correct ? 'Réussi' : 'Erreur'}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedRow(isSelected ? null : item)}
                          className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Masquer JSON' : 'Voir JSON'}</span>
                        </button>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 mb-1 line-clamp-2">
                        {title}
                      </div>

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
