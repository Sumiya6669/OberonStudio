/**
 * Отправка заявки. Форма обращается к своей serverless-функции `/api/lead`,
 * которая пересылает данные в Telegram. Токен бота живёт только на сервере
 * и в браузер не попадает.
 */
export async function submitLead(values) {
  const response = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: values.name?.trim() || '',
      phone: values.phone?.trim() || '',
      email: values.email?.trim() || '',
      company: values.company?.trim() || '',
      message: values.message?.trim() || '',
      service: values.service || '',
      source: values.source || 'website',
      page: typeof window !== 'undefined' ? window.location.pathname : '',
    }),
  });

  if (!response.ok) {
    let reason = 'Не удалось отправить заявку. Попробуйте написать в Telegram.';
    try {
      const data = await response.json();
      if (data?.error) reason = data.error;
    } catch {
      // тело ответа может быть пустым — оставляем текст по умолчанию
    }
    throw new Error(reason);
  }

  return response.json().catch(() => ({ ok: true }));
}
