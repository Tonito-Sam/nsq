import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, type, ...props }, ref) => (
    <button
      ref={ref}
      // default to type=button to avoid accidental form submits when used inside forms
      type={type || 'button'}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
