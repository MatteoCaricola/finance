import './BudgetPanel.css';

const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function BudgetPanel({ transactions, budgets }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const monthTx = transactions.filter((t) => {
    const [ty, tm] = t.date.split('-').map(Number);
    return ty === y && tm === m && t.type === 'expense';
  });

  const entries = Object.entries(budgets).filter(([, limit]) => limit > 0);
  if (entries.length === 0) return null;

  return (
    <div className="budget-panel">
      <h3>Budget {now.toLocaleString('it-IT', { month: 'long' })}</h3>
      <div className="budget-bars">
        {entries.map(([cat, limit]) => {
          const spent = monthTx.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
          const pct = Math.min((spent / limit) * 100, 100);
          const over = spent > limit;
          const warn = !over && pct >= 80;
          const color = over ? '#ef4444' : warn ? '#f59e0b' : '#10b981';

          return (
            <div key={cat} className="budget-bar-item">
              <div className="budget-bar-top">
                <span className="budget-bar-cat">{cat}</span>
                <span className="budget-bar-amounts" style={{ color }}>
                  {fmt(spent)} / {fmt(limit)}
                  {over && ' ⚠️'}
                </span>
              </div>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
