import { useState, useEffect, useRef } from "react";

export function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const start = useRef(null);
  const from = useRef(0);
  useEffect(() => {
    from.current = val;
    start.current = null;
    const step = (ts) => {
      if (!start.current) start.current = ts;
      const progress = Math.min(1, (ts - start.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(from.current + (target - from.current) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}
