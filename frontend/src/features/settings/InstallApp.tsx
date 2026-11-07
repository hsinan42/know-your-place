import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
type InstallPrompt = Event & { prompt: () => Promise<InstallChoice> };

let pendingPrompt: InstallPrompt | null = null;
let installAccepted = false;
const standalone = window.matchMedia('(display-mode: standalone)');
const device = navigator as Navigator & { standalone?: boolean };

// Capture the event before sign-in. The browser can send it while the login page is open.
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingPrompt = event as InstallPrompt;
  installAccepted = false;
});

window.addEventListener('appinstalled', () => {
  pendingPrompt = null;
  installAccepted = true;
});

function isInstalled() {
  return installAccepted || standalone.matches || device.standalone === true;
}

function InstallInstructions() {
  if (!window.isSecureContext) {
    return <p>Yüklemek için Know Your Place’i HTTPS adresinden aç ve bu düğmeye tekrar dokun.</p>;
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(device.userAgent) ||
    (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1);
  if (isAppleMobile) {
    return <ol className="list-decimal space-y-2 pl-5">
      <li>Know Your Place’i Safari’de aç ve <strong>Paylaş</strong> simgesine dokun.</li>
      <li><strong>Ana Ekrana Ekle</strong>’yi seç.</li>
      <li>Varsa <strong>Web Uygulaması Olarak Aç</strong> seçeneğini açık bırak ve <strong>Ekle</strong>’ye dokun.</li>
    </ol>;
  }

  if (/Android/i.test(device.userAgent)) {
    return <p>Chrome’da sağ üstteki <strong>⋮</strong> menüsünü aç. <strong>Ana ekrana ekle</strong> veya <strong>Uygulamayı yükle</strong> seçeneğine dokun ve onayla.</p>;
  }

  return <p>Tarayıcının adres çubuğundaki yükleme simgesini veya menüsündeki <strong>Uygulamayı yükle</strong> seçeneğini kullan.</p>;
}

export function InstallApp() {
  const [installed, setInstalled] = useState(isInstalled);
  const [prompting, setPrompting] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function update() {
      setInstalled(isInstalled());
    }
    update();
    window.addEventListener('appinstalled', update);
    standalone.addEventListener('change', update);
    return () => {
      window.removeEventListener('appinstalled', update);
      standalone.removeEventListener('change', update);
    };
  }, []);

  async function install() {
    const prompt = pendingPrompt;
    if (!window.isSecureContext || !prompt) {
      setHelp(true);
      return;
    }
    pendingPrompt = null;
    setPrompting(true);
    try {
      const choice = await prompt.prompt();
      if (choice.outcome === 'accepted') {
        installAccepted = true;
        setInstalled(true);
      }
    } catch {
      setHelp(true);
    } finally {
      setPrompting(false);
    }
  }

  return <>
    {installed ? <p className="info-note" role="status">Uygulama yüklü.</p> :
      <Button variant="outline" onClick={install} disabled={prompting}><Smartphone size={17}/> Ana ekrana ekle</Button>}
    <Dialog open={help} onOpenChange={setHelp} title="Ana ekrana ekle">
      <InstallInstructions/>
    </Dialog>
  </>;
}
