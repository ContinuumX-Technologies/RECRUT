import React from 'react';

type Props = {
  interviewId: string;
  children: React.ReactNode; 
};

// [MODIFIED] Proctoring Logic Removed
export const ProctoredShell: React.FC<Props> = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* PROCTORING DISABLED 
         - No fullscreen checks
         - No overlays
         - No event listeners (copy/paste/devtools allowed)
      */}
      {children}
    </div>
  );
};