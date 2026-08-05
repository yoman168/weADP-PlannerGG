import { cn } from '@/components/ui';
import { CHIP_CLASSES, type Chip } from '@/lib/we-adk-mock/types';

export function StatusChip({ label, tone, className }: Chip & { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        CHIP_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
