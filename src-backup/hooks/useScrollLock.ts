import useLockBodyScroll from './useLockBodyScroll';

// Default export for backward compatibility
export default useLockBodyScroll;

// Named export so callers can do: import { useScrollLock } from '@/hooks/useScrollLock'
export const useScrollLock = useLockBodyScroll;
