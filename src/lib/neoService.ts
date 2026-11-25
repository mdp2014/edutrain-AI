import {
  NeoEmotionState,
  NeoHintLevel,
  NeoChatMessage,
  NeoContextPayload,
} from '../types';
import { getAuthHeaders } from './supabase';

export interface NeoApiResponse {
  success: boolean;
  reply: string;
  emotion: NeoEmotionState;
  suggestedFollowUps?: string[];
  hintLevel?: NeoHintLevel;
}

/**
 * Ask Néo for pedagogical assistance (powered by Gemini)
 */
export async function askNeo(payload: NeoContextPayload): Promise<NeoApiResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/neo/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erreur réseau: ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      reply: data.reply || "Je suis là avec toi ! Dis-moi ce qui te pose problème.",
      emotion: data.emotion || 'neo-talking',
      suggestedFollowUps: data.suggestedFollowUps || [],
      hintLevel: data.hintLevel,
    };
  } catch (error) {
    console.warn('askNeo call failed, using smart contextual Socratic fallback:', error);
    const studentName = payload.studentName || 'champion';
    const ctx = payload.exerciseContext;
    const level = payload.hintLevel || 1;
    const skill = ctx?.skill || 'cette notion';
    const question = ctx?.question || '';
    const explanation = ctx?.explanation || '';

    let reply = `Coucou ${studentName} ! 🤖 `;
    let emotion: NeoEmotionState = 'neo-encouraging';
    let suggestedFollowUps = ['Donne-moi un autre indice', 'Je réessaie !'];

    if (!ctx || !question) {
      reply += "Je suis prêt à t'accompagner ! Lance une série d'exercices et clique sur moi dès que tu veux un coup de pouce ! 💡";
      emotion = 'neo-happy';
      suggestedFollowUps = ['Comment fonctionnent les indices ?', 'Merci Néo !'];
    } else if (level === 1) {
      reply += `Indice 1 💡 : Lis bien la question en repérant les mots-clés ou les nombres importants dans « ${question.slice(0, 65)}${question.length > 65 ? '...' : ''} ». Que cherche-t-on exactement ?`;
      emotion = 'neo-thinking';
      suggestedFollowUps = ['Indice niveau 2 (Question guidée)', 'J’ai compris !'];
    } else if (level === 2) {
      reply += `Indice 2 🧭 : Pour réussir en ${skill}, demande-toi quelle est la toute première opération ou règle à appliquer avant de conclure.`;
      emotion = 'neo-thinking';
      suggestedFollowUps = ['Indice niveau 3 (Méthode)', 'Je vais essayer !'];
    } else if (level === 3) {
      const methodHint = explanation
        ? explanation.split('.')[0] + '.'
        : `Décompose le problème de ${skill} étape par étape en vérifiant bien chaque donnée de l'énoncé.`;
      reply += `Indice 3 📘 (Méthode) : Voici une piste précieuse sans te donner la réponse finale : ${methodHint}`;
      emotion = 'neo-encouraging';
      suggestedFollowUps = ['Indice niveau 4 (Déblocage pas à pas)', 'Je tente ma réponse !'];
    } else {
      reply += `Indice 4 🚀 (Déblocage) : Tu y es presque ! ${
        explanation
          ? `Rappelle-toi : ${explanation.slice(0, 110)}${explanation.length > 110 ? '...' : ''}`
          : 'Utilise les éléments de la question pour vérifier ton résultat final.'
      } À toi de conclure !`;
      emotion = 'neo-celebrating';
      suggestedFollowUps = ['Merci Néo, je valide !'];
    }

    return {
      success: true,
      reply,
      emotion,
      suggestedFollowUps,
      hintLevel: level,
    };
  }
}

/**
 * Predefined contextual welcome phrases from Néo for various student milestones
 */
export const NEO_MESSAGES = {
  dashboardGreeting: [
    "Salut ! 👋 Prêt pour ton entraînement du jour ?",
    "Bip bip ! 🤖 Heureux de te retrouver pour progresser ensemble !",
    "Coucou ! 🚀 Chaque exercice te rend plus fort en CM2 !",
  ],
  exerciseStart: [
    "On commence ? Tu peux le faire ! 💪",
    "Prends ton temps et lis bien la question ! 📖",
    "Je suis juste là si tu as besoin d'un coup de main ! 🤖",
  ],
  exerciseSuccess: [
    "Bravo ! 🎉 Tu as trouvé la bonne réponse !",
    "Superbe réflexion ! 🌟 Ton cerveau carbure !",
    "Exactement ça ! Tu maîtrises cette notion ! 🚀",
  ],
  exerciseMistake: [
    "Pas grave ! 💪 On va regarder ensemble où ça bloque.",
    "L'erreur, c'est le début de la réussite ! Réessaie calmement.",
    "Courage ! Clique sur moi si tu veux un petit indice 💡.",
  ],
  exerciseThinkingHint: [
    "Besoin d'un petit coup de pouce ? Je suis là ! 💡",
    "Prends une grande inspiration, tu as tous les outils !",
  ],
  streakCelebration: [
    "Waouh ! ⭐ Série terminée avec brio ! Tu as assuré !",
    "Champion(ne) ! 🎉 Tu progresses à pas de géant !",
  ],
  inactivityPrompt: [
    "Tu réfléchis ? Prends ton temps, ou clique sur moi pour un indice ! 💡",
    "Cette question te donne du fil à retordre ? On peut la regarder ensemble ! 😊",
  ],
};
