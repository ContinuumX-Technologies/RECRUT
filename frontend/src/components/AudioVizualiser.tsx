"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function AudioVisualizerCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started || !containerRef.current) return;

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

      positions[i * 3]     = Math.cos(theta) * radius;
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
uColorLow:  { value: new THREE.Color("#b5b7deff") }, // electric blue
uColorMid:  { value: new THREE.Color("#4216bdff") }, // royal purple
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
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;

  // Clamp audio just in case
  float a = clamp(uBass, 0.0, 1.0);

  // First blend: low → mid
  vec3 colorLM = mix(
    uColorLow,
    uColorMid,
    smoothstep(0.05, 0.15, a)
  );

  // Second blend: mid → high
  vec3 finalColor = mix(
    colorLM,
    uColorHigh,
    smoothstep(0.25, 0.35, a)
  );

  gl_FragColor = vec4(finalColor, 1.0);
  
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

    /* ===================== CLEANUP ===================== */
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      audioCtx.close();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [started]);

  /* ===================== UI ===================== */
  return (
    <div className="relative w-full max-w-xl mx-auto rounded-2xl bg-black overflow-hidden shadow-xl">
      <div ref={containerRef} className="w-full h-96" />

      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <button
            onClick={() => setStarted(true)}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:scale-105 transition"
          >
            Enable Microphone
          </button>
        </div>
      )}
    </div>
  );
}