import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import NucleoDetailPage from './NucleoDetailPage';
import './NucleiPage.css';

export default function NucleiPage({ nuclei, user, transactions }) {
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = nuclei.find((n) => n.id === selectedId);

  if (selectedId && selected) {
    return (
      <NucleoDetailPage
        nucleo={selected}
        user={user}
        userTransactions={transactions}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const inviteCode = Math.random().toString(36).slice(2, 10);
      const ref = await addDoc(collection(db, 'nuclei'), {
        name: newName.trim(),
        createdBy: user.uid,
        members: [user.uid],
        inviteCode,
        createdAt: serverTimestamp(),
      });
      setCreating(false);
      setNewName('');
      setSelectedId(ref.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nuclei-page">
      <div className="nuclei-header">
        <h2>I tuoi nuclei</h2>
        {!creating && (
          <button className="btn-new-nucleo" onClick={() => setCreating(true)}>+ Nuovo</button>
        )}
      </div>

      {creating && (
        <form className="nucleo-create-form" onSubmit={handleCreate}>
          <input
            autoFocus
            type="text"
            placeholder="Nome del nucleo (es. Casa mia)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <div className="nucleo-create-actions">
            <button type="button" onClick={() => { setCreating(false); setNewName(''); }}>
              Annulla
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Creazione...' : 'Crea'}
            </button>
          </div>
        </form>
      )}

      {nuclei.length === 0 && !creating && (
        <p className="nuclei-empty">
          Nessun nucleo. Creane uno per condividere transazioni con amici, partner o famiglia.
        </p>
      )}

      <div className="nuclei-list">
        {nuclei.map((n) => (
          <div key={n.id} className="nucleo-card" onClick={() => setSelectedId(n.id)}>
            <div className="nucleo-avatar">👥</div>
            <div className="nucleo-info">
              <span className="nucleo-name">{n.name}</span>
              <span className="nucleo-meta">
                {n.members.length} {n.members.length === 1 ? 'membro' : 'membri'}
              </span>
            </div>
            <span className="nucleo-arrow">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
