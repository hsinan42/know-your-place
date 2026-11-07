import { useRef } from 'react';
import { Download, LogOut, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { money } from '../../lib/format';
import type { State } from '../../types';
import { ProfileEditor } from '../auth/ProfileEditor';
import { useSession } from '../auth/session';
import { InstallApp } from './InstallApp';

type Props = {
  state: State;
  busy: boolean;
  onEdit: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onLogout: () => void;
};

export function SettingsPage({ state, busy, onEdit, onImport, onExport, onLogout }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const { account } = useSession();

  return <div className="detail-grid">
    <section className="panel" data-tour="planning">
      <h2>Planlama tercihleri</h2>
      <dl>
        <dt>Aylık maaş planı</dt><dd>{money(state.settings.salary)}</dd>
        <dt>Tasarruf hedefi</dt><dd>{money(state.settings.savingsTarget)}</dd>
      </dl>
      <p className="info-note">Maaş planı bakiyeyi artırmaz. Aldığın maaşı Gelirler'de maaş olarak kaydet. Maaş değişiklikleri bu ayın başından geçerli olur.</p>
      <Button onClick={onEdit}>Tercihleri düzenle</Button>
    </section>
    <section className="panel" data-tour="account">
      <h2>Hesabın</h2>
      <p className="muted my-3"><strong>{account.username}</strong>{account.isOwner && ' · Yönetici'}</p>
      <div className="flex flex-wrap gap-2"><ProfileEditor/>
        <Button variant="outline" disabled={busy} onClick={onLogout}><LogOut size={17}/> Güvenli çıkış</Button>
      </div>
    </section>
    <section className="panel">
      <h2>Verilerin senin kontrolünde</h2>
      <p className="muted mt-3">JSON yedeği tüm kayıtlarını içerir. İçe aktarma mevcut kayıtların tamamını değiştirir.</p>
      <div className="flex flex-wrap gap-3 my-5">
        <Button variant="outline" onClick={onExport}><Download size={17}/> Yedeği indir</Button>
        <Button variant="outline" disabled={busy} onClick={() => file.current?.click()}><Upload size={17}/> Yedekten geri yükle</Button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={event => {
        const selected = event.target.files?.[0];
        if (selected) onImport(selected);
        event.target.value = '';
      }}/>
      <InstallApp/>
    </section>
  </div>;
}
