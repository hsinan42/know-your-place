import { useEffect, useState } from 'react';
import { useSession } from '../auth/session';

type Page<T> = { items: T[]; total: number; page: number };
type Result<T> = { data?: Page<T>; error?: string };

export function useLedgerPage<T>(
  collection: string, year: number, month: number, revision: unknown, values: Record<string, string | undefined>,
): Result<T> {
  const { request } = useSession();
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) parameters.set(key, value);
  const path = '/api/lists/' + collection + '/' + year + '/' + month + '?' + parameters;
  const [result, setResult] = useState<{ path: string; revision: unknown; data?: Page<T>; error?: string }>();

  useEffect(() => {
    const abort = new AbortController();
    const delay = new URLSearchParams(path.split('?')[1]).has('search') ? 160 : 0;
    const timer = window.setTimeout(async () => {
      try {
        const response = await request(path, { signal: abort.signal });
        const data: Page<T> = await response.json();
        if (!abort.signal.aborted) setResult({ path, revision, data });
      } catch (failure) {
        if (!abort.signal.aborted) setResult({ path, revision, error: (failure as Error).message });
      }
    }, delay);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [path, request, revision]);

  return result?.path === path && result.revision === revision ? result : {};
}
