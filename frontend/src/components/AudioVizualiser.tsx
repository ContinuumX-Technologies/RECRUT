"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

interface AudioVisualizerProps {
    onRecordingStart?: () => void;
    onRecordingStop?: (duration: number) => void;
    onAudioLevel?: (level: number) => void;
    isActive?: boolean;
    showControls?: boolean;
    variant?: 'default' | 'compact' | 'minimal';
    accentColor?: string;
}

export default function AudioVisualizerCard({
    onRecordingStart,
    onRecordingStop,
    onAudioLevel,
    isActive = false,
    showControls = true,
    variant = 'default',
    accentColor = '#0071e3'
}: AudioVisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationRef = useRef<number | null>(null);

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

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

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

    // Start recording
    const startRecording = useCallback(async () => {
        const initialized = await initializeAudio();
        if (!initialized) return;

        setIsRecording(true);
        setIsPaused(false);
        setDuration(0);

        // Start duration timer
        timerRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);

        onRecordingStart?.();
    }, [initializeAudio, onRecordingStart]);

    // Stop recording
    const stopRecording = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        onRecordingStop?.(duration);
    }, [duration, onRecordingStop]);

    // Pause/Resume recording
    const togglePause = useCallback(() => {
        if (isPaused) {
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
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

    // Three.js visualization
    useEffect(() => {
        if (!containerRef.current || !permissionGranted) return;

        const container = containerRef.current;

        /* ===================== SCENE ===================== */
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            60,
            containerRef.current.clientWidth /
            containerRef.current.clientHeight,
            0.1,
            100
        );
        camera.position.z = 4;

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setClearColor(0xffffff, 0); // white background, transparent


        renderer.setSize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
        );
        containerRef.current.appendChild(renderer.domElement);

        /* ===================== AUDIO ===================== */
        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;

        const freqData = new Uint8Array(analyser.frequencyBinCount);

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
        });
        /* ===================== PARTICLES ===================== */
        const COUNT = 10000;
        const positions = new Float32Array(COUNT * 3);

        // Fibonacci sphere (unit sphere)
        for (let i = 0; i < COUNT; i++) {
            const y = 1 - (i / (COUNT - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = Math.PI * (3 - Math.sqrt(5)) * i;

            positions[i * 3] = Math.cos(theta) * radius;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.sin(theta) * radius;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        /* ===================== SHADER ===================== */
        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uTime: { value: 0 },
                uBass: { value: 0 },
                uScatter: { value: 0.80 }, // ≈ Blender Strength 50
                uColorLow: { value: new THREE.Color("#b5b7deff") }, // electric blue
                uColorMid: { value: new THREE.Color("#4216bdff") }, // royal purple
                uColorHigh: { value: new THREE.Color("#dc4ac6ff") }  // plasma gold
            },
            vertexShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uScatter;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        vec3 rotateY(vec3 p, float a) {
          float s = sin(a);
          float c = cos(a);
          return vec3(
            c * p.x + s * p.z,
            p.y,
           -s * p.x + c * p.z
          );
        }

        vec3 rotateX(vec3 p, float a) {
          float s = sin(a);
          float c = cos(a);
          return vec3(
            p.x,
            c * p.y - s * p.z,
            s * p.y + c * p.z
          );
        }

        void main() {
          vec3 dir = normalize(position);

          /* Smaller initial sphere */
          float baseRadius = 0.55;
          float radius = baseRadius + uBass * 1.0;

          /* Tangent directions */
          vec3 t1 = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
          vec3 t2 = cross(dir, t1);

          /* Turbulence size ≈ 2.5 */
          float noiseScale = 12.0;
          vec3 noisePos = dir * noiseScale;

          /* Rotate noise field (Blender rotation drivers) */
          noisePos = rotateY(noisePos, uTime * 0.02);
          noisePos = rotateX(noisePos, uTime * 0.03);
           


          float n1 = hash(noisePos) - 0.5;
          float n2 = hash(noisePos + 7.3) - 0.5;

          /* Turbulence strength */
          float strength = uScatter * 4.0 * (0.3 + uBass);

          vec3 turbulence =
            t1 * n1 * strength +
            t2 * n2 * strength;

          vec3 p = dir * radius + turbulence;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(p, 1.0);

          float baseSize = 0.15;
float sizeBoost = uBass * 2.5;

gl_PointSize = baseSize + sizeBoost;
        }
      `,
      fragmentShader: `
      uniform float uBass;
      
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
      
        // Subtle fade with loudness
        float alpha = 0.6 + uBass * 0.4;
      
        // Black particles
        vec3 color = vec3(0.0);
      
        gl_FragColor = vec4(color, alpha);
      }
      `
      
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        /* ===================== ANIMATION ===================== */
        let frameId: number;
        let time = 0;

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            time += 0.01;

            analyser.getByteFrequencyData(freqData);

            let bass = 0;
            for (let i = 0; i < 50; i++) bass += freqData[i];
            bass = bass / 50 / 255;

            material.uniforms.uTime.value = time;
            const current = material.uniforms.uBass.value;

            const attack = 0.80;   // how fast it expands
            const release = 4;  // how fast it contracts (HIGHER = faster)

            const speed = bass > current ? attack : release;

            material.uniforms.uBass.value +=
                (bass - current) * speed;
            renderer.render(scene, camera);
        };

        animate();

        /* ===================== RESIZE ===================== */
        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        /* ===================== CLEANUP ===================== */
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [permissionGranted, isRecording, isPaused, onAudioLevel]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
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
                <div
                    className="audio-visualizer__ring-progress"
                    style={{
                        '--audio-level': audioLevel,
                        '--accent-color': accentColor
                    } as React.CSSProperties}
                />
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="audio-visualizer__canvas"
            />

            {/* Center Content */}
            <div className="audio-visualizer__center">
                {!permissionGranted && !permissionDenied && !isInitializing && (
                    <button
                        className="audio-visualizer__start-btn"
                        onClick={startRecording}
                    >
                        <MicIcon />
                        <span>Tap to Start</span>
                    </button>
                )}

                {isInitializing && (
                    <div className="audio-visualizer__loading">
                        <div className="audio-visualizer__spinner" />
                        <span>Initializing...</span>
                    </div>
                )}

                {permissionDenied && (
                    <div className="audio-visualizer__error">
                        <MicOffIcon />
                        <span>Microphone Access Denied</span>
                        <button
                            className="audio-visualizer__retry-btn"
                            onClick={() => {
                                setPermissionDenied(false);
                                initializeAudio();
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            {/* Recording Status */}
            {permissionGranted && (
                <div className="audio-visualizer__status">
                    <div className={`audio-visualizer__indicator ${isRecording && !isPaused ? 'audio-visualizer__indicator--recording' : ''}`}>
                        <span className="audio-visualizer__dot" />
                        <span className="audio-visualizer__label">
                            {isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Ready'}
                        </span>
                    </div>

                    <div className="audio-visualizer__timer">
                        {formatDuration(duration)}
                    </div>
                </div>
            )}

            {/* Audio Level Meter */}
            {permissionGranted && isRecording && (
                <div className="audio-visualizer__meter">
                    <div
                        className="audio-visualizer__meter-fill"
                        style={{
                            transform: `scaleX(${Math.min(audioLevel * 2, 1)})`,
                            backgroundColor: audioLevel > 0.6 ? '#ff9500' : audioLevel > 0.3 ? '#34c759' : accentColor
                        }}
                    />
                </div>
            )}

            {/* Controls */}
            {showControls && permissionGranted && (
                <div className="audio-visualizer__controls">
                    {!isRecording ? (
                        <button
                            className="audio-visualizer__btn audio-visualizer__btn--primary"
                            onClick={startRecording}
                        >
                            <MicIcon />
                            <span>Start Recording</span>
                        </button>
                    ) : (
                        <>
                            <button
                                className="audio-visualizer__btn audio-visualizer__btn--secondary"
                                onClick={togglePause}
                            >
                                {isPaused ? <PlayIcon /> : <PauseIcon />}
                            </button>
                            <button
                                className="audio-visualizer__btn audio-visualizer__btn--stop"
                                onClick={stopRecording}
                            >
                                <StopIcon />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Waveform Decoration */}
            {permissionGranted && (
                <div className="audio-visualizer__waveform">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="audio-visualizer__wave-bar"
                            style={{
                                animationDelay: `${i * 0.1}s`,
                                height: isRecording && !isPaused
                                    ? `${20 + Math.sin(i * 0.5 + audioLevel * 10) * audioLevel * 60}%`
                                    : '20%'
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Icon Components
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </svg>
);

const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.31.43-2.05H19zm-4 .16L9 5.18V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.16zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20h2v-2.28c.88-.11 1.71-.38 2.48-.77L19.73 21 21 19.73 4.27 3z" />
    </svg>
);

const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M6 6h12v12H6z" />
    </svg>
);