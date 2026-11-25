import {
  NeoEmotionState,
  NeoHintLevel,
  NeoChatMessage,
  NeoContextPayload,
} from '../types';

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
    const res = await fetch('/api/neo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    console.warn('askNeo call failed:', error);
    return {
      success: false,
      reply: "Bip bip ! 🤖 Néo réfléchit... Relis bien la consigne et avance pas à pas !",
      emotion: 'neo-encouraging',
      suggestedFollowUps: ['Donne-moi un indice', 'Je continue'],
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
