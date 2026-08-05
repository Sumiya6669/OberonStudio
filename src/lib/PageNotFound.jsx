import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background font-inter">
      <div className="max-w-md w-full text-center">
        <p className="text-[clamp(4rem,15vw,8rem)] font-black tracking-[-0.05em] text-gradient-blue leading-none">404</p>
        <div className="h-px w-16 bg-line mx-auto my-8" />

        <h1 className="text-2xl font-black text-white mb-3">Страница не найдена</h1>
        <p className="text-sm text-white/35 leading-relaxed mb-10">
          {pageName
            ? <>Раздела «{pageName}» на сайте нет. Возможно, ссылка устарела.</>
            : 'Возможно, ссылка устарела или была введена с ошибкой.'}
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80 transition-colors"
          >
            На главную
          </Link>
          <Link
            to="/contact"
            className="px-6 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold hover:text-white hover:border-white/20 transition-all"
          >
            Написать нам
          </Link>
        </div>
      </div>
    </div>
  );
}
