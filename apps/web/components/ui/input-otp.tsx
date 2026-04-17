'use client';

import { OTPInput, OTPInputContext } from 'input-otp';
import { Minus } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn('flex items-center gap-2 has-[:disabled]:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

export function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />;
}

export function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) {
  const ctx = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = ctx?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'relative flex h-14 w-11 items-center justify-center border-y border-r border-white/[0.07] bg-white/[0.04] font-mono text-2xl text-foreground shadow-xs transition-all outline-none',
        'first:rounded-l-xl first:border-l last:rounded-r-xl',
        'data-[active=true]:z-10 data-[active=true]:border-brand-500/50 data-[active=true]:bg-white/[0.08] data-[active=true]:ring-[3px] data-[active=true]:ring-brand-500/20',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-pulse bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

export function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <Minus className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}
