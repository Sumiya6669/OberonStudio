/**
 * Страж маршрутов админки.
 *
 * Это удобство, а не защита: настоящая защита — политики RLS в базе.
 * Даже если кто-то откроет /admin, без сессии он не получит ни одной строки.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Spinner } from './ui';

export default function RequireAuth({ children }) {
  const { session, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-lg font-semibold">Панель не настроена</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Задайте <code className="text-blue">VITE_SUPABASE_URL</code> и{' '}
          <code className="text-blue">VITE_SUPABASE_ANON_KEY</code> в переменных окружения
          и пересоберите сайт. Публичная часть работает без них.
        </p>
      </div>
    );
  }

  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
