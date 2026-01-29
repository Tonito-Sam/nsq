declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    ticks?: number;
    gravity?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    scalar?: number;
    shapes?: string[];
    drift?: number;
    [key: string]: any;
  }

  export default function confetti(options?: ConfettiOptions): boolean;

  export function create(canvas: HTMLCanvasElement, opts?: any): {
    (options?: ConfettiOptions): boolean;
  };
}
