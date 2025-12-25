import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioRecorderProps {
  interviewId: string;
  questionId?: string;
  onRecordingComplete?: () => void;
}

// Icons
const Icons = {
  Microphone: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  Stop: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  Play: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Pause: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Retry: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Delete: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

type RecordingState = 'idle' | 'recording' | 'processing' | 'playing' | 'uploaded' | 'error';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function AudioRecorder({ 
  interviewId, 
  questionId,
  onRecordingComplete 
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Timer for recording duration
  useEffect(() => {
    if (state === 'recording') {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      setErrorMessage(null);
      setPermissionDenied(false);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;

      // Prefer MP4 if available, else WebM (Opus or default)
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        // Upload audio with the detected mimeType
        await uploadAudio(blob, mimeType);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setState('recording');
      setDuration(0);
      
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setErrorMessage('Microphone permission denied. Please allow microphone access to record your answer.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No microphone found. Please connect a microphone and try again.');
      } else {
        setErrorMessage('Failed to start recording. Please try again.');
      }
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      setState('processing');
      mediaRecorderRef.current.stop();
      setDuration(0);
    }
  }, [state]);

  const uploadAudio = useCallback(async (blob: Blob, mimeType: string) => {
    try {
      setState('processing');
      setUploadProgress(0);

      const formData = new FormData();
      // Determine file extension based on actual mimeType
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `answer-${questionId || 'unknown'}-${Date.now()}.${ext}`;
      
      formData.append('audio', blob, filename);
      if (questionId) {
        formData.append('questionId', questionId);
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/audio`,
        { 
          method: 'POST', 
          body: formData 
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setState('uploaded');
      setErrorMessage(null);
      
      // Notify parent component
      if (onRecordingComplete) {
        onRecordingComplete();
      }

      // Reset after success
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload recording. Please try again.');
      setState('error');
      setUploadProgress(0);
    }
  }, [interviewId, questionId, onRecordingComplete]);

  const playRecording = useCallback(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl]);

  const pauseRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const deleteRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setState('idle');
    setDuration(0);
    setIsPlaying(false);
    setErrorMessage(null);
  }, [audioUrl]);

  const retryRecording = useCallback(() => {
    deleteRecording();
    startRecording();
  }, [deleteRecording, startRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Main Recording Interface */}
      <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
        
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              state === 'recording' ? 'bg-red-500/20 text-red-400' :
              state === 'uploaded' ? 'bg-emerald-500/20 text-emerald-400' :
              state === 'error' ? 'bg-red-500/20 text-red-400' :
              'bg-slate-700/50 text-slate-400'
            }`}>
              {state === 'recording' ? <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> :
               state === 'uploaded' ? <Icons.Check /> :
               state === 'error' ? <Icons.Retry /> :
               <Icons.Microphone />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {state === 'idle' ? 'Ready to Record' :
                 state === 'recording' ? 'Recording...' :
                 state === 'processing' ? 'Processing...' :
                 state === 'uploaded' ? 'Answer Recorded' :
                 state === 'error' ? 'Recording Failed' :
                 'Audio Recorder'}
              </h3>
              {state === 'recording' && (
                <p className="text-xs text-slate-400 mt-1">
                  {formatTime(duration)} elapsed
                </p>
              )}
            </div>
          </div>

          {/* Duration/Status Display */}
          {state === 'recording' && (
            <div className="text-2xl font-mono text-red-400 animate-pulse">
              {formatTime(duration)}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <AnimatePresence>
          {(state === 'processing' || uploadProgress > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-linear-to-r from-emerald-500 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Upload complete!'}
              </p>
              </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Playback */}
        {audioUrl && (
          <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
            <audio 
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={isPlaying ? pauseRecording : playRecording}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>
              <div className="flex-1">
                <div className="h-8 flex items-center gap-0.5">
                  {/* Audio waveform visualization */}
                  {Array.from({ length: 20 }, (_, i) => (
                    <div
                      key={i}
                      className={`flex-1 bg-emerald-500/50 rounded-full transition-all ${
                        isPlaying ? 'animate-pulse' : ''
                      }`}
                      style={{
                        height: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={deleteRecording}
                className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/20 text-slate-400 hover:text-red-400 transition-colors"
                aria-label="Delete recording"
              >
                <Icons.Delete />
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm"
            >
              <div className="flex items-start gap-2">
                <Icons.Retry />
                <div className="flex-1">
                  <p>{errorMessage}</p>
                  {permissionDenied && (
                    <p className="text-xs mt-1 text-red-400/70">
                      Click the browser's address bar and enable microphone permissions.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {state === 'idle' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startRecording}
              className="flex-1 px-6 py-3 rounded-lg bg-linear-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
            >
              <Icons.Microphone />
              Start Recording
            </motion.button>
          )}

          {state === 'recording' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={stopRecording}
              className="flex-1 px-6 py-3 rounded-lg bg-linear-to-r from-red-600 to-red-500 text-white font-medium text-sm hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 animate-pulse"
            >
              <Icons.Stop />
              Stop Recording
            </motion.button>
          )}

          {state === 'uploaded' && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={retryRecording}
                className="flex-1 px-6 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Icons.Retry />
                Re-record
              </motion.button>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              >
                <Icons.Check />
                <span className="text-sm font-medium">Answer Saved</span>
              </motion.div>
            </>
          )}

          {state === 'error' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startRecording}
              className="flex-1 px-6 py-3 rounded-lg bg-linear-to-r from-amber-600 to-amber-500 text-white font-medium text-sm hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
            >
              <Icons.Retry />
              Try Again
            </motion.button>
          )}

          {state === 'processing' && (
            <div className="flex-1 px-6 py-3 rounded-lg bg-slate-800/50 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-slate-400 text-sm font-medium">Processing audio...</span>
            </div>
          )}
        </div>

        {/* Recording Tips */}
        {state === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 p-3 rounded-lg bg-slate-900/30 border border-slate-700/30"
          >
            <p className="text-xs text-slate-400">
              💡 <span className="font-medium">Tip:</span> Find a quiet space and speak clearly. 
              You can re-record your answer if needed.
            </p>
          </motion.div>
        )}

        {/* Visual Recording Indicator */}
        <AnimatePresence>
          {state === 'recording' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-red-500 rounded-full"
                    animate={{
                      height: [8, 20, 8],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recording Guidelines */}
      <div className="p-4 rounded-lg bg-slate-900/20 border border-slate-800/30">
        <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          Recording Guidelines
        </h4>
        <ul className="space-y-1.5 text-xs text-slate-500">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>Speak clearly and at a moderate pace</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>Keep your answer concise and focused</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>You can re-record if you're not satisfied</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>Recording will be saved automatically</span>
          </li>
        </ul>
      </div>

      {/* Keyboard Shortcuts (hidden but functional) */}
      <div className="hidden">
        <kbd className="text-xs">Space</kbd> to start/stop recording
      </div>
    </div>
  );
}