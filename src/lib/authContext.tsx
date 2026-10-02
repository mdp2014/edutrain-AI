import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, Role } from '../types';
import { db } from './firebase';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore active user session from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('edutrain_active_user');
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem('edutrain_active_user');
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanId = identifier.trim().toLowerCase();

    // 1. Try server endpoint
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: pass }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('edutrain_active_user', JSON.stringify(data.user));
        return { success: true };
      } else {
        // If the server answered, return its validation message immediately
        return { success: false, error: data.error || 'Identifiant ou mot de passe incorrect.' };
      }
    } catch (err) {
      console.warn('API login network notice, attempting Firestore fallback...', err);
    }

    // 2. Direct Firestore fallback (only if server was completely unreachable)
    try {
      // Check teacher
      if (
        cleanId === 'solene' ||
        cleanId === 'solène' ||
        cleanId === 'solene.depibrac' ||
        cleanId === 'solene.depibrac@edutrain.fr'
      ) {
        if (pass === 'marinetpaul') {
          const teacherUser: UserProfile = {
            id: 'teacher-solene-depibrac',
            firstName: 'Solène',
            lastName: 'De Pibrac',
            email: 'solene.depibrac@edutrain.fr',
            role: 'teacher',
            classId: 'class-cm2',
            className: 'CM2',
            createdAt: '2026-09-01T08:00:00.000Z',
          };
          setUser(teacherUser);
          localStorage.setItem('edutrain_active_user', JSON.stringify(teacherUser));
          return { success: true };
        }
        return { success: false, error: 'Mot de passe incorrect pour le compte enseignant.' };
      }

      // Check student in Firestore
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      let foundStudent: UserProfile | null = null;
      let matchedPassword = false;

      snap.forEach((d) => {
        const data = d.data();
        const email = (data.email || '').toLowerCase();
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase().trim();
        const firstName = (data.firstName || '').toLowerCase();
        if (email === cleanId || fullName === cleanId || firstName === cleanId) {
          if (data.password && data.password === pass) {
            matchedPassword = true;
            foundStudent = {
              id: d.id,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              role: 'student',
              classId: data.classId || 'class-cm2',
              className: data.className || 'CM2',
              createdAt: data.createdAt || new Date().toISOString(),
            };
          }
        }
      });

      if (foundStudent && matchedPassword) {
        setUser(foundStudent);
        localStorage.setItem('edutrain_active_user', JSON.stringify(foundStudent));
        return { success: true };
      }
    } catch (fsErr) {
      console.warn('Firestore fallback login notice:', fsErr);
    }

    return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
  };

  const registerStudent = async (
    firstName: string,
    lastName: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firstName.trim() || !lastName.trim()) {
      return { success: false, error: 'Veuillez saisir votre prénom et votre nom.' };
    }
    if (pass.length < 6) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' };
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    const email = `${sanitize(cleanFirst)}.${sanitize(cleanLast)}@cm2.edutrain.fr`;
    const studentId = `student-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const newStudentProfile: UserProfile = {
      id: studentId,
      firstName: cleanFirst,
      lastName: cleanLast,
      email,
      role: 'student',
      classId: 'class-cm2',
      className: 'CM2',
      createdAt: new Date().toISOString(),
    };

    let serverSuccess = false;

    // 1. Post to Server API
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: cleanFirst,
          lastName: cleanLast,
          password: pass,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('edutrain_active_user', JSON.stringify(data.user));
        serverSuccess = true;
      }
    } catch (apiErr) {
      console.warn('Server registration notice:', apiErr);
    }

    // 2. Write directly to Firestore to guarantee persistence
    try {
      await setDoc(doc(db, 'users', newStudentProfile.id), {
        ...newStudentProfile,
        fullName: `${cleanFirst} ${cleanLast}`,
        password: pass,
      });
      console.log('[Auth] User registered directly in Firestore:', newStudentProfile.id);
    } catch (fsErr) {
      console.warn('Firestore direct write notice:', fsErr);
    }

    // If server didn't set user, set it locally from profile
    if (!serverSuccess) {
      setUser(newStudentProfile);
      localStorage.setItem('edutrain_active_user', JSON.stringify(newStudentProfile));
    }

    return { success: true };
  };

  const updateUserPassword = async (newPass: string): Promise<{ success: boolean; error?: string }> => {
    if (newPass.length < 6) {
      return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' };
    }

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, newPassword: newPass }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Erreur de mise à jour' };
    } catch (err: any) {
      return { success: false, error: 'Erreur réseau.' };
    }
  };

  const logout = async () => {
    localStorage.removeItem('edutrain_active_user');
    setUser(null);
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
