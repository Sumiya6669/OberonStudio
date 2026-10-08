import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { LOCALE_PREFIX } from '@/lib/i18n/locales';
import PageNotFound from './lib/PageNotFound';
import { LangProvider } from '@/lib/i18n/LangContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SiteContentProvider } from '@/lib/site/SiteContentContext';
import SiteLayout from '@/components/layout/SiteLayout';
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProductsPage from './pages/ProductsPage';
import ProcessPage from './pages/ProcessPage';
import StackPage from './pages/StackPage';
import ReviewsPage from './pages/ReviewsPage';
import FaqPage from './pages/FaqPage';
import ContactPage from './pages/ContactPage';
import AnswersPage from './pages/AnswersPage';
import OffersPage from './pages/OffersPage';
import OfferPage from './pages/OfferPage';
import CasesPage from './pages/CasesPage';
import CasePage from './pages/CasePage';
import AnswerPage from './pages/AnswerPage';
import PrivacyPage from './pages/PrivacyPage';
import ProverkaPage from './pages/ProverkaPage';
import SecurityPage from './pages/SecurityPage';

// Админка: своя раскладка, свой вход. Данные защищает RLS в базе,
// страж маршрута — только удобство.
import AdminLayout from '@/components/admin/AdminLayout';
import RequireAuth from '@/components/admin/RequireAuth';
// Экраны панели грузятся отдельными кусками, только когда их открыли.
// Раньше все 32 экрана (с графиками, PDF и прочим) ехали в одном файле с
// публичным сайтом, и посетитель главной на телефоне качал панель, которую
// никогда не увидит. Сайт от этого не меняется: панель заранее не собирается.
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const Tickets = lazy(() => import('./pages/admin/Tickets'));
const TicketDetail = lazy(() => import('./pages/admin/TicketDetail'));
const Companies = lazy(() => import('./pages/admin/Companies'));
const DevConfigs = lazy(() => import('./pages/admin/DevConfigs'));
const TimeSheet = lazy(() => import('./pages/admin/TimeSheet'));
const Queue = lazy(() => import('./pages/admin/Queue'));
const Sources = lazy(() => import('./pages/admin/Sources'));
const CrmSubscriptions = lazy(() => import('./pages/admin/CrmSubscriptions'));
const MoneyOverview = lazy(() => import('./pages/admin/MoneyOverview'));
const MoneyDocs = lazy(() => import('./pages/admin/MoneyDocs'));
const MoneyPayments = lazy(() => import('./pages/admin/MoneyPayments'));
const MoneyExpenses = lazy(() => import('./pages/admin/MoneyExpenses'));
const MoneyEntries = lazy(() => import('./pages/admin/MoneyEntries'));
const MoneyReports = lazy(() => import('./pages/admin/MoneyReports'));
const MoneyRate = lazy(() => import('./pages/admin/MoneyRate'));
const MoneyClose = lazy(() => import('./pages/admin/MoneyClose'));
const MoneyTax = lazy(() => import('./pages/admin/MoneyTax'));
const Funnel = lazy(() => import('./pages/admin/Funnel'));
const Prospects = lazy(() => import('./pages/admin/Prospects'));
const SiteReviews = lazy(() => import('./pages/admin/SiteReviews'));
const Marketing = lazy(() => import('./pages/admin/Marketing'));
const AiLive = lazy(() => import('./pages/admin/AiLive'));
const AiSpend = lazy(() => import('./pages/admin/AiSpend'));
const AiRights = lazy(() => import('./pages/admin/AiRights'));
const SysHealth = lazy(() => import('./pages/admin/SysHealth'));
const SysPeople = lazy(() => import('./pages/admin/SysPeople'));
const SysRegistry = lazy(() => import('./pages/admin/SysRegistry'));
const SitePages = lazy(() => import('./pages/admin/SitePages'));
const SiteContent = lazy(() => import('./pages/admin/SiteContent'));
const SiteSettings = lazy(() => import('./pages/admin/SiteSettings'));

/**
 * Страницы публичного сайта. Список отдельно от маршрутов, потому что
 * каждая страница существует на трёх адресах: `/faq`, `/kz/faq`, `/en/faq`.
 * Держать их тремя копиями вручную — это гарантированно забыть один
 * из трёх при следующем добавлении страницы.
 */
export const SITE_PAGES = [
  { path: '/', element: <Home /> },
  { path: '/services', element: <ServicesPage /> },
  { path: '/projects', element: <ProjectsPage /> },
  { path: '/products', element: <ProductsPage /> },
  // Бесплатная экспресс-проверка базы 1С: файл .epf после заявки.
  { path: '/proverka', element: <ProverkaPage /> },
  // Что продукты делают с базой 1С: только сверенное по коду продуктов.
  { path: '/bezopasnost', element: <SecurityPage /> },
  { path: '/process', element: <ProcessPage /> },
  { path: '/stack', element: <StackPage /> },
  { path: '/reviews', element: <ReviewsPage /> },
  { path: '/faq', element: <FaqPage /> },
  { path: '/contact', element: <ContactPage /> },
  // Политика ПД: текст один, на русском; на /kz и /en — строка о языке документа.
  { path: '/privacy', element: <PrivacyPage /> },
];

/** Один и тот же набор страниц под каждой языковой приставкой. */
const localisedRoutes = () => Object.entries(LOCALE_PREFIX).flatMap(
  ([lang, prefix]) => SITE_PAGES.map(({ path, element }) => (
    <Route
      key={`${lang}:${path}`}
      path={prefix + (path === '/' ? '' : path) || '/'}
      element={element}
    />
  )),
);

/** Пока кусок экрана панели грузится — пустой фон, без мигания вёрстки. */
const Lazy = ({ children }) => (
  <Suspense fallback={<div className="min-h-[50vh]" />}>{children}</Suspense>
);

const AppRoutes = () => (
  <Routes>
    {/* Публичный сайт: каждый раздел — отдельная страница, на трёх языках */}
    <Route element={<SiteLayout />}>
      {localisedRoutes()}

      {/* Разборы конкретных бед в 1С. Только по-русски и намеренно:
          запросы «не проводится документ 1С» приходят на русском, а
          казахская и английская версии, собранные ради симметрии, были бы
          страницами без читателей и с машинным переводом. */}
      <Route path="/1c" element={<AnswersPage />} />
      <Route path="/1c/:slug" element={<AnswerPage />} />

      {/* Что можно купить, с ценами. Тоже только по-русски: цена и условия
          обсуждаются на русском, а переведённый прайс без переведённого
          разговора — обещание, которое нечем поддержать. */}
      <Route path="/uslugi" element={<OffersPage />} />
      <Route path="/uslugi/:slug" element={<OfferPage />} />
      <Route path="/keysy" element={<CasesPage />} />
      <Route path="/keysy/:slug" element={<CasePage />} />
    </Route>

    {/* Рабочая панель */}
    <Route path="/admin/login" element={<Lazy><AdminLogin /></Lazy>} />
    <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
      <Route index element={<Lazy><Overview /></Lazy>} />
      {/* СРМ */}
      <Route path="tickets" element={<Lazy><Tickets /></Lazy>} />
      <Route path="tickets/:id" element={<Lazy><TicketDetail /></Lazy>} />
      <Route path="companies" element={<Lazy><Companies /></Lazy>} />
      <Route path="funnel" element={<Lazy><Funnel /></Lazy>} />
      <Route path="prospects" element={<Lazy><Prospects /></Lazy>} />
      <Route path="configs" element={<Lazy><DevConfigs /></Lazy>} />
      <Route path="time" element={<Lazy><TimeSheet /></Lazy>} />
      <Route path="sources" element={<Lazy><Sources /></Lazy>} />
      <Route path="subscriptions" element={<Lazy><CrmSubscriptions /></Lazy>} />
      <Route path="marketing" element={<Lazy><Marketing /></Lazy>} />

      {/* Бух учет */}
      <Route path="money" element={<Lazy><MoneyOverview /></Lazy>} />
      <Route path="money/docs" element={<Lazy><MoneyDocs /></Lazy>} />
      <Route path="money/payments" element={<Lazy><MoneyPayments /></Lazy>} />
      <Route path="money/expenses" element={<Lazy><MoneyExpenses /></Lazy>} />
      <Route path="money/entries" element={<Lazy><MoneyEntries /></Lazy>} />
      <Route path="money/reports" element={<Lazy><MoneyReports /></Lazy>} />
      <Route path="money/rate" element={<Lazy><MoneyRate /></Lazy>} />
      <Route path="money/close" element={<Lazy><MoneyClose /></Lazy>} />
      <Route path="money/tax" element={<Lazy><MoneyTax /></Lazy>} />

      {/* ИИ */}
      <Route path="ai" element={<Lazy><AiLive /></Lazy>} />
      <Route path="ai/queue" element={<Lazy><Queue /></Lazy>} />
      <Route path="ai/spend" element={<Lazy><AiSpend /></Lazy>} />
      <Route path="ai/rights" element={<Lazy><AiRights /></Lazy>} />

      {/* Администрирование */}
      <Route path="system" element={<Lazy><SysHealth /></Lazy>} />
      <Route path="system/people" element={<Lazy><SysPeople /></Lazy>} />
      <Route path="system/registry" element={<Lazy><SysRegistry /></Lazy>} />
      <Route path="site" element={<Lazy><SitePages /></Lazy>} />
      <Route path="site/content" element={<Lazy><SiteContent /></Lazy>} />
      <Route path="site/settings" element={<Lazy><SiteSettings /></Lazy>} />
      <Route path="site/reviews" element={<Lazy><SiteReviews /></Lazy>} />

      {/* Прежний адрес очереди: ссылки из переписки и закладки должны работать.
          Сломанная закладка выглядит как сломанная панель. */}
      <Route path="queue" element={<Navigate to="/admin/ai/queue" replace />} />
    </Route>

    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

/**
 * Всё приложение БЕЗ маршрутизатора.
 *
 * Отдельно от App, потому что маршрутизатор разный: в браузере это
 * BrowserRouter, а на сборке страниц — StaticRouter с заданным адресом.
 * Всё остальное — провайдеры, маршруты, уведомления — общее, и раздваивать
 * его нельзя: разошлись бы разметка сборки и первый кадр в браузере.
 */
export function AppShell({ initialContent = null }) {
  return (
    <LangProvider>
      {/* Содержимое сайта из базы. Провайдер внутри LangProvider, потому что
          запрос зависит от языка, и снаружи AuthProvider — публичному сайту
          вход не нужен, содержимое читается ключом anon через одну функцию. */}
      <SiteContentProvider initialContent={initialContent}>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </SiteContentProvider>
    </LangProvider>
  );
}

function App({ initialContent = null }) {
  return (
    <Router>
      <AppShell initialContent={initialContent} />
    </Router>
  );
}

export default App;
