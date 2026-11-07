import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, UserRound, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  expense?: boolean;
};

export function Dialog({ open, onOpenChange, title, children, expense }: Props) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/40"/>
      <DialogPrimitive.Content aria-describedby={undefined} className={cn('dialog-content', expense && 'expense-dialog')}>
        {expense && <div className="expense-dialog-bar mobile-only">
          <DialogPrimitive.Close asChild><Button size="icon" variant="ghost" aria-label="Geri dön"><ArrowLeft size={22}/></Button></DialogPrimitive.Close>
          <img src="/icon-192.png" alt="" width={30} height={30}/>
          <span><small>Know Your Place</small><strong>Hızlı Ekle</strong></span>
          <span className="profile-icon"><UserRound size={18}/></span>
        </div>}
        <div className="dialog-heading">
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild><Button variant={expense ? 'soft' : 'ghost'} size="icon" aria-label="Kapat"><X size={20}/></Button></DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
