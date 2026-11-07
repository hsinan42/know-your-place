import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Wallet } from 'lucide-react';
import { ApiError, request } from '../../api';
import { Button } from '../../components/ui/button';
import { offerPasswordToBrowser, rememberedUsername, rememberUsername } from './remembered-username';
import type { Account } from './session';

type Props = {
  initialError: string;
  notice?: { username: string; message: string };
  onSignedIn: (account: Account) => void;
};

export function LoginPage({ initialError, notice, onSignedIn }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState(() => notice?.username ?? rememberedUsername());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(notice?.message ?? '');
  const registering = mode === 'register';

  function changeMode() {
    setMode(registering ? 'login' : 'register');
    setError('');
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const enteredUsername = String(fields.get('username') ?? '').trim();
    const password = fields.get('password');
    setError('');
    setMessage('');
    if (registering && password !== fields.get('confirmation')) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setBusy(true);
    try {
      const response = await request(registering ? '/api/register' : '/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: enteredUsername, password }),
      });
      const account: Account = await response.json();
      if (registering) {
        setUsername(account.username);
        setMode('login');
        setMessage('Hesabın hazır. Giriş yaparak rehber turuna başlayabilirsin.');
      } else {
        rememberUsername(fields.has('remember') ? account.username : '');
        if (fields.has('remember') && typeof password === 'string')
          void offerPasswordToBrowser(account.username, password);
        onSignedIn(account);
      }
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 401
        ? 'Kullanıcı adı veya şifre hatalı.'
        : (failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="login">
    <div className="login-brand">
      <span className="brand-icon"><Wallet/></span>
      <h1>Know Your Place</h1>
      <p>Bütçen belli. Yerini bil.</p>
      <span className="eyebrow">KİŞİSEL FİNANS</span>
    </div>
    <form key={mode} onSubmit={submit} className="login-form">
      <span className="eyebrow">{registering ? 'KENDİ HESABINI OLUŞTUR' : 'TEKRAR HOŞ GELDİN'}</span>
      <h2>{registering ? 'Hesabını oluştur' : 'Kontrol sende.'}</h2>
      <p>{registering ? 'Kullanıcı adını ve şifreni belirle.' : 'Finans paneline erişmek için hesabınla giriş yap.'}</p>
      <label htmlFor={mode + '-username'}>Kullanıcı adı
        <input id={mode + '-username'} name="username" autoComplete="username" autoCapitalize="none"
          spellCheck={false} defaultValue={registering ? '' : username} maxLength={32} minLength={registering ? 3 : undefined} required/>
      </label>
      <label htmlFor={mode + '-password'}>Şifre
        <input id={mode + '-password'} name="password" type="password"
          autoComplete={registering ? 'new-password' : 'current-password'} maxLength={256}
          minLength={registering ? 12 : undefined} required/>
      </label>
      {registering ? <>
        <label>Şifreyi doğrula<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
        <small>Şifren en az 12 karakter olmalı.</small>
      </> : <div>
        <label className="checkbox-field"><input name="remember" type="checkbox" defaultChecked={Boolean(rememberedUsername())}
          aria-describedby="remember-hint"/> Beni hatırla</label>
      </div>}
      {message && <p role="status" className="info-note">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <Button disabled={busy} type="submit">
        {busy ? 'Bekle…' : registering ? 'Hesap oluştur' : 'Panele giriş yap'}<ArrowUpRight size={16}/>
      </Button>
      <Button type="button" disabled={busy} variant="outline" onClick={changeMode}>{registering ? 'Girişe dön' : 'Üye ol'}</Button>
    </form>
  </main>;
}
