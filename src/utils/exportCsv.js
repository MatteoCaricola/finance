const TYPE_LABEL = { income: 'Entrata', expense: 'Uscita', transfer: 'Trasferimento' };
const SEP = ';';

function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportCsv(transactions) {
  const header = ['Data', 'Tipo', 'Importo (€)', 'Categoria', 'Descrizione', 'Da (wallet)', 'A (wallet)'];

  const rows = transactions.map((t) => [
    escapeCsvField(t.date),
    escapeCsvField(TYPE_LABEL[t.type] ?? t.type),
    String(t.amount).replace('.', ','),          // numero non quotato, decimale italiano
    escapeCsvField(t.category ?? ''),
    escapeCsvField(t.description ?? ''),
    escapeCsvField(t.type === 'transfer' ? (t.fromWalletName ?? '') : ''),
    escapeCsvField(t.type === 'transfer' ? (t.walletName ?? '') : ''),
  ].join(SEP));

  const csv = '﻿' + [header.map(escapeCsvField).join(SEP), ...rows].join('\n');

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
