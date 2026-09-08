/**
 * Раскладка админки. Отдельная от публичной: у сайта своя навигация и
 * фоновые эффекты, здесь нужна плотность и скорость.
 *
 * Четыре раздела вместо плоского списка: СРМ, Бух учет, ИИ, Администрирование.
 * Раздел, внутри которого вы находитесь, раскрыт, остальные свёрнуты —
 * двадцать одинаковых ссылок в столбик перестают читаться на пятой.
 */
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bot, Building2, Clock, Database, ExternalLink, FileText, Globe, Inbox,
  LayoutDashboard, ListTodo, LogOut, Receipt, Settings, ShieldCheck, Users,
  Wallet, Activity, Coins, BookOpen, PieChart, HeartPulse, Boxes,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { cx } from './ui';

export const NAV_GROUPS = [
  {
    code: 'crm', label: 'СРМ', icon: Inbox,
    items: [
      { to: '/admin', end: true, label: 'Обзор', icon: LayoutDashboard },
      { to: '/admin/tickets', label: 'Заявки', icon: Inbox },
      { to: '/admin/companies', label: 'Компании', icon: Building2 },
      { to: '/admin/time', label: 'Время', icon: Clock },
      { to: '/admin/configs', label: 'Конфигурации 1С', icon: Database },
    ],
  },
  {
    code: 'money', label: 'Бух учет', icon: Wallet,
    items: [
      { to: '/admin/money', end: true, label: 'Деньги', icon: Wallet },
      { to: '/admin/money/docs', label: 'Счета и акты', icon: FileText },
      { to: '/admin/money/payments', label: 'Оплаты', icon: Receipt },
      { to: '/admin/money/expenses', label: 'Расходы', icon: Coins },
      { to: '/admin/money/entries', label: 'Документы учёта', icon: BookOpen },
      { to: '/admin/money/reports', label: 'Отчёты', icon: PieChart },
    ],
  },
  {
    code: 'ai', label: 'ИИ', icon: Bot,
    items: [
      { to: '/admin/ai', end: true, label: 'Живой экран', icon: Activity },
      { to: '/admin/ai/queue', label: 'Очередь и журнал', icon: ListTodo },
      { to: '/admin/ai/spend', label: 'Расход и квоты', icon: Coins },
      { to: '/admin/ai/rights', label: 'Права и автономия', icon: ShieldCheck },
    ],
  },
  {
    code: 'admin', label: 'Администрирование', icon: Settings,
    items: [
      { to: '/admin/system', end: true, label: 'Состояние системы', icon: HeartPulse },
      { to: '/admin/system/people', label: 'Люди и доступ', icon: Users },
      { to: '/admin/system/registry', label: 'Реестры агентов', icon: Boxes },
      { to: '/admin/site', end: true, label: 'Сайт: страницы', icon: Globe },
      { to: '/admin/site/content', label: 'Сайт: справочники', icon: Boxes },
      { to: '/admin/site/settings', label: 'Сайт: настройки', icon: Settings },
    ],
  },
];

/** Какой раздел открыт: по самому длинному совпадению пути, а не по первому. */
function activeGroup(pathname) {
  let best = NAV_GROUPS[0].code;
  let bestLen = -1;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        if (item.to.length > bestLen) { bestLen = item.to.length; best = group.code; }
      }
    }
  }
  return best;
}

const linkClass = ({ isActive }) => cx(
  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
  isActive ? 'bg-blue/10 text-blue' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
);

export default function AdminLayout() {
  const { person, session, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = activeGroup(pathname);
  const [open, setOpen] = React.useState(current);

  // Переход в другой раздел раскрывает его: иначе после перехода по ссылке
  // из другого экрана меню показывает не то место, где вы находитесь.
  React.useEffect(() => { setOpen(current); }, [current]);

  return (
    <div className="min-h-screen bg-background font-inter text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-line bg-surface/40 lg:flex lg:flex-col">
          <div className="border-b border-line px-4 py-4">
            <div className="text-sm font-semibold tracking-tight">Oberon Core</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {person?.full_name || session?.user?.email || 'панель'}
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {NAV_GROUPS.map((group) => {
              const Icon = group.icon;
              const expanded = open === group.code;
              return (
                <div key={group.code}>
                  <button
                    onClick={() => setOpen(expanded ? null : group.code)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                      current === group.code ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}>
                    <Icon className="h-4 w-4" />
                    {group.label}
                    <span className={cx('ml-auto text-xs transition-transform',
                      expanded && 'rotate-90')}>›</span>
                  </button>
                  {expanded && (
                    <div className="mb-1 ml-3 space-y-0.5 border-l border-line pl-2">
                      {group.items.map(({ to, label, end, icon: ItemIcon }) => (
                        <NavLink key={to} to={to} end={end} className={linkClass}>
                          <ItemIcon className="h-3.5 w-3.5" />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
          {/* На узком экране: сначала разделы, потом экраны выбранного раздела. */}
          <header className="border-b border-line lg:hidden">
            <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
              {NAV_GROUPS.map((group) => (
                <button key={group.code}
                  onClick={() => navigate(group.items[0].to)}
                  className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium',
                    current === group.code ? 'bg-blue/15 text-blue' : 'text-muted-foreground')}>
                  {group.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto border-t border-line/60 px-3 py-2">
              {(NAV_GROUPS.find((g) => g.code === current) || NAV_GROUPS[0]).items.map(
                ({ to, label, end }) => (
                  <NavLink key={to} to={to} end={end}
                    className={({ isActive }) => cx('whitespace-nowrap rounded-lg px-2.5 py-1 text-xs',
                      isActive ? 'bg-white/10 text-foreground' : 'text-muted-foreground')}>
                    {label}
                  </NavLink>
                ),
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
