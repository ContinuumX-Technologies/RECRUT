import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

interface MorphingParticleTextProps {
  text: string;
  className?: string;
}

export const MorphingParticleText = ({ text, className = '' }: MorphingParticleTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  
  const isSphereRef = useRef<boolean>(true);
  
  // High particle count for dense, readable multi-line text
  const particleCount = 45000; 
  const baseFontSize = 100;

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. SETUP SCENE ---
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // --- 2. CREATE PARTICLES (Initial Sphere) ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        const r = 10;
        
        positions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
        positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const color = new THREE.Color();
        color.setHSL(0, 0, 0.1 + Math.random() * 0.2); // Dark grey/black
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.2, 
      vertexColors: true,
      blending: THREE.NormalBlending, 
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // --- 3. ANIMATION LOOP ---
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);
      if (particlesRef.current && isSphereRef.current) {
        particlesRef.current.rotation.y += 0.002;
      }
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    // --- 4. RESIZE HANDLER ---
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timelineRef.current) timelineRef.current.kill();
      if (renderer.domElement && container) container.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      particlesRef.current = null;
    };
  }, []);

  // --- MORPHING LOGIC ---
  useEffect(() => {
    if (!particlesRef.current || !text || !containerRef.current) return;

    // 1. Calculate Visible 3D Bounds
    const container = containerRef.current;
    const aspect = container.clientWidth / container.clientHeight;
    const fov = 45; 
    const cameraZ = 50;
    const vFovRad = (fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFovRad / 2) * cameraZ;
    const visibleWidth = visibleHeight * aspect;

    // 2. Generate Points from Text
    const getTargetPoints = (str: string) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        // [MODIFIED] Set a realistic width limit to force wrapping
        // This ensures long text breaks into multiple lines instead of one giant thin line
        const maxLineWidth = 1800; 
        const lineHeight = baseFontSize * 1.2;
        
        ctx.font = `900 ${baseFontSize}px "Inter", sans-serif`;
        
        const words = str.split(' ');
        let line = '';
        const lines = [];
        
        // Word wrap logic
        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxLineWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        canvas.width = maxLineWidth + 200; 
        // Dynamic height based on number of lines
        canvas.height = (lines.length * lineHeight) + 400; 

        ctx.fillStyle = 'white';
        ctx.font = `900 ${baseFontSize}px "Inter", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // Draw text lines centered
        const totalTextHeight = lines.length * lineHeight;
        const startY = (canvas.height - totalTextHeight) / 2 + (lineHeight / 2);
        
        lines.forEach((l, i) => {
            ctx.fillText(l, canvas.width / 2, startY + (i * lineHeight));
        });

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const points = [];
        
        // Adaptive sampling step
        const step = str.length > 100 ? 3 : 2; 

        for (let i = 0; i < pixels.length; i += 4 * step) {
            if (pixels[i] > 128) {
                const posX = (i / 4) % canvas.width;
                const posY = Math.floor((i / 4) / canvas.width);
                points.push({
                    x: posX - canvas.width / 2,
                    y: -(posY - canvas.height / 2)
                });
            }
        }
        return points;
    };

    const rawTextPoints = getTargetPoints(text);

    // Shuffle points to prevent "cut off" look if we hit the particle limit
    if (rawTextPoints.length > particleCount) {
        for (let i = rawTextPoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawTextPoints[i], rawTextPoints[j]] = [rawTextPoints[j], rawTextPoints[i]];
        }
    }

    // 3. Calculate Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Use only as many points as we have particles
    const pointsToMeasure = rawTextPoints.slice(0, particleCount);
    
    if (pointsToMeasure.length > 0) {
        pointsToMeasure.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
    } else {
        minX = -1; maxX = 1; minY = -1; maxY = 1;
    }

    const textWidth = maxX - minX;
    const textHeight = maxY - minY;

    // 4. Calculate Dynamic Scale Factor
    const padding = 0.85; 
    const scaleX = (visibleWidth * padding) / textWidth;
    const scaleY = (visibleHeight * padding) / textHeight;
    
    const fitScale = Math.min(scaleX, scaleY);
    
    // [MODIFIED] Increased max scale cap to 0.35
    // Since text is now multi-line, it's not as wide, so we can afford to make it bigger!
    const finalScale = Math.min(fitScale, 0.35); 

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 5. Update Particles
    const geometry = particlesRef.current.geometry;
    const currentPositions = geometry.attributes.position.array as Float32Array;
    
    const spherePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        const r = 10; 
        spherePositions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
        spherePositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        spherePositions[i * 3 + 2] = r * Math.cos(phi);
    }

    const textPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        if (i < rawTextPoints.length) {
            const p = rawTextPoints[i];
            textPositions[i * 3] = (p.x - centerX) * finalScale;
            textPositions[i * 3 + 1] = (p.y - centerY) * finalScale;
            textPositions[i * 3 + 2] = 0;
        } else {
            const rndIndex = Math.floor(Math.random() * rawTextPoints.length);
            if (rawTextPoints.length > 0) {
                 const p = rawTextPoints[rndIndex];
                 textPositions[i * 3] = (p.x - centerX) * finalScale;
                 textPositions[i * 3 + 1] = (p.y - centerY) * finalScale;
                 textPositions[i * 3 + 2] = (Math.random() - 0.5) * 3; 
            } else {
                textPositions[i * 3] = 0;
                textPositions[i * 3+1] = 0;
                textPositions[i * 3+2] = 0;
            }
        }
    }

    if (timelineRef.current) timelineRef.current.kill();
    const tl = gsap.timeline();
    timelineRef.current = tl;
    
    const dummy = { val: 0 };
    const startPosCopy = Float32Array.from(currentPositions);

    tl.add(() => { isSphereRef.current = true; }); 
    tl.to(dummy, {
        val: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => {
            const t = dummy.val;
            for (let i = 0; i < particleCount * 3; i++) {
                currentPositions[i] = startPosCopy[i] + (spherePositions[i] - startPosCopy[i]) * t;
            }
            geometry.attributes.position.needsUpdate = true;
        }
    });

    tl.to({}, { duration: 0.1 });

    tl.add(() => { 
        isSphereRef.current = false; 
        if (particlesRef.current) {
            gsap.to(particlesRef.current.rotation, {
                x: 0, y: 0, z: 0, 
                duration: 0.8,
                ease: "power2.out"
            });
        }
    });

    tl.to(dummy, { 
        val: 0, 
        duration: 0.01, 
        onComplete: () => { dummy.val = 0; } 
    });
    
    tl.to(dummy, {
        val: 1,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
            const t = dummy.val;
            for (let i = 0; i < particleCount * 3; i++) {
                currentPositions[i] = spherePositions[i] + (textPositions[i] - spherePositions[i]) * t;
            }
            geometry.attributes.position.needsUpdate = true;
        }
    });

  }, [text]); 

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        width: '100%', 
        overflow: 'hidden',
        pointerEvents: 'none'
      }} 
    />
  );
};