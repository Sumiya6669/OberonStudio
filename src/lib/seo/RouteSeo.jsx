/**
 * Мета-теги для текущего маршрута. Один компонент на весь публичный сайт.
 *
 * Стоит в раскладке, а не в каждой странице: девять одинаковых вызовов —
 * это девять мест, где однажды забудут поправить. Здесь же собирается
 * разметка JSON-LD, потому что она зависит от того же самого — от адреса
 * страницы и от опубликованного содержимого.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_SETTINGS } from '@/lib/content/site';
import {
  useFaq, usePageText, useProducts, useProjects, useServices, useSettings,
} from '@/lib/site/SiteContentContext';
import { Seo } from './Seo';
import { resolvePageSeo } from './pages';
import {
  breadcrumbLd, faqLd, organizationLd, productsLd, reviewsLd, servicesLd,
  websiteLd,
} from './jsonld';
import { useTestimonials } from '@/lib/site/SiteContentContext';
import { buildFallbackTestimonials } from '@/lib/content/portfolio';

export default function RouteSeo() {
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  const settings = useSettings(SITE_SETTINGS);
  const cmsText = usePageText(pathname);

  const services = useServices();
  const projects = useProjects();
  const products = useProducts();
  const faq = useFaq();
  const reviewsDb = useTestimonials();

  const seo = React.useMemo(
    () => resolvePageSeo({ path: pathname, t, lang, cmsText }),
    [pathname, t, lang, cmsText],
  );

  const jsonLd = React.useMemo(() => {
    const blocks = [organizationLd(settings), websiteLd()];
    const crumb = breadcrumbLd(pathname, seo.pageName || seo.title);
    if (crumb) blocks.push(crumb);

    // Списочная разметка — только там, где такой список действительно
    // на странице. Разметка того, чего на странице нет, — это ошибка.
    if (pathname === '/services') {
      const list = services || (t?.services?.items || []).map((item) => ({
        title: item.title, desc: item.desc,
      }));
      const block = servicesLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/faq') {
      const list = faq || t?.faq?.items || [];
      const block = faqLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/products') {
      const block = productsLd(products);
      if (block) blocks.push(block);
    }
    if (pathname === '/reviews') {
      const list = reviewsDb || buildFallbackTestimonials(t, lang);
      const block = reviewsLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/projects') {
      // Проекты размечаются на своей странице; список берётся тот же,
      // что показан, — из базы либо из кода.
      const block = projects && projects.length
        ? { '@context': 'https://schema.org', '@type': 'ItemList',
            name: 'Реализованные проекты',
            itemListElement: projects.slice(0, 30).map((p, i) => ({
              '@type': 'ListItem', position: i + 1,
              item: { '@type': 'CreativeWork', name: p.title, description: p.description },
            })) }
        : null;
      if (block) blocks.push(block);
    }
    return blocks.filter(Boolean);
  }, [pathname, settings, seo.pageName, seo.title, services, faq, products, projects, reviewsDb, t, lang]);

  // pageName нужен только крошкам, в мета-теги он не идёт.
  const { pageName, ...meta } = seo;
  return <Seo {...meta} jsonLd={jsonLd} />;
}
