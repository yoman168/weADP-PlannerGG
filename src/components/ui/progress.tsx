import * as React from 'react';
import { cn } from './lib/cn';

/** Determinate progress bar (0–100). */
function Progress({ value, className, ...props }: React.ComponentProps<'div'> & { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('bg-muted h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className="bg-primary h-full rounded-full transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
