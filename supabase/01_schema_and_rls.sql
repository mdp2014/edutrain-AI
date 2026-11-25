-- ============================================================================
-- EduTrain AI (CM2) - Schéma complet Supabase (PostgreSQL) & Sécurité RLS
-- À exécuter dans : Supabase Dashboard -> SQL Editor -> New query
-- ============================================================================

-- 1. Extensions utiles
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 2. TABLES & RELATIONS
-- ============================================================================

-- 2.1 Classes
CREATE TABLE IF NOT EXISTS public.classes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL CHECK (char_length(name) <= 32),
  teacher_id   TEXT NOT NULL,
  teacher_name TEXT NOT NULL CHECK (char_length(teacher_name) <= 64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Utilisateurs (Enseignante + Élèves CM2)
-- auth_id relie chaque profil à Supabase Auth (auth.users) pour le RLS strict
CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT PRIMARY KEY,
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name  TEXT NOT NULL CHECK (char_length(first_name) <= 64),
  last_name   TEXT NOT NULL CHECK (char_length(last_name) <= 64),
  full_name   TEXT GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED,
  email       TEXT NOT NULL UNIQUE CHECK (char_length(email) <= 128),
  identifier  TEXT UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  class_id    TEXT NOT NULL REFERENCES public.classes(id) ON UPDATE CASCADE,
  class_name  TEXT NOT NULL DEFAULT 'CM2',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_class_id ON public.users(class_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 2.3 Exercices (banque de démarrage + exercices personnalisés)
CREATE TABLE IF NOT EXISTS public.exercises (
  id             TEXT PRIMARY KEY,
  student_id     TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL CHECK (subject IN ('Mathématiques', 'Français')),
  skill          TEXT NOT NULL CHECK (char_length(skill) <= 64),
  difficulty     TEXT NOT NULL CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  question       TEXT NOT NULL CHECK (char_length(question) <= 1000),
  type           TEXT NOT NULL CHECK (type IN ('qcm', 'numeric', 'boolean', 'text')),
  options        JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL CHECK (char_length(correct_answer) <= 200),
  explanation    TEXT NOT NULL CHECK (char_length(explanation) <= 1000),
  assigned_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_subject_skill ON public.exercises(subject, skill, difficulty);
CREATE INDEX IF NOT EXISTS idx_exercises_student_id ON public.exercises(student_id);

-- 2.4 Tentatives d'exercices (Historique complet)
CREATE TABLE IF NOT EXISTS public.attempts (
  id             TEXT PRIMARY KEY,
  exercise_id    TEXT NOT NULL,
  student_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name   TEXT NOT NULL,
  subject        TEXT NOT NULL CHECK (subject IN ('Mathématiques', 'Français')),
  skill          TEXT NOT NULL CHECK (char_length(skill) <= 64),
  difficulty     TEXT NOT NULL DEFAULT 'moyen' CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  question       TEXT NOT NULL,
  answer         TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct     BOOLEAN NOT NULL,
  score          INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  time_spent     INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  explanation    TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_student_id ON public.attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_student_skill ON public.attempts(student_id, skill);

-- 2.5 Progression agrégée par élève et par compétence
CREATE TABLE IF NOT EXISTS public.progress (
  id               TEXT PRIMARY KEY,
  student_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL CHECK (subject IN ('Mathématiques', 'Français')),
  skill            TEXT NOT NULL CHECK (char_length(skill) <= 64),
  score            INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  total_attempts   INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  correct_attempts INTEGER NOT NULL DEFAULT 0 CHECK (correct_attempts >= 0),
  level            TEXT NOT NULL DEFAULT 'moyen' CHECK (level IN ('facile', 'moyen', 'difficile')),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject, skill)
);

CREATE INDEX IF NOT EXISTS idx_progress_student_id ON public.progress(student_id);

-- 2.6 Rapports pédagogiques générés pour l'enseignante
CREATE TABLE IF NOT EXISTS public.reports (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  teacher_id      TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  summary         TEXT NOT NULL,
  mastered_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulties    JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequent_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_student_id ON public.reports(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_teacher_id ON public.reports(teacher_id, created_at DESC);

-- ============================================================================
-- 3. FONCTIONS HELPER SÉCURISÉES (AUTH & PROGRESSION ATOMIQUE)
-- ============================================================================

-- Récupère l'identifiant profil (public.users.id) de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Vérifie si l'utilisateur connecté a le rôle 'teacher'
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'teacher'
  );
$$;

-- Permet aux élèves de CM2 de se connecter par prénom, "prénom nom", identifiant ou email
-- Ne renvoie QUE l'email virtuel pour déclencher supabase.auth.signInWithPassword()
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(p_identifier));
  v_email TEXT;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  -- Alias connus pour l'enseignante
  IF v_clean IN ('solene', 'solène', 'solene.depibrac', 'solene.depibrac@edutrain.fr') THEN
    SELECT email INTO v_email FROM public.users WHERE role = 'teacher' LIMIT 1;
    RETURN v_email;
  END IF;

  SELECT email INTO v_email
  FROM public.users
  WHERE lower(email) = v_clean
     OR lower(coalesce(identifier, '')) = v_clean
     OR lower(full_name) = v_clean
     OR lower(first_name) = v_clean
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

-- Enregistre une tentative ET recalcule la progression de façon atomique
CREATE OR REPLACE FUNCTION public.record_attempt_and_progress(
  p_id             TEXT,
  p_exercise_id    TEXT,
  p_student_id     TEXT,
  p_student_name   TEXT,
  p_subject        TEXT,
  p_skill          TEXT,
  p_difficulty     TEXT,
  p_question       TEXT,
  p_answer         TEXT,
  p_correct_answer TEXT,
  p_is_correct     BOOLEAN,
  p_score          INTEGER,
  p_time_spent     INTEGER,
  p_explanation    TEXT
)
RETURNS public.progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id TEXT := public.current_profile_id();
  v_total     INTEGER;
  v_correct   INTEGER;
  v_score     INTEGER;
  v_level     TEXT := 'moyen';
  v_recent_ok INTEGER;
  v_recent_2  INTEGER;
  v_prog_id   TEXT;
  v_result    public.progress;
BEGIN
  -- Vérification stricte : l'élève ne peut écrire que pour lui-même (ou l'enseignante)
  IF v_caller_id IS NULL OR (v_caller_id <> p_student_id AND NOT public.is_teacher()) THEN
    RAISE EXCEPTION 'Accès refusé : vous ne pouvez enregistrer que vos propres tentatives.';
  END IF;

  INSERT INTO public.attempts (
    id, exercise_id, student_id, student_name, subject, skill, difficulty,
    question, answer, correct_answer, is_correct, score, time_spent, explanation
  ) VALUES (
    p_id, p_exercise_id, p_student_id, p_student_name, p_subject, p_skill,
    coalesce(p_difficulty, 'moyen'), p_question, p_answer, p_correct_answer,
    p_is_correct, p_score, coalesce(p_time_spent, 0), coalesce(p_explanation, '')
  );

  SELECT count(*), count(*) FILTER (WHERE is_correct)
    INTO v_total, v_correct
  FROM public.attempts
  WHERE student_id = p_student_id AND subject = p_subject AND skill = p_skill;

  v_score := CASE WHEN v_total > 0 THEN round((v_correct::numeric / v_total) * 100)::integer ELSE 0 END;

  SELECT count(*) FILTER (WHERE is_correct)
    INTO v_recent_ok
  FROM (
    SELECT is_correct FROM public.attempts
    WHERE student_id = p_student_id AND subject = p_subject AND skill = p_skill
    ORDER BY created_at DESC LIMIT 3
  ) t;

  SELECT count(*) FILTER (WHERE NOT is_correct)
    INTO v_recent_2
  FROM (
    SELECT is_correct FROM public.attempts
    WHERE student_id = p_student_id AND subject = p_subject AND skill = p_skill
    ORDER BY created_at DESC LIMIT 2
  ) t2;

  IF v_total >= 3 AND v_recent_ok = 3 THEN
    v_level := CASE WHEN v_score > 85 THEN 'difficile' ELSE 'moyen' END;
  ELSIF v_total >= 2 AND v_recent_2 = 2 THEN
    v_level := 'facile';
  ELSE
    v_level := CASE WHEN v_score >= 75 THEN 'moyen' ELSE 'facile' END;
  END IF;

  v_prog_id := 'prog-' || p_student_id || '-' || regexp_replace(lower(p_skill), '[^a-z0-9]', '-', 'g');

  INSERT INTO public.progress (
    id, student_id, subject, skill, score, total_attempts, correct_attempts, level, updated_at
  ) VALUES (
    v_prog_id, p_student_id, p_subject, p_skill, v_score, v_total, v_correct, v_level, NOW()
  )
  ON CONFLICT (student_id, subject, skill)
  DO UPDATE SET
    score            = EXCLUDED.score,
    total_attempts   = EXCLUDED.total_attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    level            = EXCLUDED.level,
    updated_at       = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_attempt_and_progress(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,INTEGER,INTEGER,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attempt_and_progress(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,INTEGER,INTEGER,TEXT) TO authenticated;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.classes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports   ENABLE ROW LEVEL SECURITY;

-- --- POLICIES: classes ---
DROP POLICY IF EXISTS "classes_select_authenticated" ON public.classes;
CREATE POLICY "classes_select_authenticated"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "classes_manage_teacher" ON public.classes;
CREATE POLICY "classes_manage_teacher"
  ON public.classes FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- --- POLICIES: users ---
DROP POLICY IF EXISTS "users_select_own_or_teacher" ON public.users;
CREATE POLICY "users_select_own_or_teacher"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid() OR public.is_teacher());

-- Un nouvel élève peut créer son propre profil lors de l'inscription (strictement role = 'student')
DROP POLICY IF EXISTS "users_insert_self_student" ON public.users;
CREATE POLICY "users_insert_self_student"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid() AND role = 'student');

DROP POLICY IF EXISTS "users_update_teacher" ON public.users;
CREATE POLICY "users_update_teacher"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "users_delete_student_by_teacher" ON public.users;
CREATE POLICY "users_delete_student_by_teacher"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.is_teacher() AND role = 'student');

-- --- POLICIES: exercises ---
DROP POLICY IF EXISTS "exercises_select_authenticated" ON public.exercises;
CREATE POLICY "exercises_select_authenticated"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (
    student_id IS NULL
    OR student_id = public.current_profile_id()
    OR public.is_teacher()
  );

DROP POLICY IF EXISTS "exercises_manage_teacher" ON public.exercises;
CREATE POLICY "exercises_manage_teacher"
  ON public.exercises FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- --- POLICIES: attempts ---
DROP POLICY IF EXISTS "attempts_select_own_or_teacher" ON public.attempts;
CREATE POLICY "attempts_select_own_or_teacher"
  ON public.attempts FOR SELECT
  TO authenticated
  USING (student_id = public.current_profile_id() OR public.is_teacher());

DROP POLICY IF EXISTS "attempts_insert_own" ON public.attempts;
CREATE POLICY "attempts_insert_own"
  ON public.attempts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = public.current_profile_id());

DROP POLICY IF EXISTS "attempts_delete_teacher" ON public.attempts;
CREATE POLICY "attempts_delete_teacher"
  ON public.attempts FOR DELETE
  TO authenticated
  USING (public.is_teacher());

-- --- POLICIES: progress ---
DROP POLICY IF EXISTS "progress_select_own_or_teacher" ON public.progress;
CREATE POLICY "progress_select_own_or_teacher"
  ON public.progress FOR SELECT
  TO authenticated
  USING (student_id = public.current_profile_id() OR public.is_teacher());

DROP POLICY IF EXISTS "progress_insert_own" ON public.progress;
CREATE POLICY "progress_insert_own"
  ON public.progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = public.current_profile_id());

DROP POLICY IF EXISTS "progress_update_own" ON public.progress;
CREATE POLICY "progress_update_own"
  ON public.progress FOR UPDATE
  TO authenticated
  USING (student_id = public.current_profile_id())
  WITH CHECK (student_id = public.current_profile_id());

DROP POLICY IF EXISTS "progress_delete_teacher" ON public.progress;
CREATE POLICY "progress_delete_teacher"
  ON public.progress FOR DELETE
  TO authenticated
  USING (public.is_teacher());

-- --- POLICIES: reports ---
DROP POLICY IF EXISTS "reports_teacher_only" ON public.reports;
CREATE POLICY "reports_teacher_only"
  ON public.reports FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- ============================================================================
-- 5. PRIVILÈGES DE BASE POUR POSTGREST (ENCADRÉS PAR RLS)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

