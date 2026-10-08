/**
 * Автор статьи: фото, если оно есть, иначе инициалы в круге.
 * Картинку-заглушку «силуэт человека» не рисуем: она выглядит как
 * выдуманный автор, а инициалы — честно «фото нет».
 */
import React from 'react';
import { initials } from '@/lib/content/authors';

export function AuthorAvatar({ author, size = 40 }) {
  const style = { width: size, height: size };
  if (author?.photo) {
    return (
      <img src={author.photo} alt={author.name} width={size} height={size} loading="lazy"
           style={style} className="shrink-0 rounded-full border border-line object-cover" />
    );
  }
  return (
    <span aria-hidden="true" style={{ ...style, fontSize: Math.round(size * 0.36) }}
          className="flex shrink-0 select-none items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-bold tracking-wide text-primary">
      {initials(author?.name) || 'T'}
    </span>
  );
}

export default function AuthorBadge({ author, size = 40, children }) {
  return (
    <div className="flex items-center gap-3">
      <AuthorAvatar author={author} size={size} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white/80">{author?.name || 'Tinker'}</p>
        {(author?.role || children) && (
          <p className="text-xs leading-snug text-white/35">{children || author.role}</p>
        )}
      </div>
    </div>
  );
}
