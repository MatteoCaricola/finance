import './Sidebar.css';

const NAV = [
  { id: 'movimenti',   label: 'Movimenti',   icon: '↕' },
  { id: 'salvadanai',  label: 'Salvadanai',  icon: '🐷' },
  { id: 'grafici',     label: 'Grafici',     icon: '📊' },
];

export default function Sidebar({ active, onChange }) {
  return (
    <nav className="sidebar">
      <ul>
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              className={active === item.id ? 'active' : ''}
              onClick={() => onChange(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
