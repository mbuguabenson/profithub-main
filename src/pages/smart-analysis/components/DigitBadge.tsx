interface DigitBadgeProps {
  digit: number;
  type?: 'even' | 'odd' | 'over' | 'under' | 'equal';
  barrier?: number;
}

export default function DigitBadge({ digit, type, barrier }: DigitBadgeProps) {
  let colorClass = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
  let label = String(digit);

  if (type) {
    colorClass = type === 'even' || type === 'over'
      ? 'bg-purple-500 text-white'
      : type === 'odd' || type === 'under'
      ? 'bg-purple-500 text-white'
      : 'bg-yellow-400 text-white';
  } else if (barrier !== undefined) {
    if (digit > barrier) {
      colorClass = 'bg-teal-500 text-white';
      label = `${digit}o`;
    } else if (digit < barrier) {
      colorClass = 'bg-orange-400 text-white';
      label = `${digit}u`;
    } else {
      colorClass = 'bg-yellow-400 text-white';
      label = `${digit}e`;
    }
  }

  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${colorClass}`}>
      {label}
    </span>
  );
}
