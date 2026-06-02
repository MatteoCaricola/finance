import { useState, useEffect, useRef } from 'react';
import { CHANGELOG } from '../changelog';
import './NotificationBell.css';

const STORAGE_KEY = 'finance_read_versions';

function getReadVersions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function markAllRead() {
  const all = CHANGELOG.map((c) => c.version);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readVersions, setReadVersions] = useState(getReadVersions);
  const panelRef = useRef(null);

  const unreadCount = CHANGELOG.filter((c) => !readVersions.includes(c.version)).length;

  const handleOpen = () => {
    setOpen((v) => {
      if (!v) {
        markAllRead();
        setReadVersions(CHANGELOG.map((c) => c.version));
      }
      return !v;
    });
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="notif-wrap" ref={panelRef}>
      <button className="notif-btn" onClick={handleOpen} aria-label="Notifiche">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Novità</span>
          </div>
          <div className="notif-panel-body">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="notif-entry">
                <div className="notif-entry-header">
                  <span className="notif-version">v{entry.version}</span>
                  <span className="notif-date">{new Date(entry.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <ul className="notif-notes">
                  {entry.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
