import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


/**
 * Открыт ли сайт внутри рамки. Проверка обёрнута, потому что этот модуль
 * выполняется и на сборке, при серверном рендере, где window не существует:
 * без обёртки падала бы вся сборка страниц.
 */
export const isIframe =
  typeof window !== 'undefined' && window.self !== window.top;
