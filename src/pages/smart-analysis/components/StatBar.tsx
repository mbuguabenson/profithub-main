interface StatBarProps {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}

export default function StatBar({ label, value, color, highlight }: StatBarProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <span className={`text-xs font-medium ${highlight ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
        <span className={`text-xs font-bold ${highlight ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
          {value.toFixed(2)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
