interface TopBarProps {
  view: 'analyza' | 'porovnani' | 'zdroje';
  onViewChange: (view: 'analyza' | 'porovnani' | 'zdroje') => void;
  mode: 'demo' | 'custom';
  onModeChange: (mode: 'demo' | 'custom') => void;
  onStartTour: () => void;
  onReset: () => void;
}

export default function TopBar({ view, onViewChange, mode, onModeChange, onStartTour, onReset }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21c0-6 3.2-9.5 8-10.5-1 5.3-4 8.3-8 10.5Z"
              fill="currentColor"
              opacity="0.92"
            />
            <path d="M12 21C8 18 5.2 15.2 4 10.2c4.7 1 7.7 4.3 8 10.8Z" fill="currentColor" opacity="0.62" />
            <path d="M12 14.6V6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="4.6" r="1.7" fill="currentColor" />
          </svg>
        </div>
        <div>
          <div className="brand-title">SADY</div>
          <div className="brand-sub">Vyberte pozemek. Zjistěte, čemu se na něm bude dařit.</div>
        </div>
      </div>

      <nav className="topnav" aria-label="Hlavní navigace">
        <button type="button" className={view === 'analyza' ? 'active' : ''} onClick={() => onViewChange('analyza')}>
          Mapová analýza
        </button>
        <button type="button" className={view === 'porovnani' ? 'active' : ''} onClick={() => onViewChange('porovnani')}>
          Porovnání
        </button>
        <button type="button" className={view === 'zdroje' ? 'active' : ''} onClick={() => onViewChange('zdroje')}>
          Z čeho vycházíme
        </button>
      </nav>

      <div className="topbar-actions">
        <div className="mode-switch" role="group" aria-label="Režim práce">
          <button
            type="button"
            className={mode === 'demo' ? 'active' : ''}
            onClick={() => onModeChange('demo')}
            aria-pressed={mode === 'demo'}
          >
            Demo
          </button>
          <button
            type="button"
            className={mode === 'custom' ? 'active' : ''}
            onClick={() => onModeChange('custom')}
            aria-pressed={mode === 'custom'}
          >
            Vlastní pozemek
          </button>
        </div>
        <button type="button" className="btn primary" onClick={onStartTour}>
          ▶ Spustit ukázku
        </button>
        <button type="button" className="btn" onClick={onReset} title="Vrátit aplikaci do výchozího stavu dema">
          ↺ <span className="label">Obnovit demo</span>
        </button>
      </div>
    </header>
  );
}
