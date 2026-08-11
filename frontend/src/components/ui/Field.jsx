import { forwardRef, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Field — the labelled wrapper. Owns the label, hint and error slots so every
 * form in the app spaces them identically.
 */
export function Field({ label, hint, error, htmlFor, required, className, children }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
          {required && <span className="ml-1 text-crit">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-2xs font-medium text-crit">{error}</p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, mono, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn('control', mono && 'font-mono', invalid && 'control-invalid', className)}
      {...props}
    />
  );
});

/** Input with a leading icon well — used for search boxes. */
export const InputWithIcon = forwardRef(function InputWithIcon(
  { className, icon: Icon, trailing, invalid, ...props }, ref,
) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-ghost" />
      )}
      <input
        ref={ref}
        className={cn(
          'control',
          Icon && 'pl-10',
          trailing && 'pr-10',
          invalid && 'control-invalid',
          className,
        )}
        {...props}
      />
      {trailing && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
      )}
    </div>
  );
});

/** Password input with a reveal toggle. */
export const PasswordInput = forwardRef(function PasswordInput(
  { className, invalid, ...props }, ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn('control pr-10', invalid && 'control-invalid', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-ghost transition-colors hover:text-ink-muted"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

/** Native select, restyled — keeps mobile's native picker, which is the right call. */
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn('control cursor-pointer appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
    </div>
  );
});

/**
 * NumberStepper — a number input flanked by explicit -/+ controls. Timeout
 * settings are adjusted far more often than they're typed.
 */
export function NumberStepper({
  value, onChange, min = 0, max = 1440, step = 1, disabled, suffix, id,
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const clamp = (n) => Math.max(min, Math.min(max, n));
  const num = Number(value) || 0;

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-line bg-abyss/70 focus-within:border-signal-500/70 focus-within:ring-2 focus-within:ring-signal-500/25">
        <button
          type="button"
          disabled={disabled || num <= min}
          onClick={() => onChange(clamp(num - step))}
          aria-label="Decrease"
          className="px-3 text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
        >
          –
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="w-16 border-x border-line bg-transparent py-2.5 text-center font-mono text-sm text-ink tnum focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || num >= max}
          onClick={() => onChange(clamp(num + step))}
          aria-label="Increase"
          className="px-3 text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
        >
          +
        </button>
      </div>
      {suffix && <span className="text-sm text-ink-faint">{suffix}</span>}
    </div>
  );
}
