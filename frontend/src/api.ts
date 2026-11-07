export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Finance-Request', '1');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (response.ok) return response;

  let message = response.status === 429
    ? 'Çok fazla deneme yapıldı. Bir dakika sonra tekrar dene.'
    : response.status === 401
      ? 'Oturum açmanız gerekiyor.'
      : 'İşlem tamamlanamadı.';
  try {
    const body = await response.json();
    if (Array.isArray(body.errors)) message = body.errors.join(' ') || message;
  } catch {
    // Some API errors have no response body.
  }
  throw new ApiError(response.status, message);
}

export function stateRevision(response: Response) {
  return response.headers.get('X-Finance-Revision') ?? response.headers.get('ETag') ?? '';
}
