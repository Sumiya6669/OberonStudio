import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** При переходе между страницами возвращает скролл в начало. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
