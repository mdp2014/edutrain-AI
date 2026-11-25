import React from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { AuthPage } from './components/auth/AuthPage';
import { StudentView } from './components/student/StudentView';
import { TeacherView } from './components/teacher/TeacherView';
import { GraduationCap } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-bounce mb-4">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">EduTrain AI</h2>
        <p className="text-xs text-slate-400 mt-1">Chargement de votre espace CM2...</p>
      </div>
    );
  }

  // Not logged in -> Show Login/Register page
  if (!user || !role) {
    return <AuthPage />;
  }

  // Strict role detection (Section 4 & 24)
  if (role === 'teacher') {
    return <TeacherView />;
  }

  return <StudentView />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
