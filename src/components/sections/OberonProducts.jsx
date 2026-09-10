import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { Search, BarChart2 } from 'lucide-react';
import Reveal from '../core/Reveal';
import OberonCore from './products/OberonCore';
import ProductCard from './products/ProductCard';
import ProductCompare from './products/ProductCompare';
import DemoModal from './products/DemoModal';
import { PRODUCTS } from '@/lib/content/site';
import { useProducts } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

export default function OberonProducts() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Все');
  const [showCompare, setShowCompare] = useState(false);
  const [demoProduct, setDemoProduct] = useState(undefined);
  const fromDb = useProducts();
  const products = fromDb ?? PRODUCTS;
  const categories = useMemo(() => ['Все', ...Array.from(new Set(products.flatMap(p => p.categories)))], [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tagline.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === 'Все' || p.categories.includes(activeCategory);
      return matchSearch && matchCat;
    });
  }, [products, search, activeCategory]);

  const handleOrder = (product) => {
    setDemoProduct(product);
  };

  return (
    <section id="products" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, hsl(220 100% 60% / 0.04) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        {/* Section header */}
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-5">Oberon Solutions Marketplace</p>
            <h2 className="text-[clamp(2.2rem,5vw,4.5rem)] font-black tracking-[-0.04em] leading-[1.05] text-white mb-4">
              Готовые AI и CRM решения<br />
              <span className="text-gradient-blue">для быстрого внедрения в бизнес</span>
            </h2>
            <p className="text-base text-white/35 max-w-xl mx-auto leading-relaxed">
              Одна платформа, много отраслевых решений. Выбирайте модуль, адаптируйте под процесс и запускайте быстрее классической разработки.
            </p>
            {/* Quick stats */}
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              {[['20+', 'готовых продуктов'], ['120+', 'реализованных проектов'], ['15+', 'отраслей'], ['99.9%', 'uptime SLA']].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="text-xl font-black text-white">{v}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Oberon Core platform */}
        <OberonCore />

        {/* Filters & Search */}
        <Reveal>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск продуктов..."
                className="w-full bg-surface border border-line rounded-2xl pl-10 pr-4 py-3 text-sm text-white/70 placeholder-white/20 outline-none focus:border-primary/30 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-line bg-surface text-sm text-white/40 hover:text-white/70 hover:border-white/15 transition-all"
            >
              <BarChart2 className="w-4 h-4" /> Сравнить подходы
            </button>
          </div>
          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-8">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${activeCategory === cat ? 'bg-primary/10 text-primary border-primary/25' : 'text-white/30 border-line hover:text-white/60 bg-surface'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Products grid */}
        <div className="mb-16">
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-white/20 text-sm">
              Продукты не найдены. Попробуйте изменить фильтр.
            </motion.div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-white/20">
                  {filtered.length === products.length ? `${products.length} продуктов` : `${filtered.length} из ${products.length}`}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} onDemo={setDemoProduct} onOrder={handleOrder} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom CTA */}
        <Reveal>
          <div className="relative rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden text-center px-8 py-14">
            <div className="absolute inset-0 grid-bg opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative">
              <p className="text-[10px] tracking-[0.25em] text-primary/60 uppercase mb-4">Готовы начать?</p>
              <h3 className="text-[clamp(1.8rem,4vw,3rem)] font-black text-white mb-4 tracking-tight">
                Подберём решение<br />под вашу задачу.
              </h3>
              <p className="text-sm text-white/35 max-w-lg mx-auto mb-8 leading-relaxed">
                Запишитесь на бесплатную консультацию. Разберём бизнес-процессы и предложим подходящий модуль.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to={CONTACT_PATH}
                  className="px-7 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/80 transition-all shadow-[0_0_30px_hsl(220_100%_60%/0.3)]">
                  Получить консультацию
                </Link>
                <button onClick={() => setDemoProduct({ name: 'Oberon Products', icon: '🚀' })}
                  className="px-7 py-3.5 rounded-2xl border border-white/10 text-white/60 font-semibold text-sm hover:text-white hover:border-white/20 transition-all">
                  Запросить демо
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCompare && <ProductCompare onClose={() => setShowCompare(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {demoProduct !== undefined && (
          <DemoModal product={demoProduct} onClose={() => setDemoProduct(undefined)} />
        )}
      </AnimatePresence>
    </section>
  );
}
