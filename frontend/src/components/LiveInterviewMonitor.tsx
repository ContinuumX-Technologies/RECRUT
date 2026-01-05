import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// Helper to correctly extract the JWT from your 'auth' localStorage object
const getAuthToken = () => {
  const saved = localStorage.getItem('auth');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed.token;
    } catch (e) {
      console.error("Failed to parse auth token", e);
    }
  }
  return null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Individual Camera Feed Card
const CameraFeed = ({ interviewId, candidateName, onExpand }: any) => {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchToken = async () => {
      const authToken = getAuthToken();
      if (!authToken) {
        if (isMounted) setError("Unauthorized");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/livekit/token`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ room: interviewId, username: 'AdminMonitor', role: 'admin' })
        });
        
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        
        const data = await res.json();
        
        if (isMounted) {
          // [FIX] Robustly handle token structure (nested vs flat)
          let finalToken = data.token;
          let finalUrl = data.url;

          // If backend returns { token: { token: "...", url: "..." }, url: "..." }
          if (typeof finalToken === 'object' && finalToken !== null) {
             if (finalToken.token) finalToken = finalToken.token;
             if (finalToken.url && !finalUrl) finalUrl = finalToken.url;
          }

          if (typeof finalToken === 'string') {
            setToken(finalToken);
            setUrl(finalUrl);
          } else {
            console.error("Invalid token format:", data);
            setError("Invalid Token");
          }
        }
      } catch (e) {
        if (isMounted) {
          console.error("Feed error:", e);
          setError("Connection Failed");
        }
      }
    };

    fetchToken();
    return () => { isMounted = false; };
  }, [interviewId]);

  if (error) return <div className="admin-feed-error">{error}</div>;
  if (!token || !url) return <div className="admin-feed-loading">Connecting...</div>;

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      audio={false} // Mute audio in grid to prevent noise
      className="admin-feed-room"
    >
      <FeedContent candidateName={candidateName} onExpand={onExpand} />
    </LiveKitRoom>
  );
};

const FeedContent = ({ candidateName, onExpand }: any) => {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);
  const cameraTrack = tracks.find(t => t.source === Track.Source.Camera);

  return (
    <div className="admin-feed-card" onClick={onExpand}>
      {cameraTrack ? (
        <VideoTrack trackRef={cameraTrack} className="admin-feed-video" />
      ) : (
        <div className="admin-feed-placeholder">
          <span>Waiting for video...</span>
        </div>
      )}
      <div className="admin-feed-overlay">
        <span className="admin-feed-name">{candidateName}</span>
        <span className="admin-feed-live-badge">LIVE</span>
      </div>
    </div>
  );
};

// Full Screen Modal View
const FullScreenView = ({ interview, onClose }: any) => {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = getAuthToken();
      if (!authToken) return;

      try {
        const res = await fetch(`${API_BASE}/api/livekit/token`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ room: interview.id, username: 'AdminViewer', role: 'admin' })
        });
        const data = await res.json();
        
        // [FIX] Apply same robust logic here
        let finalToken = data.token;
        let finalUrl = data.url;

        if (typeof finalToken === 'object' && finalToken !== null) {
            if (finalToken.token) finalToken = finalToken.token;
            if (finalToken.url && !finalUrl) finalUrl = finalToken.url;
        }

        setToken(finalToken);
        setUrl(finalUrl);
      } catch (e) {
        console.error(e);
      }
    };
    fetchToken();
  }, [interview.id]);

  if (!token || !url) return null;

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal-fullscreen">
        <button className="admin-modal-close" onClick={onClose}>✕ Close Stream</button>
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect={true}
          video={true}
          audio={true}
          className="admin-fullscreen-room"
        >
          <FullScreenContent interview={interview} />
        </LiveKitRoom>
      </div>
    </div>
  );
};

const FullScreenContent = ({ interview }: any) => {
    const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);
    const cameraTrack = tracks.find(t => t.source === Track.Source.Camera);
  
    return (
      <div className="admin-fullscreen-video-wrapper">
        {cameraTrack && <VideoTrack trackRef={cameraTrack} className="admin-fullscreen-video" />}
        <div className="admin-fullscreen-info">
            <h2>{interview.candidateName}</h2>
            <p>Live Interview Feed</p>
        </div>
      </div>
    );
};

export const LiveInterviewMonitor = ({ interviews }: any) => {
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  
  // PAGINATION STATE
  const [page, setPage] = useState(0);
  const CAMERAS_PER_PAGE = 12; 

  const paginatedInterviews = interviews.slice(
    page * CAMERAS_PER_PAGE, 
    (page + 1) * CAMERAS_PER_PAGE
  );

  const totalPages = Math.ceil(interviews.length / CAMERAS_PER_PAGE);

  return (
    <div className="admin-monitor-container">
      {/* Pagination Controls */}
      <div className="admin-monitor-controls">
         <span>Monitoring {interviews.length} Candidates</span>
         {totalPages > 1 && (
           <div className="admin-pagination">
              <button 
                disabled={page === 0} 
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button 
                disabled={page >= totalPages - 1} 
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
           </div>
         )}
      </div>

      {/* Grid Only Renders ~12 Active Connections */}
      <div className="admin-monitor-grid">
        {paginatedInterviews.map((iv: any) => (
          <CameraFeed 
            key={iv.id} 
            interviewId={iv.id} 
            candidateName={iv.candidateName} 
            onExpand={() => setSelectedInterview(iv)} 
          />
        ))}
        {paginatedInterviews.length === 0 && (
           <div className="admin-empty-state">No active interviews</div>
        )}
      </div>

      {selectedInterview && (
        <FullScreenView 
           interview={selectedInterview} 
           onClose={() => setSelectedInterview(null)} 
        />
      )}
    </div>
  );
};