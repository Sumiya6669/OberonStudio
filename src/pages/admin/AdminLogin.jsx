import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button, ErrorNote, Field, inputClass } from '@/components/admin/ui';

export default function AdminLogin() {
  const { session, signIn, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={location.state?.from || '/admin'} replace />;

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-inter">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface/60 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Oberon Core</h1>
          <p className="mt-1 text-xs text-muted-foreground">Вход в рабочую панель</p>
        </div>

        <ErrorNote error={error} />

        <Field label="Почта">
          <input type="email" required autoComplete="username" className={inputClass}
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field label="Пароль">
          <input type="password" required autoComplete="current-password" className={inputClass}
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <Button type="submit" disabled={busy || !configured} className="w-full">
          {busy ? 'Проверяем…' : 'Войти'}
        </Button>

        {!configured && (
          <p className="text-center text-xs text-muted-foreground">
            Переменные Supabase не заданы — вход отключён.
          </p>
        )}
      </form>
    </div>
  );
}
