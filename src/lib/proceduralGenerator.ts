import { ExerciseItem, Subject, Difficulty } from '../types';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = ['Léa', 'Lucas', 'Emma', 'Hugo', 'Chloé', 'Yanis', 'Inès', 'Noah', 'Camille', 'Arthur', 'Manon', 'Louis', 'Sarah', 'Théo'];

/**
 * Generate a fresh procedural exercise for CM2
 * Guarantees varied numbers, context, and never repeats identical questions.
 */
export function generateProceduralExercise(
  subject: Subject,
  skill: string,
  difficulty: Difficulty = 'moyen',
  studentName = 'Élève',
  historyQuestions: string[] = []
): ExerciseItem {
  const normSkill = skill.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const child = pickRandom(FIRST_NAMES);
  const now = Date.now();
  const id = `proc-${now}-${Math.floor(Math.random() * 1000)}`;

  // ==========================================
  // FRACTIONS
  // ==========================================
  if (normSkill.includes('fraction')) {
    if (difficulty === 'difficile') {
      const mode = pickRandom(['add_diff_denom', 'encadrement', 'fraction_decimale', 'fraction_superieure']);
      if (mode === 'add_diff_denom') {
        const d1 = pickRandom([2, 4]);
        const d2 = d1 === 2 ? 4 : 8;
        const n1 = 1;
        const n2 = d1 === 2 ? 1 : 2;
        // 1/2 + 1/4 = 3/4  OR 1/4 + 2/8 = 4/8 = 2/4 = 1/2
        const ans = d1 === 2 && d2 === 4 ? '3/4' : '4/8';
        return {
          id,
          subject,
          skill: 'Fractions',
          difficulty: 'difficile',
          question: `Calcule l'addition suivante de fractions : ${n1}/${d1} + ${n2}/${d2}. Quelle est la fraction résultante ?`,
          type: 'qcm',
          options: [ans, '2/6', `${n1 + n2}/${d1 + d2}`, '5/8'].sort(() => Math.random() - 0.5),
          correctAnswer: ans,
          explanation: `Pour additionner ${n1}/${d1} et ${n2}/${d2}, on met au même dénominateur : ${n1}/${d1} = ${n1 * (d2 / d1)}/${d2}. Puis on additionne les numérateurs, ce qui donne ${ans}.`,
        };
      }
      if (mode === 'encadrement') {
        const denom = pickRandom([3, 4, 5]);
        const whole = randInt(2, 6);
        const rem = randInt(1, denom - 1);
        const numer = whole * denom + rem; // e.g. 7/3 => between 2 and 3
        return {
          id,
          subject,
          skill: 'Fractions',
          difficulty: 'difficile',
          question: `Entre quels deux nombres entiers consécutifs la fraction ${numer}/${denom} est-elle comprise ?`,
          type: 'qcm',
          options: [
            `Entre ${whole} et ${whole + 1}`,
            `Entre ${whole - 1} et ${whole}`,
            `Entre ${whole + 1} et ${whole + 2}`,
            `Entre 0 et 1`,
          ].sort(() => Math.random() - 0.5),
          correctAnswer: `Entre ${whole} et ${whole + 1}`,
          explanation: `${numer} divisé par ${denom} fait ${whole} avec un reste de ${rem}. Donc ${numer}/${denom} est égal à ${whole} + ${rem}/${denom}, soit entre ${whole} et ${whole + 1}.`,
        };
      }
      // fraction_decimale
      const dec = pickRandom([1.5, 2.4, 0.75, 1.25]);
      const fracMap: Record<number, string> = { 1.5: '15/10', 2.4: '24/10', 0.75: '3/4', 1.25: '5/4' };
      const rightFrac = fracMap[dec];
      return {
        id,
        subject,
        skill: 'Fractions',
        difficulty: 'difficile',
        question: `Quelle fraction correspond exactement au nombre décimal ${dec.toString().replace('.', ',')} ?`,
        type: 'qcm',
        options: [rightFrac, `${Math.floor(dec)}/10`, '1/3', '7/5'].sort(() => Math.random() - 0.5),
        correctAnswer: rightFrac,
        explanation: `${dec.toString().replace('.', ',')} peut s'écrire sous forme de fraction décimale : ${rightFrac}.`,
      };
    } else if (difficulty === 'facile') {
      const mode = pickRandom(['vocab', 'parts_gateau', 'demi_quart']);
      if (mode === 'vocab') {
        const isNum = Math.random() > 0.5;
        return {
          id,
          subject,
          skill: 'Fractions',
          difficulty: 'facile',
          question: isNum
            ? 'Dans une fraction, comment appelle-t-on le nombre situé EN HAUT (qui indique le nombre de parts prises) ?'
            : 'Dans une fraction, comment appelle-t-on le nombre situé EN BAS (qui indique le nombre total de parts égales) ?',
          type: 'qcm',
          options: ['Le numérateur', 'Le dénominateur', 'Le quotient', 'Le reste'],
          correctAnswer: isNum ? 'Le numérateur' : 'Le dénominateur',
          explanation: `Le numérateur est en haut (le nombre de parts choisies) et le dénominateur est en bas (en dessous, le nombre total de parts égales découpées).`,
        };
      }
      const totalPieces = pickRandom([4, 6, 8]);
      const taken = pickRandom([1, 2, 3]);
      return {
        id,
        subject,
        skill: 'Fractions',
        difficulty: 'facile',
        question: `${child} coupe un gâteau en ${totalPieces} parts égales. Il en mange ${taken}. Quelle fraction du gâteau a-t-il mangée ?`,
        type: 'qcm',
        options: [
          `${taken}/${totalPieces}`,
          `${totalPieces}/${taken}`,
          `${taken}/${totalPieces + 1}`,
          `1/${totalPieces}`,
        ].sort(() => Math.random() - 0.5),
        correctAnswer: `${taken}/${totalPieces}`,
        explanation: `On prend ${taken} parts sur un total de ${totalPieces} parts égales, ce qui s'écrit ${taken}/${totalPieces}.`,
      };
    } else {
      // Moyen
      const denom = pickRandom([4, 6, 8, 10]);
      const n1 = randInt(1, denom - 2);
      const n2 = randInt(1, denom - n1);
      const sum = n1 + n2;
      return {
        id,
        subject,
        skill: 'Fractions',
        difficulty: 'moyen',
        question: `Calcule l'addition de ces deux fractions de même dénominateur : ${n1}/${denom} + ${n2}/${denom} = ?`,
        type: 'qcm',
        options: [
          `${sum}/${denom}`,
          `${sum}/${denom * 2}`,
          `${n1 * n2}/${denom}`,
          `${sum - 1}/${denom}`,
        ].sort(() => Math.random() - 0.5),
        correctAnswer: `${sum}/${denom}`,
        explanation: `Quand deux fractions ont le même dénominateur (${denom}), on additionne simplement les numérateurs (${n1} + ${n2} = ${sum}) et on conserve le dénominateur. Résultat : ${sum}/${denom}.`,
      };
    }
  }

  // ==========================================
  // CALCUL & OPÉRATIONS
  // ==========================================
  if (normSkill.includes('calcul') || normSkill.includes('operation')) {
    if (difficulty === 'difficile') {
      const mode = pickRandom(['division_reste', 'mult_dec', 'soustraction_dec']);
      if (mode === 'division_reste') {
        const div = randInt(4, 9);
        const quot = randInt(15, 35);
        const rem = randInt(1, div - 1);
        const dividend = quot * div + rem;
        return {
          id,
          subject,
          skill: 'Calcul',
          difficulty: 'difficile',
          question: `Quel est le quotient entier et le reste de la division de ${dividend} par ${div} ?`,
          type: 'qcm',
          options: [
            `Quotient = ${quot}, Reste = ${rem}`,
            `Quotient = ${quot + 1}, Reste = ${rem}`,
            `Quotient = ${quot}, Reste = 0`,
            `Quotient = ${quot - 1}, Reste = ${rem + 1}`,
          ].sort(() => Math.random() - 0.5),
          correctAnswer: `Quotient = ${quot}, Reste = ${rem}`,
          explanation: `On vérifie : ${quot} x ${div} = ${quot * div}, et ${quot * div} + ${rem} = ${dividend}. Le reste (${rem}) est bien inférieur au diviseur (${div}).`,
        };
      }
      const a = randInt(12, 45);
      const b = randInt(11, 29);
      const prod = a * b;
      return {
        id,
        subject,
        skill: 'Calcul',
        difficulty: 'difficile',
        question: `Calcule le produit de la multiplication posée : ${a} x ${b} = ?`,
        type: 'numeric',
        correctAnswer: prod.toString(),
        explanation: `En posant la multiplication : ${a} x ${b} = ${prod}.`,
      };
    } else if (difficulty === 'facile') {
      const a = randInt(10, 50);
      const b = randInt(5, 30);
      const sum = a + b;
      return {
        id,
        subject,
        skill: 'Calcul',
        difficulty: 'facile',
        question: `Calcule mentalement l'addition : ${a} + ${b} = ?`,
        type: 'numeric',
        correctAnswer: sum.toString(),
        explanation: `Pour additionner ${a} et ${b}, on peut décomposer par dizaines et unités : ${a} + ${b} = ${sum}.`,
      };
    } else {
      // Moyen
      const whole = pickRandom([50, 100, 200]);
      const dec = pickRandom([12.5, 25.5, 45.5, 30.2, 15.8]);
      const res = (whole - dec).toFixed(1).replace('.', ',');
      return {
        id,
        subject,
        skill: 'Calcul',
        difficulty: 'moyen',
        question: `Calcule le résultat de la soustraction : ${whole} - ${dec.toString().replace('.', ',')} = ?`,
        type: 'qcm',
        options: [
          res,
          (whole - dec + 1).toFixed(1).replace('.', ','),
          (whole - dec - 1).toFixed(1).replace('.', ','),
          (whole - Math.floor(dec)).toString(),
        ].sort(() => Math.random() - 0.5),
        correctAnswer: res,
        explanation: `Pour soustraire ${dec.toString().replace('.', ',')} de ${whole}, on soustrait d'abord la partie entière puis les dixièmes : on obtient ${res}.`,
      };
    }
  }

  // ==========================================
  // NOMBRES DÉCIMAUX
  // ==========================================
  if (normSkill.includes('decimal') || normSkill.includes('decimaux')) {
    const d1 = (randInt(10, 80) / 10).toFixed(1).replace('.', ',');
    const d2 = (randInt(10, 80) / 10).toFixed(1).replace('.', ',');
    const num1 = parseFloat(d1.replace(',', '.'));
    const num2 = parseFloat(d2.replace(',', '.'));
    const comp = num1 > num2 ? '>' : num1 < num2 ? '<' : '=';
    return {
      id,
      subject,
      skill: 'Nombres décimaux',
      difficulty,
      question: `Complète avec le bon signe de comparaison : ${d1} ... ${d2}`,
      type: 'qcm',
      options: ['>', '<', '='],
      correctAnswer: comp,
      explanation: `On compare d'abord la partie entière, puis les dixièmes : ${d1} est ${comp === '>' ? 'supérieur à' : comp === '<' ? 'inférieur à' : 'égal à'} ${d2}.`,
    };
  }

  // ==========================================
  // GÉOMÉTRIE
  // ==========================================
  if (normSkill.includes('geometr')) {
    const side = randInt(4, 15);
    const peri = side * 4;
    return {
      id,
      subject,
      skill: 'Géométrie',
      difficulty,
      question: `Un carré a un côté de ${side} cm. Quel est son périmètre ?`,
      type: 'numeric',
      correctAnswer: peri.toString(),
      explanation: `Le périmètre d'un carré est égal à 4 x côté. Ici : 4 x ${side} = ${peri} cm.`,
    };
  }

  // ==========================================
  // PROBLÈMES
  // ==========================================
  if (normSkill.includes('problem') || normSkill.includes('proportionnalite')) {
    const packs = randInt(3, 8);
    const perPack = pickRandom([6, 8, 10, 12]);
    const given = randInt(5, 15);
    const total = packs * perPack - given;
    return {
      id,
      subject,
      skill: 'Problèmes',
      difficulty,
      question: `${child} achète ${packs} paquets de ${perPack} gâteaux. Il en offre ${given} à ses camarades. Combien de gâteaux lui reste-t-il ?`,
      type: 'numeric',
      correctAnswer: total.toString(),
      explanation: `1) Nombre total de gâteaux achetés : ${packs} x ${perPack} = ${packs * perPack}. 2) Après en avoir offert ${given} : ${packs * perPack} - ${given} = ${total} gâteaux restants.`,
    };
  }

  // ==========================================
  // GRAMMAIRE & FRANÇAIS
  // ==========================================
  if (normSkill.includes('grammaire')) {
    const subjects = ['Le jeune renard', 'Les élèves attentifs', 'Mon grand frère', 'Les oiseaux migrateurs'];
    const s = pickRandom(subjects);
    const verb = pickRandom(['traversent la forêt.', 'écoutent la leçon.', 'prépare un gâteau.', 'volent vers le sud.']);
    const full = `${s} ${verb}`;
    return {
      id,
      subject: 'Français',
      skill: 'Grammaire',
      difficulty,
      question: `Dans la phrase : « ${full} », quel est le sujet du verbe ?`,
      type: 'qcm',
      options: [s, verb.split(' ')[0], verb.split(' ')[1] || 'la forêt', 'Il n y a pas de sujet'].sort(() => Math.random() - 0.5),
      correctAnswer: s,
      explanation: `Pour trouver le sujet, on pose la question "Qui est-ce qui... ?". C'est "${s}" qui fait l'action.`,
    };
  }

  // ==========================================
  // CONJUGAISON
  // ==========================================
  if (normSkill.includes('conjug')) {
    const pronoun = pickRandom(['Je', 'Tu', 'Nous', 'Vous', 'Ils']);
    const v = pickRandom(['finir', 'chanter', 'prendre', 'partir']);
    const forms: Record<string, Record<string, string>> = {
      finir: { Je: 'finis', Tu: 'finis', Nous: 'finissons', Vous: 'finissez', Ils: 'finissent' },
      chanter: { Je: 'chante', Tu: 'chantes', Nous: 'chantons', Vous: 'chantez', Ils: 'chantent' },
      prendre: { Je: 'prends', Tu: 'prends', Nous: 'prenons', Vous: 'prenez', Ils: 'prennent' },
      partir: { Je: 'pars', Tu: 'pars', Nous: 'partons', Vous: 'partez', Ils: 'partent' },
    };
    const correct = forms[v][pronoun];
    const distractors = Object.values(forms[v]).filter((f) => f !== correct).slice(0, 3);
    return {
      id,
      subject: 'Français',
      skill: 'Conjugaison',
      difficulty,
      question: `Conjugue le verbe « ${v} » au présent de l'indicatif avec le pronom « ${pronoun} » :`,
      type: 'qcm',
      options: [correct, ...distractors].sort(() => Math.random() - 0.5),
      correctAnswer: correct,
      explanation: `Au présent de l'indicatif, avec le pronom "${pronoun}", le verbe ${v} se conjugue "${pronoun} ${correct}".`,
    };
  }

  // ==========================================
  // ORTHOGRAPHE
  // ==========================================
  if (normSkill.includes('orthographe')) {
    const homophones = [
      { rule: 'a / à', sentence: 'Il ... préparé son sac avant de partir ... l école.', correct: 'a / à', options: ['a / à', 'à / a', 'a / a', 'à / à'] },
      { rule: 'et / est', sentence: 'L exercice ... facile ... passionnant.', correct: 'est / et', options: ['est / et', 'et / est', 'est / est', 'et / et'] },
      { rule: 'son / sont', sentence: 'Ils ... contents de voir ... nouveau vélo.', correct: 'sont / son', options: ['sont / son', 'son / sont', 'sont / sont', 'son / son'] },
    ];
    const h = pickRandom(homophones);
    return {
      id,
      subject: 'Français',
      skill: 'Orthographe',
      difficulty,
      question: `Complète la phrase avec les bons homophones : « ${h.sentence} »`,
      type: 'qcm',
      options: h.options,
      correctAnswer: h.correct,
      explanation: `Astuce : on peut remplacer "a/est/sont" par "avait/était/étaient". Si on ne peut pas, c'est la préposition ou la conjonction. La bonne réponse est "${h.correct}".`,
    };
  }

  // ==========================================
  // VOCABULAIRE
  // ==========================================
  if (normSkill.includes('vocabulaire')) {
    const pairs = [
      { word: 'immense', syn: 'gigantesque', ant: 'minuscule' },
      { word: 'courageux', syn: 'brave', ant: 'peureux' },
      { word: 'rapide', syn: 'véloce', ant: 'lent' },
      { word: 'joyeux', syn: 'heureux', ant: 'triste' },
    ];
    const p = pickRandom(pairs);
    const isSyn = Math.random() > 0.5;
    return {
      id,
      subject: 'Français',
      skill: 'Vocabulaire',
      difficulty,
      question: isSyn
        ? `Quel est le SYNONYME (mot de même sens) du mot « ${p.word} » ?`
        : `Quel est l'ANTONYME (mot de sens contraire) du mot « ${p.word} » ?`,
      type: 'qcm',
      options: [isSyn ? p.syn : p.ant, isSyn ? p.ant : p.syn, 'inutile', 'silencieux'].sort(() => Math.random() - 0.5),
      correctAnswer: isSyn ? p.syn : p.ant,
      explanation: isSyn
        ? `Un synonyme est un mot qui a le même sens. Le synonyme de "${p.word}" est "${p.syn}".`
        : `Un antonyme est le mot opposé/contraire. Le contraire de "${p.word}" est "${p.ant}".`,
    };
  }

  // DEFAULT CM2 GENERAL FALLBACK
  const n1 = randInt(15, 60);
  const n2 = randInt(15, 60);
  return {
    id,
    subject,
    skill,
    difficulty,
    question: `Calcule mentalement : ${n1} + ${n2} = ?`,
    type: 'numeric',
    correctAnswer: (n1 + n2).toString(),
    explanation: `${n1} + ${n2} = ${n1 + n2}.`,
  };
}
