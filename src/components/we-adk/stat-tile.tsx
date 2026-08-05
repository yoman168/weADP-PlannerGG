import { type ReactNode } from 'react';
import { Card, CardContent, cn } from '@/components/ui';

export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardContent className="flex flex-col gap-1 px-4 py-3">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}
