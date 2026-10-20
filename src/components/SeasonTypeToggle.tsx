import type { SeasonType } from '../api/espn';

export function SeasonTypeToggle({ value, onChange }: { value: SeasonType; onChange: (v: SeasonType) => void }) {
  return (
    <div className="segmented">
      <button className={value === 2 ? 'active' : ''} onClick={() => onChange(2)}>Regular season</button>
      <button className={value === 3 ? 'active' : ''} onClick={() => onChange(3)}>Playoffs</button>
    </div>
  );
}
