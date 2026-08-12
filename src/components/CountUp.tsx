import { useEffect, useRef, useState } from "react";

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Siffror räknar upp till sitt värde på 400 ms. Vid prefers-reduced-motion
 * hoppar den direkt till slutläget.
 */
export function useCountUp(target: number, duration = 400): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (prefersReduced()) {
        setValue(target);
        return;
      }
      from.current = 0;
    }
    if (prefersReduced()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const startValue = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(startValue + (target - startValue) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const v = useCountUp(value);
  return <span className={className}>{format(v)}</span>;
}
