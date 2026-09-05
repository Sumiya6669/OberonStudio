import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { LangProvider } from '@/lib/i18n/LangContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
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

const AppRoutes = () => (
  <Routes>
    {/* Публичный сайт: каждый раздел — отдельная страница */}
    <Route element={<SiteLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/process" element={<ProcessPage />} />
      <Route path="/stack" element={<StackPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </Route>

    {/* Рабочая панель */}
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
      <Route index element={<Overview />} />
      <Route path="tickets" element={<Tickets />} />
      <Route path="tickets/:id" element={<TicketDetail />} />
      <Route path="companies" element={<Companies />} />
      <Route path="configs" element={<DevConfigs />} />
      <Route path="time" element={<TimeSheet />} />
      <Route path="queue" element={<Queue />} />
    </Route>

    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </LangProvider>
  );
}

export default App;
