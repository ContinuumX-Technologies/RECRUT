import { useEffect } from 'react';

// [MODIFIED] Proctoring Hook Disabled
export function useProctor(
  interviewId: string,
  config: any | null
) {
  useEffect(() => {
    console.log('[DEV MODE] Proctoring & Webcam disabled.');
    
    // Optional: Remove any existing watermarks if hot-reloading
    const wm = document.getElementById('proctor-watermark');
    if (wm) wm.remove();
    
  }, []);

  return {};
}