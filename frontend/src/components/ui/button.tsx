import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-slate-800',
        outline: 'border border-border bg-white hover:bg-muted',
        ghost: 'hover:bg-muted',
        soft: 'bg-accent hover:bg-blue-100',
        income: 'bg-income text-white hover:bg-emerald-800',
        expense: 'bg-expense text-white hover:bg-red-800',
        destructive: 'bg-red-50 text-red-700 hover:bg-red-100',
      },
      size: { default: 'min-h-10 px-4 py-2', sm: 'min-h-9 px-3 py-1.5', icon: 'size-10 shrink-0' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props}/>;
}

export { Button, buttonVariants };
