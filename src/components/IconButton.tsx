import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  children: ReactNode;
}

/** Icon-only button with an accessible label and visible focus ring. */
export function IconButton({ label, children, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-blue-100 aria-pressed:text-blue-800 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
