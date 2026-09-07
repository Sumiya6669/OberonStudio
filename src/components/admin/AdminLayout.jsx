/**
 * Раскладка админки. Отдельная от публичной: у сайта своя навигация и
 * фоновые эффекты, здесь нужна плотность и скорость.
 */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Building2, Database, Clock, ListTodo, LogOut, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { cx } from './ui';

const NAV = [
  { to: '/admin',           end: true, label: 'Обзор',          icon: LayoutDashboard },
  { to: '/admin/tickets',   label: 'Заявки',                    icon: Inbox },
  { to: '/admin/companies', label: 'Компании',                  icon: Building2 },
  { to: '/admin/configs',   label: 'Конфигурации 1С',           icon: Database },
  { to: '/admin/time',      label: 'Время',                     icon: Clock },
  { to: '/admin/queue',     label: 'Очередь и журнал',          icon: ListTodo },
];

export default function AdminLayout() {
  const { person, session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background font-inter text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-surface/40 lg:flex lg:flex-col">
          <div className="border-b border-line px-4 py-4">
            <div className="text-sm font-semibold tracking-tight">Oberon Core</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {person?.full_name || session?.user?.email || 'панель'}
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-blue/10 text-blue' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground')}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-1 border-t border-line p-2">
            <a href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" /> На сайт
            </a>
            <button
              onClick={async () => { await signOut(); navigate('/admin/login'); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-red-400">
              <LogOut className="h-4 w-4" /> Выйти
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs',
                  isActive ? 'bg-blue/10 text-blue' : 'text-muted-foreground')}>
                {label}
              </NavLink>
            ))}
          </header>

          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
