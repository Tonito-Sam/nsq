import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={`px-3 py-2 border rounded-md ${className}`}
      {...props}
    />
  )
);

Input.displayName = 'Input';
