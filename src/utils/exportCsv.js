const TYPE_LABEL = { income: 'Entrata', expense: 'Uscita', transfer: 'Trasferimento' };

function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportCsv(transactions) {
  const header = ['Data', 'Tipo', 'Importo', 'Categoria', 'Descrizione', 'Da (wallet)', 'A (wallet)'];

  const rows = transactions.map((t) => [
    t.date,
    TYPE_LABEL[t.type] ?? t.type,
    t.amount,
    t.category ?? '',
    t.description ?? '',
    t.type === 'transfer' ? (t.fromWalletName ?? '') : '',
    t.type === 'transfer' ? (t.walletName ?? '') : '',
  ].map(escapeCsvField).join(','));

  const csv = '﻿' + [header.map(escapeCsvField).join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transazioni_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
