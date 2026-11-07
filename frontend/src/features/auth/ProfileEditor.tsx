import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useSession } from './session';

export function ProfileEditor() {
  const { account, request, profileChanged } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== form.get('confirmation')) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (!newPassword && username === account.username) {
      setError('Kullanıcı adını değiştir veya yeni bir şifre gir.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      await request('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ username, currentPassword: form.get('currentPassword'), newPassword }),
      });
      profileChanged(username);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button variant="outline" onClick={() => { setError(''); setOpen(true); }}><Pencil size={16}/> Hesap bilgilerini düzenle</Button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }} title="Hesap bilgilerini düzenle">
      <form className="editor" onSubmit={submit}>
        <p className="info-note">Kullanıcı adını veya şifreni değiştirdiğinde yeniden giriş yapman gerekir.</p>
        <label>Kullanıcı adı<input name="username" autoComplete="username" autoCapitalize="none"
          defaultValue={account.username} minLength={3} maxLength={32} required/></label>
        <label>Mevcut şifre<input name="currentPassword" type="password" autoComplete="current-password" maxLength={256} required/></label>
        <label>Yeni şifre <span className="muted">İsteğe bağlı</span>
          <input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256}/>
        </label>
        <label>Yeni şifreyi doğrula<input name="confirmation" type="password" autoComplete="new-password" maxLength={256}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</Button>
      </form>
    </Dialog>
  </>;
}
