import React, { useState, useEffect } from 'react';
import { NeoCharacter } from './NeoCharacter';
import { NeoEmotionState } from '../../types';
import { Sparkles, MessageCircle, Lightbulb, X } from 'lucide-react';

interface NeoCompanionWidgetProps {
  emotion?: NeoEmotionState;
  bubbleText?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  position?: 'inline' | 'floating' | 'exercise-dock';
  interactive?: boolean;
  showSpeechBubble?: boolean;
  subText?: string;
  badgeLabel?: string;
}

export const NeoCompanionWidget: React.FC<NeoCompanionWidgetProps> = ({
  emotion = 'neo-idle',
  bubbleText,
  onClick,
  size = 'md',
  position = 'inline',
  interactive = true,
  showSpeechBubble = true,
  subText,
  badgeLabel,
}) => {
  const [bubbleVisible, setBubbleVisible] = useState(true);

  // Re-show bubble whenever new text is provided
  useEffect(() => {
    if (bubbleText) {
      setBubbleVisible(true);
    }
  }, [bubbleText]);

  // If floating, render single fixed corner mascot on bottom right
  if (position === 'floating') {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-end gap-2.5 select-none pointer-events-none">
        {showSpeechBubble && bubbleText && bubbleVisible && (
          <div
            onClick={onClick}
            className="pointer-events-auto hidden sm:flex max-w-[260px] bg-white border border-sky-200 shadow-xl rounded-2xl p-3 text-xs text-slate-800 relative cursor-pointer hover:border-sky-400 transition-all hover:scale-[1.02] animate-fade-in group"
          >
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Néo</span>
                  {badgeLabel && (
                    <span className="bg-sky-100 text-sky-800 px-1 py-0.2 rounded text-[9px]">
                      {badgeLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBubbleVisible(false);
                  }}
                  title="Fermer la bulle"
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs font-medium text-slate-700 leading-snug">
                {bubbleText}
              </p>
              {subText && (
                <p className="text-[10px] text-slate-400 italic">{subText}</p>
              )}
            </div>
            {/* Bubble tail arrow */}
            <div className="absolute -right-2 bottom-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-white" />
          </div>
        )}

        <button
          onClick={onClick}
          className="pointer-events-auto group relative flex items-center justify-center bg-white p-2 sm:p-2.5 rounded-3xl border-2 border-sky-300 shadow-xl hover:border-sky-500 hover:shadow-2xl transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-sky-200 cursor-pointer"
          title="Clique pour parler à Néo (ton assistant CM2)"
        >
          {/* Notification / Hint ping badge */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[9px] font-bold text-white items-center justify-center">
              💡
            </span>
          </span>

          <NeoCharacter state={emotion} size={size === 'sm' ? 48 : size === 'md' ? 60 : 76} interactive={false} />
        </button>
      </div>
    );
  }

  if (position === 'exercise-dock') {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-3 p-3 bg-gradient-to-r from-sky-50 to-blue-50/80 border border-sky-200/90 rounded-2xl shadow-sm transition-all duration-200 ${
          interactive ? 'cursor-pointer hover:border-sky-400 hover:shadow-md hover:bg-sky-50/90 group' : ''
        }`}
      >
        <div className="shrink-0 relative">
          <NeoCharacter state={emotion} size={size === 'sm' ? 44 : 56} interactive={false} />
          {interactive && (
            <span className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border border-white shadow-xs">
              Aide
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-sky-900 flex items-center gap-1">
              Néo
              <span className="text-[10px] font-semibold text-sky-600">ton copilote</span>
            </span>
            {badgeLabel && (
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-full">
                {badgeLabel}
              </span>
            )}
          </div>
          {bubbleText ? (
            <p className="text-xs text-slate-700 font-medium leading-snug truncate sm:whitespace-normal">
              « {bubbleText} »
            </p>
          ) : (
            <p className="text-xs text-slate-500 truncate">
              Clique sur moi si tu veux un indice ou une question guidée ! 💡
            </p>
          )}
        </div>

        {interactive && (
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors group-hover:scale-105"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Aide & Indice</span>
          </button>
        )}
      </div>
    );
  }

  // Inline layout (e.g. for banners, welcome cards)
  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`flex items-center gap-3 ${interactive ? 'cursor-pointer group' : ''}`}
    >
      <div className="shrink-0">
        <NeoCharacter state={emotion} size={size === 'sm' ? 44 : size === 'md' ? 68 : 96} interactive={interactive} />
      </div>

      {showSpeechBubble && bubbleText && (
        <div className="bg-white border border-sky-200 rounded-2xl p-3 shadow-xs max-w-sm relative group-hover:border-sky-300 transition-colors">
          <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Néo
          </div>
          <p className="text-xs font-medium text-slate-700 leading-snug">
            {bubbleText}
          </p>
          {subText && (
            <p className="text-[10px] text-slate-400 mt-0.5">{subText}</p>
          )}
        </div>
      )}
    </div>
  );
};
