/**
 * Вход в админку. Supabase Auth по паролю: своей авторизации не пишем.
 *
 * Пользователь заводится один раз в панели Supabase (Authentication → Users),
 * затем при первом входе связывается с человеком в системе вызовом core.link_me.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { fetchMe, fetchMyRoles, linkMe } from '@/lib/supabase/queries';

const AuthContext = createContext({
  session: null, person: null, roles: [], isOwner: false, loading: true, configured: false,
  signIn: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [person, setPerson] = useState(null);
  // Роли спрашиваем у базы, а не выводим из чего-то на клиенте: доступ всё
  // равно решает база, и знать здесь надо ровно то, что решила она —
  // иначе меню и права разойдутся, и разойдутся молча.
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session ?? null); setLoading(false); }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (!next) { setPerson(null); setRoles([]); }
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
        if (!alive) return;
        setPerson(me);
        setRoles(await fetchMyRoles());
      } catch (error) {
        console.error('Не удалось определить пользователя:', error.message);
      }
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    session,
    person,
    roles,
    isOwner: roles.includes('owner'),
    loading,
    configured: isSupabaseConfigured,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, person, roles, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
