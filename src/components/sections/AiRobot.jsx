import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { InteractiveRobotSpline } from '@/components/ui/interactive-3d-robot';
import { useLang } from '@/lib/i18n/LangContext';
import { CONTACT_PATH } from '@/lib/routes';

const ROBOT_SCENE_URL = 'https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode';

export default function AiRobot() {
  const { t } = useLang();
  const at = t.home;
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Сцена весит несколько мегабайт, поэтому грузим её только когда
  // пользователь до неё домотал — главная открывается быстро.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[85vh] lg:min-h-screen overflow-hidden flex items-center"
    >
      {/* 3D-сцена */}
      <div className="absolute inset-0 lg:left-[38%]">
        {visible && (
          <InteractiveRobotSpline
            scene={ROBOT_SCENE_URL}
            className="w-full h-full"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
              </div>
            }
          />
        )}
      </div>

      {/* Затемнение, чтобы текст читался поверх сцены */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-background via-background/85 to-transparent lg:via-background/60" />
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none bg-gradient-to-t from-background to-transparent" />

      {/* Контент */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs tracking-[0.3em] text-white/25 uppercase">{at.aiLabel}</p>
          </div>

          <h2 className="text-[clamp(2.2rem,6vw,4.5rem)] font-black tracking-[-0.04em] leading-[1.02] text-white mb-6">
            {at.aiTitle}
            <br />
            <span className="text-gradient-blue">{at.aiTitle2}</span>
          </h2>

          <p className="text-base text-white/40 leading-relaxed mb-10 max-w-md">{at.aiSub}</p>

          <div className="flex flex-wrap gap-3 pointer-events-auto">
            <Link
              to={CONTACT_PATH}
              className="px-7 py-3.5 rounded-xl bg-primary text-white text-sm font-bold
                hover:bg-primary/80 transition-all duration-300
                shadow-[0_0_30px_hsl(220_100%_60%/0.3)] hover:shadow-[0_0_50px_hsl(220_100%_60%/0.5)]"
            >
              {at.aiCta}
            </Link>
            <Link
              to="/products"
              className="px-7 py-3.5 rounded-xl border border-white/10 text-white/60 text-sm font-semibold
                hover:text-white hover:border-white/20 transition-all duration-300"
            >
              {at.aiCtaSecondary}
            </Link>
          </div>

          <p className="text-[10px] text-white/20 mt-8">{at.aiHint}</p>
        </motion.div>
      </div>
    </section>
  );
}
