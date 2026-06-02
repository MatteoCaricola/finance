import { useState, useEffect } from 'react';
import './InstallButton.css';

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isInStandaloneMode) return null;

  const handleInstall = async () => {
    if (isIOS) { setShowIOSHint((v) => !v); return; }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  if (!installPrompt && !isIOS) return null;

  return (
    <div className="install-wrap">
      <button className="install-btn" onClick={handleInstall} title="Installa app">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>

      {showIOSHint && (
        <div className="ios-hint">
          <button className="ios-hint-close" onClick={() => setShowIOSHint(false)}>×</button>
          <p>Per installare l'app su iOS:</p>
          <ol>
            <li>Tocca <strong>Condividi</strong> <span className="ios-share-icon">⎋</span> in Safari</li>
            <li>Seleziona <strong>"Aggiungi a schermata Home"</strong></li>
          </ol>
        </div>
      )}
    </div>
  );
}
