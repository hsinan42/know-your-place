import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, request } from '../../api';
import { LoginPage } from './LoginPage';
import { rememberedUsername, rememberUsername } from './remembered-username';
import { SessionContext, type Account } from './session';

const sessionEvent = 'finance:session-changed';

export function AuthGate({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialError, setInitialError] = useState('');
  const [notice, setNotice] = useState<{ username: string; message: string }>();
  const requestGeneration = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') channel.current = new BroadcastChannel(sessionEvent);

    async function refresh() {
      const generation = ++requestGeneration.current;
      setLoading(true);
      setAccount(null);
      setInitialError('');
      try {
        const response = await request('/api/session');
        const current: Account = await response.json();
        if (generation === requestGeneration.current) setAccount(current);
      } catch (error) {
        if (generation === requestGeneration.current && !(error instanceof ApiError && error.status === 401))
          setInitialError('Sunucuya ulaşılamadı. Biraz sonra tekrar dene.');
      } finally {
        if (generation === requestGeneration.current) setLoading(false);
      }
    }

    void refresh();
    channel.current?.addEventListener('message', refresh);
    return () => {
      requestGeneration.current++;
      channel.current?.close();
      channel.current = null;
    };
  }, []);

  const session = useMemo(() => {
    if (!account) return null;
    const accountId = account.id;

    async function accountRequest(path: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      headers.set('X-Finance-Account', accountId);
      try {
        return await request(path, { ...init, headers });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          setAccount(current => current === account ? null : current);
        throw error;
      }
    }

    function endSession() {
      requestGeneration.current++;
      setLoading(false);
      setAccount(null);
      channel.current?.postMessage('changed');
    }

    async function signOut() {
      await accountRequest('/api/logout', { method: 'POST' });
      endSession();
    }

    function profileChanged(username: string) {
      if (rememberedUsername().toUpperCase() === account!.username.toUpperCase()) rememberUsername(username);
      setNotice({ username, message: 'Hesap bilgilerin güncellendi. Yeni bilgilerinle giriş yap.' });
      endSession();
    }

    return { account, request: accountRequest, signOut, profileChanged };
  }, [account]);

  if (loading) return <div className="loading" role="status">Know Your Place açılıyor…</div>;
  if (!session) return <LoginPage initialError={initialError} notice={notice} onSignedIn={current => {
    requestGeneration.current++;
    setLoading(false);
    setInitialError('');
    setNotice(undefined);
    setAccount(current);
    channel.current?.postMessage('changed');
  }}/>;

  return <SessionContext.Provider value={session} key={session.account.id}>{children}</SessionContext.Provider>;
}
