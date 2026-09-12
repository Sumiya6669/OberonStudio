import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { LOCALE_PREFIX } from '@/lib/i18n/locales';
import PageNotFound from './lib/PageNotFound';
import { LangProvider } from '@/lib/i18n/LangContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SiteContentProvider } from '@/lib/site/SiteContentContext';
import ScrollToTop from '@/components/ScrollToTop';
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

// Админка: своя раскладка, свой вход. Данные защищает RLS в базе,
// страж маршрута — только удобство.
import AdminLayout from '@/components/admin/AdminLayout';
import RequireAuth from '@/components/admin/RequireAuth';
import AdminLogin from './pages/admin/AdminLogin';
import Overview from './pages/admin/Overview';
import Tickets from './pages/admin/Tickets';
import TicketDetail from './pages/admin/TicketDetail';
import Companies from './pages/admin/Companies';
import DevConfigs from './pages/admin/DevConfigs';
import TimeSheet from './pages/admin/TimeSheet';
import Queue from './pages/admin/Queue';
import Sources from './pages/admin/Sources';
import CrmSubscriptions from './pages/admin/CrmSubscriptions';
import MoneyOverview from './pages/admin/MoneyOverview';
import MoneyDocs from './pages/admin/MoneyDocs';
import MoneyPayments from './pages/admin/MoneyPayments';
import MoneyExpenses from './pages/admin/MoneyExpenses';
import MoneyEntries from './pages/admin/MoneyEntries';
import MoneyReports from './pages/admin/MoneyReports';
import MoneyRate from './pages/admin/MoneyRate';
import MoneyClose from './pages/admin/MoneyClose';
import AiLive from './pages/admin/AiLive';
import AiSpend from './pages/admin/AiSpend';
import AiRights from './pages/admin/AiRights';
import SysHealth from './pages/admin/SysHealth';
import SysPeople from './pages/admin/SysPeople';
import SysRegistry from './pages/admin/SysRegistry';
import SitePages from './pages/admin/SitePages';
import SiteContent from './pages/admin/SiteContent';
import SiteSettings from './pages/admin/SiteSettings';

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
  { path: '/process', element: <ProcessPage /> },
  { path: '/stack', element: <StackPage /> },
  { path: '/reviews', element: <ReviewsPage /> },
  { path: '/faq', element: <FaqPage /> },
  { path: '/contact', element: <ContactPage /> },
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
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
      <Route index element={<Overview />} />
      {/* СРМ */}
      <Route path="tickets" element={<Tickets />} />
      <Route path="tickets/:id" element={<TicketDetail />} />
      <Route path="companies" element={<Companies />} />
      <Route path="configs" element={<DevConfigs />} />
      <Route path="time" element={<TimeSheet />} />
      <Route path="sources" element={<Sources />} />
      <Route path="subscriptions" element={<CrmSubscriptions />} />

      {/* Бух учет */}
      <Route path="money" element={<MoneyOverview />} />
      <Route path="money/docs" element={<MoneyDocs />} />
      <Route path="money/payments" element={<MoneyPayments />} />
      <Route path="money/expenses" element={<MoneyExpenses />} />
      <Route path="money/entries" element={<MoneyEntries />} />
      <Route path="money/reports" element={<MoneyReports />} />
      <Route path="money/rate" element={<MoneyRate />} />
      <Route path="money/close" element={<MoneyClose />} />

      {/* ИИ */}
      <Route path="ai" element={<AiLive />} />
      <Route path="ai/queue" element={<Queue />} />
      <Route path="ai/spend" element={<AiSpend />} />
      <Route path="ai/rights" element={<AiRights />} />

      {/* Администрирование */}
      <Route path="system" element={<SysHealth />} />
      <Route path="system/people" element={<SysPeople />} />
      <Route path="system/registry" element={<SysRegistry />} />
      <Route path="site" element={<SitePages />} />
      <Route path="site/content" element={<SiteContent />} />
      <Route path="site/settings" element={<SiteSettings />} />

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
          <ScrollToTop />
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
