// hooks/useIntersection.ts
import { useState, useEffect, useRef, type RefObject } from 'react';

interface UseIntersectionOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

interface UseIntersectionReturn {
  // FIX: Allow 'null' in the generic type to match useRef's behavior
  ref: RefObject<HTMLDivElement | null>; 
  isIntersecting: boolean;
}

export const useIntersection = (
  options: UseIntersectionOptions = {}
): UseIntersectionReturn => {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = true,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  
  // FIX: Explicitly include 'null' in the generic type
  const ref = useRef<HTMLDivElement | null>(null);
  
  const frozen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (freezeOnceVisible) {
            frozen.current = true;
            observer.unobserve(element);
          }
        } else if (!frozen.current) {
          setIsIntersecting(false);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, root, rootMargin, freezeOnceVisible]);

  return { ref, isIntersecting };
};