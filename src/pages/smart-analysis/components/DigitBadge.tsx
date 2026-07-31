interface DigitBadgeProps {
  digit: number;
  type?: 'even' | 'odd' | 'over' | 'under' | 'equal';
  barrier?: number;
}

export default function DigitBadge({ digit, type, barrier }: DigitBadgeProps) {
  let colorClass = 'bg-gray-400 text-white';
  let label = String(digit);

  if (type === 'even') {
    colorClass = 'bg-blue-600 text-white';
    label = 'E';
  } else if (type === 'odd') {
    colorClass = 'bg-purple-600 text-white';
    label = 'O';
  } else if (barrier !== undefined) {
    if (digit > barrier) {
      colorClass = 'bg-teal-500 text-white';
      label = `${digit}o`;
    } else if (digit < barrier) {
      colorClass = 'bg-amber-500 text-white';
      label = `${digit}u`;
    } else {
      colorClass = 'bg-gray-400 text-white';
      label = `${digit}e`;
    }
  }

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shadow-xs ${colorClass}`}>
      {label}
    </span>
  );
}
