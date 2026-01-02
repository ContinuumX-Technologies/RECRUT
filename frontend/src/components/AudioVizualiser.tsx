"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface AudioVisualizerProps {
    onRecordingStart?: () => void;
    onRecordingStop?: (duration: number) => void;
    onUploadComplete?: () => void;
    onAudioLevel?: (level: number) => void;
    isActive?: boolean;
    showControls?: boolean;
    variant?: 'default' | 'compact' | 'minimal';
    accentColor?: string;
    interviewId?: string;
    questionId?: string;
    // Conversational mode props
    silenceDetection?: boolean;
    silenceDurationMs?: number;
    // We keep this in the interface for backward compatibility with parent components,
    // but the logic has moved to noiseGateThreshold.
    silenceThreshold?: number; 
    // [NEW] Threshold for the noise gate (0.0 - 1.0)
    noiseGateThreshold?: number;
}

export default function AudioVisualizerCard({
    onRecordingStart,
    onRecordingStop,
    onUploadComplete,
    onAudioLevel,
    isActive = false,
    showControls = true,
    variant = 'default',
    accentColor = '#0071e3',
    interviewId,
    questionId,
    silenceDetection = true, 
    silenceDurationMs = 2500, 
    // silenceThreshold, <--- REMOVED this line to fix the TS error
    // [NEW] Default threshold for background noise (0.02 is a good starting point for filtering distant voices)
    noiseGateThreshold = 0.02
}: AudioVisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationRef = useRef<number | null>(null);

    // [NEW] Refs for Audio Processing Nodes (Noise Gate)
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    // Silence Detection Refs
    const lastAudioDetectedRef = useRef<number>(0);
    const speechStartedRef = useRef<boolean>(false);
    const processingSilenceRef = useRef<boolean>(false);

    // MediaRecorder Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Format duration as MM:SS
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Initialize audio context and request permissions
    const initializeAudio = useCallback(async () => {
        if (audioContextRef.current) return true;

        setIsInitializing(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            // Connect raw stream to analyser for visualization
            // This ensures the visualizer shows ALL sound (including background), as requested for analysis/feedback
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Store source for later use in the Noise Gate
            sourceNodeRef.current = source;

            setPermissionGranted(true);
            setPermissionDenied(false);
            setIsInitializing(false);

            return true;
        } catch (err) {
            console.error("Microphone access denied:", err);
            setPermissionDenied(true);
            setPermissionGranted(false);
            setIsInitializing(false);
            return false;
        }
    }, []);

    // Helper to upload audio
    const uploadAudio = async (blob: Blob, mimeType: string) => {
        // [DISABLED] Stop upload to backend as requested
        /*
        if (!interviewId) return;

        setIsUploading(true);
        const formData = new FormData();
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        formData.append('audio', blob, `answer-${questionId || 'unknown'}-${Date.now()}.${ext}`);

        if (questionId) {
            formData.append('questionId', questionId);
        }

        try {
            const res = await fetch(`${API_BASE}/api/interviews/${interviewId}/audio`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                console.log("Audio uploaded successfully");
                onUploadComplete?.();
            } else {
                console.error("Audio upload failed");
            }
        } catch (error) {
            console.error("Error uploading audio:", error);
        } finally {
            setIsUploading(false);
        }
        */
       
       // Call this to satisfy any parent cleanup logic, but no upload happens.
       onUploadComplete?.(); 
    };

    // Start recording with Noise Gate
    const startRecording = useCallback(async () => {
        const initialized = await initializeAudio();
        if (!initialized || !streamRef.current || !audioContextRef.current) return;

        setIsRecording(true);
        setIsPaused(false);
        setDuration(0);

        // Reset silence detection state
        speechStartedRef.current = false;
        processingSilenceRef.current = false;
        lastAudioDetectedRef.current = Date.now();

        const audioCtx = audioContextRef.current;

        // 1. Ensure Source Node exists (created in initializeAudio)
        if (!sourceNodeRef.current) {
            sourceNodeRef.current = audioCtx.createMediaStreamSource(streamRef.current);
        }

        // 2. Create Destination for Processed (Gated) Audio
        // This is what the MediaRecorder will listen to
        const destination = audioCtx.createMediaStreamDestination();
        destinationNodeRef.current = destination;

        // 3. Create ScriptProcessor for Noise Gate Logic
        // 4096 buffer size = ~92ms latency at 44.1kHz, good balance for performance/accuracy
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        // Noise Gate State
        const threshold = noiseGateThreshold;
        let holdCounter = 0;
        const holdSamples = 4410; // ~100ms hold time to avoid cutting off soft word endings

        // 4. Implement Audio Processing Logic
        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);
            let hasSignal = false; // Track if this buffer contains valid speech

            for (let i = 0; i < input.length; i++) {
                const amplitude = Math.abs(input[i]);

                if (amplitude > threshold) {
                    // Signal is loud enough (Candidate speaking)
                    output[i] = input[i];
                    holdCounter = holdSamples; // Reset hold timer
                    hasSignal = true;
                } else if (holdCounter > 0) {
                    // Signal is quiet, but we are holding (trailing voice)
                    output[i] = input[i];
                    holdCounter--;
                    hasSignal = true; // Still counts as speech
                } else {
                    // Signal is background noise -> Mute it
                    output[i] = 0;
                }
            }

            // [CRITICAL] Link Silence Detection directly to the Noise Gate
            // If the gate let sound through (hasSignal), we know the user is speaking.
            // If the gate muted everything, it counts as silence for the timer.
            if (hasSignal) {
                lastAudioDetectedRef.current = Date.now();
                if (!speechStartedRef.current) {
                    speechStartedRef.current = true;
                }
            }
        };

        // 5. Connect the Graph: Source -> Processor -> Destination
        sourceNodeRef.current.connect(processor);
        processor.connect(destination);

        // ============================================================
        // MediaRecorder Setup (Recording from the GATED destination)
        // ============================================================

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        }

        const recorder = new MediaRecorder(destination.stream, { mimeType });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            await uploadAudio(blob, mimeType);

            // Cleanup processing nodes to free resources
            if (processorNodeRef.current) {
                processorNodeRef.current.disconnect();
                // Ideally also disconnect from source, but source is shared with visualizer
                try { sourceNodeRef.current?.disconnect(processorNodeRef.current); } catch (e) { }
            }
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;

        timerRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);

        onRecordingStart?.();
    }, [initializeAudio, onRecordingStart, interviewId, questionId, noiseGateThreshold]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (processingSilenceRef.current && !isRecording) return;

        setIsRecording(false);
        setIsPaused(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Cleanup Processor
        if (processorNodeRef.current) {
            processorNodeRef.current.disconnect();
            processorNodeRef.current = null;
        }

        onRecordingStop?.(duration);
    }, [duration, onRecordingStop, isRecording]);

    // Pause/Resume recording
    const togglePause = useCallback(() => {
        if (isPaused) {
            // Resume
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
            mediaRecorderRef.current?.resume();
            lastAudioDetectedRef.current = Date.now();
        } else {
            // Pause
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            mediaRecorderRef.current?.pause();
        }
        setIsPaused(!isPaused);
    }, [isPaused]);

    // Auto-start when isActive prop changes
    useEffect(() => {
        if (isActive && !isRecording && !permissionDenied) {
            startRecording();
        } else if (!isActive && isRecording) {
            stopRecording();
        }
    }, [isActive]);

    // Monitor for Silence (Conversational Mode)
    useEffect(() => {
        if (!isRecording || isPaused || !silenceDetection || processingSilenceRef.current) return;

        const interval = setInterval(() => {
            // Only check if user has actually started speaking
            if (speechStartedRef.current) {
                const timeSinceAudio = Date.now() - lastAudioDetectedRef.current;

                if (timeSinceAudio > silenceDurationMs) {
                    console.log(`Silence detected (${timeSinceAudio}ms), auto-submitting...`);
                    processingSilenceRef.current = true;
                    stopRecording();
                }
            }
        }, 200);

        return () => clearInterval(interval);
    }, [isRecording, isPaused, silenceDetection, silenceDurationMs, stopRecording]);

    // Three.js Visualization
    useEffect(() => {
        if (!containerRef.current || !permissionGranted) return;

        const container = containerRef.current;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.z = 4;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0xffffff, 0);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        const analyser = analyserRef.current;
        if (!analyser) return;
        
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const COUNT = 10000;
        const positions = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
            const y = 1 - (i / (COUNT - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = Math.PI * (3 - Math.sqrt(5)) * i;
            positions[i * 3] = Math.cos(theta) * radius;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.sin(theta) * radius;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uTime: { value: 0 },
                uBass: { value: 0 },
                uScatter: { value: 0.80 },
                uColorLow: { value: new THREE.Color("#b5b7deff") },
                uColorMid: { value: new THREE.Color("#4216bdff") },
                uColorHigh: { value: new THREE.Color("#dc4ac6ff") }
            },
            vertexShader: `
                    uniform float uTime; uniform float uBass; uniform float uScatter;
                    float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
                    vec3 rotateY(vec3 p, float a) { float s = sin(a); float c = cos(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
                    vec3 rotateX(vec3 p, float a) { float s = sin(a); float c = cos(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
                    void main() {
                        vec3 dir = normalize(position);
                        float baseRadius = 0.55; float radius = baseRadius + uBass * 1.0;
                        vec3 t1 = normalize(cross(dir, vec3(0.0, 1.0, 0.0))); vec3 t2 = cross(dir, t1);
                        float noiseScale = 12.0; vec3 noisePos = dir * noiseScale;
                        noisePos = rotateY(noisePos, uTime * 0.02); noisePos = rotateX(noisePos, uTime * 0.03);
                        float n1 = hash(noisePos) - 0.5; float n2 = hash(noisePos + 7.3) - 0.5;
                        float strength = uScatter * 4.0 * (0.3 + uBass);
                        vec3 turbulence = t1 * n1 * strength + t2 * n2 * strength;
                        vec3 p = dir * radius + turbulence;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                        gl_PointSize = 0.15 + uBass * 2.5;
                    }
                `,
            fragmentShader: `
                    uniform float uBass;
                    void main() {
                        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
                        float alpha = 0.6 + uBass * 0.4;
                        gl_FragColor = vec4(vec3(0.0), alpha);
                    }
                `
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            analyser.getByteFrequencyData(freqData);
            let bass = 0;
            for (let i = 0; i < 50; i++) bass += freqData[i];
            bass = bass / 50 / 255;

            // Update UI state
            setAudioLevel(bass); 

            // NOTE: Silence detection is NOT handled here anymore.
            // It is handled in the ScriptProcessorNode (onaudioprocess) to align with the Noise Gate.
            // This ensures we only reset the timer if the voice is loud enough to pass the gate.

            material.uniforms.uTime.value += 0.01;
            const current = material.uniforms.uBass.value;
            const speed = bass > current ? 0.8 : 4; // attack / release
            material.uniforms.uBass.value += (bass - current) * speed;
            renderer.render(scene, camera);
            if (onAudioLevel) onAudioLevel(bass);
        };
        animate();

        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth; const h = container.clientHeight;
            camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            renderer.dispose(); geometry.dispose(); material.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
            // Don't close audioCtx here as it might be shared or needed for subsequent recordings
        };
    }, [permissionGranted, onAudioLevel]); 

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) audioContextRef.current.close();
            // Disconnect processor if exists
            if (processorNodeRef.current) processorNodeRef.current.disconnect();
        };
    }, []);

    // Variant classes
    const containerClasses = {
        default: 'audio-visualizer audio-visualizer--default',
        compact: 'audio-visualizer audio-visualizer--compact',
        minimal: 'audio-visualizer audio-visualizer--minimal'
    };

    return (
        <div className={containerClasses[variant]}>
            {/* Status Ring */}
            <div className={`audio-visualizer__ring ${isRecording ? 'audio-visualizer__ring--active' : ''}`}>
                <div className="audio-visualizer__ring-progress" style={{ '--audio-level': audioLevel, '--accent-color': accentColor } as React.CSSProperties} />
            </div>

            {/* Canvas Container */}
            <div ref={containerRef} className="audio-visualizer__canvas" />

            {/* Center Content */}
            <div className="audio-visualizer__center">
                {!permissionGranted && !permissionDenied && !isInitializing && (
                    <button className="audio-visualizer__start-btn" onClick={startRecording}>
                        <MicIcon /> <span>Tap to Start</span>
                    </button>
                )}
                {isInitializing && (
                    <div className="audio-visualizer__loading"><div className="audio-visualizer__spinner" /><span>Initializing...</span></div>
                )}
                {isUploading && (
                    <div className="audio-visualizer__loading"><div className="audio-visualizer__spinner" /><span>Uploading...</span></div>
                )}
                {permissionDenied && (
                    <div className="audio-visualizer__error">
                        <MicOffIcon /> <span>Microphone Access Denied</span>
                        <button className="audio-visualizer__retry-btn" onClick={() => { setPermissionDenied(false); initializeAudio(); }}>Try Again</button>
                    </div>
                )}
            </div>

            {/* Recording Status */}
            {permissionGranted && (
                <div className="audio-visualizer__status">
                    <div className={`audio-visualizer__indicator ${isRecording && !isPaused ? 'audio-visualizer__indicator--recording' : ''}`}>
                        <span className="audio-visualizer__dot" />
                        <span className="audio-visualizer__label">
                            {isRecording ? (isPaused ? 'Paused' : (speechStartedRef.current ? 'Listening...' : 'Speak now...')) : 'Ready'}
                        </span>
                    </div>
                    <div className="audio-visualizer__timer">{formatDuration(duration)}</div>
                </div>
            )}

            {/* Controls */}
            {showControls && permissionGranted && !isUploading && (
                <div className="audio-visualizer__controls">
                    {!isRecording ? (
                        <button className="audio-visualizer__btn audio-visualizer__btn--primary" onClick={startRecording}>
                            <MicIcon /> <span>Start Recording</span>
                        </button>
                    ) : (
                        <>
                            <button className="audio-visualizer__btn audio-visualizer__btn--secondary" onClick={togglePause}>
                                {isPaused ? <PlayIcon /> : <PauseIcon />}
                            </button>
                            <button className="audio-visualizer__btn audio-visualizer__btn--stop" onClick={stopRecording}>
                                <StopIcon /> <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Waveform Decoration */}
            {permissionGranted && (
                <div className="audio-visualizer__waveform">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="audio-visualizer__wave-bar"
                            style={{
                                animationDelay: `${i * 0.1}s`,
                                height: isRecording && !isPaused ? `${20 + Math.sin(i * 0.5 + audioLevel * 10) * audioLevel * 60}%` : '20%'
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Icon Components
const MicIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" /></svg>);
const MicOffIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.31.43-2.05H19zm-4 .16L9 5.18V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.16zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20h2v-2.28c.88-.11 1.71-.38 2.48-.77L19.73 21 21 19.73 4.27 3z" /></svg>);
const PlayIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z" /></svg>);
const PauseIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>);
const StopIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 6h12v12H6z" /></svg>);