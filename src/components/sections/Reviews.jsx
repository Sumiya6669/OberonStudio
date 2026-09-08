import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';
import { buildFallbackTestimonials } from '@/lib/content/portfolio';
import { useTestimonials } from '@/lib/site/SiteContentContext';

function ReviewCard({ item }) {
  return (
    <div className="glass rounded-2xl p-6 border border-line hover:border-white/10 transition-colors duration-300 flex flex-col min-w-[280px] max-w-[340px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/25">
          {item.rating || 5}/5
        </span>
      </div>
      <p className="text-sm text-white/55 leading-relaxed flex-1 mb-5">"{item.text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-primary">{item.name?.slice(0, 2) || 'OS'}</span>}
        </div>
        <div>
          <p className="text-xs font-semibold text-white/70">{item.name}</p>
          <p className="text-[10px] text-white/25 leading-tight">{item.company}</p>
        </div>
      </div>
    </div>
  );
}

export default function Reviews() {
  const { t, lang } = useLang();
  const rt = t.reviews;
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef(null);
  const offsetRef = useRef(0);
  const rafRef = useRef(null);
  const SPEED = 0.5;
  const fromDb = useTestimonials();
  const fallbackReviews = useMemo(() => buildFallbackTestimonials(t, lang), [t, lang]);
  const reviews = fromDb ?? fallbackReviews;

  const animate = useCallback(() => {
    if (!trackRef.current || isPaused) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }
    offsetRef.current += SPEED;
    const totalW = trackRef.current.scrollWidth / 2;
    if (offsetRef.current >= totalW) offsetRef.current = 0;
    trackRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
    rafRef.current = requestAnimationFrame(animate);
  }, [isPaused]);

  useEffect(() => {
    if (reviews.length === 0) return undefined;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, reviews.length]);

  const doubled = [...reviews, ...reviews];

  return (
    <section id="reviews" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-background to-surface" />
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-5 mb-12">
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{rt.label}</p>
                <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white">{rt.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/30">{rt.countLabel(reviews.length)}</span>
              </div>
            </div>
          </Reveal>
        </div>

        {reviews.length === 0 ? (
          <div className="max-w-7xl mx-auto px-5 text-sm text-white/20">{rt.emptyText}</div>
        ) : (
          <div
            className="overflow-hidden relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div ref={trackRef} className="flex gap-4 py-2 px-5 will-change-transform" style={{ width: 'max-content' }}>
              {doubled.map((item, i) => (
                <ReviewCard key={`${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="max-w-7xl mx-auto px-5 mt-6">
            <p className="text-[10px] text-white/15 text-center">{rt.pauseHint}</p>
          </div>
        )}
      </div>
    </section>
  );
}
