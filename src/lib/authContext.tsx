import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, Role } from '../types';
import { supabase, isSupabaseConfigured, mapUserRow } from './supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: Role | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerStudent: (firstName: string, lastName: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfileByAuthId(authId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] Profile load notice:', error.message);
    return null;
  }

  return data ? mapUserRow(data) : null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore and listen to Supabase Auth session
  useEffect(() => {
    let active = true;

    const initSession = async () => {
      if (!isSupabaseConfigured) {
        if (active) setLoading(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const authUser = data.session?.user;
        if (authUser) {
          const profile = await fetchProfileByAuthId(authUser.id);
          if (active) setUser(profile);
        } else if (active) {
          setUser(null);
        }
      } catch (err) {
        console.warn('[Supabase] Session init error:', err);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Defer DB query out of the auth callback tick to prevent lock contention
      const uid = session.user.id;
      setTimeout(async () => {
        const profile = await fetchProfileByAuthId(uid);
        if (active) {
          setUser(profile);
          setLoading(false);
        }
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
      };
    }

    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !pass) {
      return { success: false, error: 'Identifiant et mot de passe requis.' };
    }

    try {
      // 1. Resolve first name / full name / alias ("solene") / email into internal Auth email
      const { data: resolvedEmail, error: resolveErr } = await supabase.rpc('resolve_login_email', {
        p_identifier: cleanId,
      });

      if (resolveErr) {
        console.warn('[Supabase] resolve_login_email error:', resolveErr.message);
      }

      const emailToUse =
        typeof resolvedEmail === 'string' && resolvedEmail.includes('@')
          ? resolvedEmail
          : cleanId.includes('@')
          ? cleanId
          : null;

      if (!emailToUse) {
        return {
          success: false,
          error: 'Identifiant introuvable. Veuillez vérifier ou créer un compte élève.',
        };
      }

      // 2. Authenticate with Supabase Auth
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: pass,
      });

      if (signInErr || !authData.user) {
        return {
          success: false,
          error: 'Identifiant ou mot de passe incorrect.',
        };
      }

      // 3. Load linked profile from public.users
      const profile = await fetchProfileByAuthId(authData.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return {
          success: false,
          error:
            'Votre compte Auth est connecté mais le profil public.users n’est pas encore lié ou accessible. Vérifiez les droits SQL GRANT et la liaison auth_id dans Supabase.',
        };
      }

      setUser(profile);
      return { success: true };
    } catch (err) {
      console.error('[Supabase] Login error:', err);
      return { success: false, error: 'Erreur réseau lors de la connexion.' };
    }
  };

  const registerStudent = async (
    firstName: string,
    lastName: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Configuration Supabase manquante.',
      };
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast) {
      return { success: false, error: 'Veuillez saisir votre prénom et votre nom.' };
    }
    if (pass.length < 6) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' };
    }

    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const email = `${sanitize(cleanFirst)}.${sanitize(cleanLast)}@cm2.edutrain.fr`;

    try {
      // 1. Check if this student already exists via resolve_login_email
      const { data: existingEmail } = await supabase.rpc('resolve_login_email', {
        p_identifier: email,
      });
      if (existingEmail) {
        return {
          success: false,
          error: 'Un compte avec ce prénom et ce nom existe déjà. Veuillez vous connecter.',
        };
      }

      // 2. Create account in Supabase Auth (works directly in browser & GitHub Pages when Confirm email is OFF)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            first_name: cleanFirst,
            last_name: cleanLast,
            role: 'student',
          },
        },
      });

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered')) {
          return {
            success: false,
            error: 'Un compte avec ce prénom et ce nom existe déjà. Veuillez vous connecter.',
          };
        }
        return { success: false, error: signUpErr.message };
      }

      // If email confirmation is still enabled on Supabase, fall back to backend auto-confirm if available
      if (!signUpData.session || !signUpData.user) {
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: cleanFirst, lastName: cleanLast, password: pass }),
          });
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const payload = await res.json();
            if (res.ok && payload.success) {
              return await login(email, pass);
            }
            if (payload.error) {
              return { success: false, error: payload.error };
            }
          }
        } catch {
          // Static host without backend
        }
        return {
          success: false,
          error:
            'Désactivez « Confirm email » dans Supabase (Authentication → Providers → Email) pour permettre l’inscription directe des élèves.',
        };
      }

      // 3. Insert profile row into public.users (RLS verifies auth_id = auth.uid() AND role = 'student')
      const studentId = `student-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const { data: insertedRow, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: studentId,
          auth_id: signUpData.user.id,
          first_name: cleanFirst,
          last_name: cleanLast,
          email,
          role: 'student',
          class_id: 'class-cm2',
          class_name: 'CM2',
        })
        .select('*')
        .single();

      if (insertErr || !insertedRow) {
        console.error('[Supabase] Profile insert error:', insertErr);
        return {
          success: false,
          error: 'Compte créé, mais impossible d’enregistrer le profil élève dans la base.',
        };
      }

      setUser(mapUserRow(insertedRow));
      return { success: true };
    } catch (err) {
      console.error('[Supabase] Registration error:', err);
      return { success: false, error: "Erreur réseau lors de l'inscription." };
    }
  };

  const updateUserPassword = async (newPass: string): Promise<{ success: boolean; error?: string }> => {
    if (newPass.length < 6) {
      return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        return { success: false, error: error.message || 'Erreur lors de la mise à jour du mot de passe.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur lors de la mise à jour du mot de passe.' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        login,
        registerStudent,
        logout,
        updateUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
