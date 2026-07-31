import { DigitStats } from '../types/deriv';

interface DigitFrequencyChartProps {
  data: DigitStats[];
  highlightDigit?: number;
  highlightColor?: string;
}

export default function DigitFrequencyChart({ data, highlightDigit, highlightColor = 'bg-pink-500' }: DigitFrequencyChartProps) {
  const max = Math.max(...data.map(d => d.percentage), 1);

  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Digit Frequency Distribution</div>
      <div className="flex items-end gap-0.5 h-14">
        {data.map(d => (
          <div key={d.digit} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-gray-500 dark:text-gray-400 tabular-nums leading-none">
              {d.percentage.toFixed(2)}%
            </span>
            <div className="w-full flex items-end" style={{ height: '28px' }}>
              <div
                className={`w-full rounded-sm transition-all duration-300 ${
                  d.digit === highlightDigit ? highlightColor :
                  d.percentage === Math.max(...data.map(x => x.percentage)) ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                style={{ height: `${(d.percentage / max) * 28}px` }}
              />
            </div>
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{d.digit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
