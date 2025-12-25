import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export type ProctorAlert = {
  hasWarning: boolean;
  type?: string;
  message?: string;
  objects?: string[];
  createdAt?: string;
};

export function useProctorAlerts(interviewId: string) {
  const [alert, setAlert] = useState<ProctorAlert | null>(null);
  const [lastSeenTs, setLastSeenTs] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) return;

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/interviews/${interviewId}/alerts`
        );
        if (!res.ok) {
          console.error('Failed to fetch alerts', await res.text());
          return;
        }

        const data: ProctorAlert = await res.json();
        if (!data.hasWarning) return;

        // Only show if it's new
        const ts = data.createdAt || '';
        if (!lastSeenTs || ts !== lastSeenTs) {
          setAlert(data);
          setLastSeenTs(ts);
        }
      } catch (e) {
        console.error('Error fetching proctor alerts', e);
      }
    }, 3000); // poll every 3s

    return () => {
      window.clearInterval(intervalId);
    };
  }, [interviewId, lastSeenTs]);

  return alert;
}