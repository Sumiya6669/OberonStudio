import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { Search, BarChart2 } from 'lucide-react';
import Reveal from '../core/Reveal';
import TinkerCore from './products/TinkerCore';
import ProductCard from './products/ProductCard';
import ProductCompare from './products/ProductCompare';
import DemoModal from './products/DemoModal';
import { PRODUCTS } from '@/lib/content/site';
import { useProducts } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

/**
 * Две группы, а не одна сетка.
 *
 * Расширения 1С и разработка под заказ продаются по-разному и устроены
 * по-разному: у первых есть файл .cfe, установка в базу и всё, что
 * перечислено в блоке «Одинаково у всех»; у вторых ничего этого нет.
 * Смешать их в одну сетку значило бы пообещать, что лендинг тоже не
 * снимает конфигурацию с поддержки.
 */
const GRUPPY = [
  {
    key: '1c',
    title: 'Расширения 1С',
    note: 'Ставятся в вашу базу, типовую конфигурацию не меняют. Всё, что написано выше, относится к ним.',
  },
  {
    key: 'bots',
    title: 'Боты и сервисы',
    note: 'Готовые, 1С для них не нужна. Подключаются за день-два, дальше платите помесячно и в любой момент можете перестать.',
  },
  {
    key: 'custom',
    title: 'Разработка под заказ',
    note: 'Сайты, приложения и CRM. Делаются под вашу задачу с нуля, поэтому цена — нижняя граница: точную называю после разбора, до начала работ.',
  },
];

export default function TinkerProducts() {
  // Раздел приходит из меню ссылкой /products?cat=Сайты. Держать его в
  // адресе, а не только в состоянии, нужно чтобы ссылку можно было
  // отправить в переписке и чтобы «назад» возвращал к прежнему фильтру.
  const [params, setParams] = useSearchParams();
  const izAdresa = params.get('cat');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(izAdresa || 'Все');
  const setka = useRef(null);
  const pervyyRaz = useRef(true);

  useEffect(() => {
    setActiveCategory(izAdresa || 'Все');
    const bylPervym = pervyyRaz.current;
    pervyyRaz.current = false;

    // Без раздела в адресе страница открывается с начала — как обычно.
    if (!izAdresa) return undefined;

    // С разделом из меню прокручиваем к сетке: иначе человек нажал
    // «Сайты» и оказался в шапке каталога, а карточки где-то через два
    // экрана вниз. При первом заходе ждём, пока закончится переход между
    // страницами: он сам ставит скролл в ноль на 350-й миллисекунде, и
    // без паузы две прокрутки спорили бы друг с другом.
    const zaderzhka = bylPervym ? 620 : 0;
    const t = setTimeout(() => {
      if (setka.current) setka.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, zaderzhka);
    return () => clearTimeout(t);
  }, [izAdresa]);

  const vybrat = (cat) => {
    setActiveCategory(cat);
    if (cat === 'Все') setParams({}, { replace: true });
    else setParams({ cat }, { replace: true });
  };
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
        style={{ background: 'radial-gradient(ellipse, hsl(252 100% 68% / 0.04) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        {/* Section header */}
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-5">Tinker Solutions</p>
            <h2 className="text-[clamp(2.2rem,5vw,4.5rem)] font-black tracking-[-0.04em] leading-[1.05] text-white mb-4">
              Софт, который делает<br />
              <span className="text-gradient-violet">рутину за вас</span>
            </h2>
            <p className="text-base text-white/35 max-w-xl mx-auto leading-relaxed">
              Двенадцать расширений 1С, боты и сервисы без всякой 1С и разработка под заказ:
              сайты, приложения, CRM. Расширения ставятся без снятия типовой конфигурации
              с поддержки — обновления 1С ничего не сносят.
            </p>
            {/* Quick stats */}
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              {[['24', 'продукта'], ['12', 'расширений 1С'], ['8', 'конфигураций 1С'], ['0', 'снятий с поддержки']].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="text-xl font-black text-white">{v}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Tinker Core platform */}
        <TinkerCore />

        {/* Filters & Search */}
        <Reveal>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск продуктов..."
                className="w-full bg-surface border border-line rounded-2xl pl-10 pr-4 py-3 text-sm text-white/70 placeholder-white/20 outline-none focus:border-primary/30 transition-colors ym-disable-keys"
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
                onClick={() => vybrat(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${activeCategory === cat ? 'bg-primary/10 text-primary border-primary/25' : 'text-white/30 border-line hover:text-white/60 bg-surface'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Products grid */}
        <div className="mb-16 scroll-mt-24" ref={setka}>
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

              {GRUPPY.map(({ key, title, note }) => {
                const gruppa = filtered.filter(p => (p.group || '1c') === key);
                if (gruppa.length === 0) return null;
                return (
                  <div key={key} className="mb-14 last:mb-0">
                    <div className="mb-5">
                      <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
                      <p className="text-xs text-white/30 mt-1.5 max-w-2xl leading-relaxed">{note}</p>
                    </div>
                    {/* key по фильтру: при смене раздела карточки проявляются
                        заново, а не подменяются в кадре. */}
                    <motion.div
                      key={activeCategory + search}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch"
                    >
                      {gruppa.map((p, i) => (
                        <ProductCard key={p.id} product={p} index={i} onDemo={setDemoProduct} onOrder={handleOrder} />
                      ))}
                    </motion.div>
                  </div>
                );
              })}
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
                <button onClick={() => setDemoProduct({ name: 'Tinker Products', icon: '🚀' })}
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
