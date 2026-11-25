import React, { useState, useEffect, useRef } from 'react';
import { NeoCharacter } from './NeoCharacter';
import {
  NeoEmotionState,
  NeoHintLevel,
  NeoChatMessage,
  ExerciseItem,
} from '../../types';
import { askNeo } from '../../lib/neoService';
import { soundFx } from '../../lib/soundFx';
import {
  X,
  Send,
  Lightbulb,
  HelpCircle,
  Brain,
  Layers,
  Sparkles,
  Volume2,
  VolumeX,
  MessageCircle,
} from 'lucide-react';

interface NeoAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentExercise?: ExerciseItem;
  currentIndex?: number;
  totalExercises?: number;
  userAnswer?: string;
  isCorrect?: boolean;
  studentName?: string;
  onEmotionChange?: (emotion: NeoEmotionState) => void;
}

export const NeoAssistantPanel: React.FC<NeoAssistantPanelProps> = ({
  isOpen,
  onClose,
  currentExercise,
  currentIndex = 0,
  totalExercises = 0,
  userAnswer = '',
  isCorrect,
  studentName = 'Élève',
  onEmotionChange,
}) => {
  const [messages, setMessages] = useState<NeoChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentHintLevel, setCurrentHintLevel] = useState<NeoHintLevel>(1);
  const [panelEmotion, setPanelEmotion] = useState<NeoEmotionState>('neo-idle');
  const [soundEnabled, setSoundEnabled] = useState(soundFx.isEnabled());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset chat when exercise changes
  useEffect(() => {
    if (!currentExercise) return;

    const initialGreeting: NeoChatMessage = {
      id: `msg-${Date.now()}-init`,
      sender: 'neo',
      text: `Coucou ${studentName} ! 👋 Je suis Néo, ton copilote pour cette question de ${currentExercise.skill}. Tu hésites ou tu veux réfléchir ensemble ? Choisis un bouton ci-dessous ou écris-moi !`,
      emotion: 'neo-happy',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: [
        'Donne-moi un indice 💡',
        'Par quoi je commence ? ❓',
        'Explique-moi la méthode 🪜',
      ],
    };

    setMessages([initialGreeting]);
    setPanelEmotion('neo-happy');
    setCurrentHintLevel(1);
    if (onEmotionChange) onEmotionChange('neo-happy');
  }, [currentExercise?.id, studentName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      soundFx.playNeoBoop();
    }
  }, [isOpen]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setEnabled(next);
  };

  const handleSendMessage = async (textToSend?: string, hintLvl?: NeoHintLevel) => {
    const content = (textToSend || inputText).trim();
    if (!content && !hintLvl) return;

    const studentMsg: NeoChatMessage = {
      id: `msg-${Date.now()}-st`,
      sender: 'student',
      text: content || `Peux-tu m'aider avec un indice de niveau ${hintLvl} ?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, studentMsg]);
    setInputText('');
    setIsLoading(true);
    setPanelEmotion('neo-thinking');
    if (onEmotionChange) onEmotionChange('neo-thinking');

    // Build history for multi-turn contextual discussion
    const historyPayload = messages.map((m) => ({
      role: m.sender === 'student' ? ('user' as const) : ('neo' as const),
      content: m.text,
    }));
    historyPayload.push({ role: 'user', content: studentMsg.text });

    const targetHint = hintLvl || currentHintLevel;

    try {
      const response = await askNeo({
        message: content,
        hintLevel: targetHint,
        actionType: hintLvl ? 'hint' : 'chat',
        studentName,
        exerciseContext: currentExercise
          ? {
              subject: currentExercise.subject,
              skill: currentExercise.skill,
              difficulty: currentExercise.difficulty,
              question: currentExercise.question,
              type: currentExercise.type,
              options: currentExercise.options,
              userAnswer,
              isCorrect,
              correctAnswer: currentExercise.correctAnswer,
              explanation: currentExercise.explanation,
            }
          : {
              subject: 'Mathématiques',
              skill: 'Général',
              difficulty: 'moyen',
              question: '',
              type: 'qcm',
            },
        conversationHistory: historyPayload,
      });

      const neoMsg: NeoChatMessage = {
        id: `msg-${Date.now()}-neo`,
        sender: 'neo',
        text: response.reply,
        emotion: response.emotion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hintLevel: response.hintLevel,
        suggestedFollowUps: response.suggestedFollowUps,
      };

      setMessages((prev) => [...prev, neoMsg]);
      setPanelEmotion(response.emotion);
      if (onEmotionChange) onEmotionChange(response.emotion);

      if (hintLvl) {
        // Increment next available hint level up to 4
        setCurrentHintLevel((prev) => (Math.min(4, prev + 1) as NeoHintLevel));
      }

      soundFx.playNeoBoop();
    } catch (err) {
      console.error('Error fetching Néo response:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col border-l border-sky-200 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-4 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 p-1 rounded-2xl backdrop-blur-sm border border-white/20">
            <NeoCharacter state={panelEmotion} size="sm" interactive={false} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                Néo
                <span className="text-[10px] bg-amber-400 text-amber-950 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  CM2
                </span>
              </h3>
            </div>
            <p className="text-xs text-sky-100 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Ton copilote bienveillant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className="p-2 text-sky-100 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-sky-100 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Fermer l'aide de Néo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Exercise Context Banner */}
      {currentExercise && (
        <div className="bg-sky-50 px-4 py-2 border-b border-sky-100 text-xs text-sky-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-sky-900">{currentExercise.subject}</span>
            <span className="text-sky-300">•</span>
            <span className="truncate">{currentExercise.skill}</span>
          </div>
          {totalExercises > 0 && (
            <span className="bg-sky-200/80 text-sky-900 font-semibold px-2 py-0.5 rounded-full text-[11px] shrink-0">
              Q{currentIndex + 1}/{totalExercises}
            </span>
          )}
        </div>
      )}

      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-start gap-2 max-w-[88%]">
              {msg.sender === 'neo' && (
                <div className="shrink-0 mt-0.5">
                  <NeoCharacter state={msg.emotion || 'neo-idle'} size={32} />
                </div>
              )}

              <div
                className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'student'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-sky-100 rounded-tl-none'
                }`}
              >
                {msg.text}

                {/* Suggested follow-up buttons */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-sky-100 flex flex-wrap gap-1.5">
                    {msg.suggestedFollowUps.map((actionText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(actionText)}
                        disabled={isLoading}
                        className="text-[11px] font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-900 px-2.5 py-1 rounded-full border border-sky-200 transition-colors disabled:opacity-50"
                      >
                        {actionText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <span className="text-[10px] text-slate-400 mt-1 px-1">
              {msg.sender === 'student' ? 'Toi' : 'Néo'} • {msg.timestamp}
            </span>
          </div>
        ))}

        {/* Loading Thinking Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 max-w-[85%]">
            <div className="shrink-0 mt-0.5">
              <NeoCharacter state="neo-thinking" size={32} />
            </div>
            <div className="bg-white border border-sky-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-xs text-sky-700 font-medium">
              <span>Néo réfléchit</span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4 Tiered Hints Section */}
      <div className="p-3 bg-white border-t border-sky-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Indices progressifs :
          </span>
          <span className="text-[11px] text-sky-600 font-semibold">
            Niveau {currentHintLevel} / 4
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleSendMessage(`Donne-moi un petit indice (Niveau 1)`, 1)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100 transition-colors text-left disabled:opacity-50"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="truncate">
              <div className="font-bold text-[11px]">1. Piste clé</div>
              <div className="text-[10px] text-amber-700 truncate">Petit indice</div>
            </div>
          </button>

          <button
            onClick={() => handleSendMessage(`Pose-moi une question guidée pour m'aider (Niveau 2)`, 2)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-sky-200 bg-sky-50/80 text-sky-900 hover:bg-sky-100 transition-colors text-left disabled:opacity-50"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <div className="truncate">
              <div className="font-bold text-[11px]">2. Question guidée</div>
              <div className="text-[10px] text-sky-700 truncate">Faire réfléchir</div>
            </div>
          </button>

          <button
            onClick={() => handleSendMessage(`Explique-moi la méthode pas à pas (Niveau 3)`, 3)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 transition-colors text-left disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div className="truncate">
              <div className="font-bold text-[11px]">3. Méthode pas à pas</div>
              <div className="text-[10px] text-emerald-700 truncate">La règle de CM2</div>
            </div>
          </button>

          <button
            onClick={() => handleSendMessage(`Aide-moi en détail, je suis vraiment bloqué (Niveau 4)`, 4)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-purple-200 bg-purple-50/80 text-purple-900 hover:bg-purple-100 transition-colors text-left disabled:opacity-50"
          >
            <Brain className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <div className="truncate">
              <div className="font-bold text-[11px]">4. Aide complète</div>
              <div className="text-[10px] text-purple-700 truncate">Débloquer tout</div>
            </div>
          </button>
        </div>
      </div>

      {/* Input Message Area */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Écris un message à Néo..."
              disabled={isLoading}
              className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-slate-800 disabled:opacity-60 placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center shrink-0 shadow-sm"
            title="Envoyer à Néo"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
          <span>💡</span>
          <span>Néo ne donne jamais la réponse directe : il t'apprend à réussir par toi-même !</span>
        </p>
      </div>
    </div>
  );
};
