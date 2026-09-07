/**
 * Вход в админку. Supabase Auth по паролю: своей авторизации не пишем.
 *
 * Пользователь заводится один раз в панели Supabase (Authentication → Users),
 * затем при первом входе связывается с человеком в системе вызовом core.link_me.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { fetchMe, linkMe } from '@/lib/supabase/queries';

const AuthContext = createContext({
  session: null, person: null, loading: true, configured: false,
  signIn: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session ?? null); setLoading(false); }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (!next) setPerson(null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  // Кто вошедший в терминах системы. Если человека ещё нет — заводим и
  // назначаем роль владельца: это первый вход основателя.
  useEffect(() => {
    if (!session?.user) return;
    let alive = true;
    (async () => {
      try {
        let me = await fetchMe(session.user.id);
        if (!me) {
          await linkMe(session.user.email, session.user.email?.split('@')[0] || 'Владелец');
          me = await fetchMe(session.user.id);
        }
        if (alive) setPerson(me);
      } catch (error) {
        console.error('Не удалось определить пользователя:', error.message);
      }
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    session,
    person,
    loading,
    configured: isSupabaseConfigured,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, person, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
