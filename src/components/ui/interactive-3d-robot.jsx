import { Suspense, lazy, Component } from 'react';
import { cn } from '@/lib/utils';

const Spline = lazy(() => import('@splinetool/react-spline'));

function SceneLoader({ className }) {
  return (
    <div className={cn('w-full h-full flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-primary animate-spin" />
        <p className="text-[10px] tracking-[0.25em] text-white/20 uppercase">Загрузка сцены</p>
      </div>
    </div>
  );
}

/**
 * Сцена грузится с внешнего CDN Spline и может не открыться — например,
 * при плохой сети или блокировке. Тогда вместо пустоты показываем запасной блок,
 * чтобы страница не разваливалась.
 */
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/**
 * Интерактивная 3D-сцена Spline.
 *
 * @param {string} scene — ссылка на .splinecode
 * @param {string} className — классы контейнера
 * @param {React.ReactNode} fallback — что показать, если сцена не загрузилась
 */
export function InteractiveRobotSpline({ scene, className, fallback }) {
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={<SceneLoader className={className} />}>
        <Spline scene={scene} className={className} />
      </Suspense>
    </SceneBoundary>
  );
}

export default InteractiveRobotSpline;
