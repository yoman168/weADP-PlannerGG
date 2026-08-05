import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

/**
 * Status color convention (project-wide):
 *  success = green (completed / healthy), info = blue (active / in progress),
 *  warning = yellow (at risk), danger = red (blocked / critical / delayed),
 *  muted = gray (draft / inactive).
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        info: 'border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400',
        warning: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
        danger: 'border-transparent bg-red-500/15 text-red-700 dark:text-red-400',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
