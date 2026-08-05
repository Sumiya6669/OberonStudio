import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { LangProvider } from '@/lib/i18n/LangContext';
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

    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <LangProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
      <Toaster />
    </LangProvider>
  );
}

export default App;
