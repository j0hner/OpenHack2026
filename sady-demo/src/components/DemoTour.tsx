interface DemoTourProps {
  step: number;
  total: number;
  title: string;
  text: string;
  onNext: () => void;
  onClose: () => void;
  onRestart: () => void;
}

export default function DemoTour({ step, total, title, text, onNext, onClose, onRestart }: DemoTourProps) {
  const isLast = step === total - 1;
  return (
    <div className="tour" role="dialog" aria-live="polite" aria-label="Ukázková prezentace">
      <div className="tour-head">
        Ukázka {step + 1} / {total}
        <button type="button" className="btn small tour-close" onClick={onClose} aria-label="Ukončit ukázku">
          ✕
        </button>
      </div>
      <div className="tour-title">{title}</div>
      <p className="tour-text">{text}</p>
      <div className="tour-actions">
        <button type="button" className="btn" onClick={onRestart}>
          ↺ Začít znovu
        </button>
        <button type="button" className="btn primary" onClick={isLast ? onClose : onNext}>
          {isLast ? 'Dokončit' : 'Další krok →'}
        </button>
        <div className="tour-dots" aria-hidden="true">
          {Array.from({ length: total }).map((_, index) => (
            <span key={index} className={index === step ? 'on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}
