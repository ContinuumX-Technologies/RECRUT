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
  
  const isSphereRef = useRef<boolean>(true);
  
  // Configuration
  const particleCount = 15000;
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
        const r = 10; // Sphere radius stays 10
        
        positions[i * 3] = r * Math.cos(theta) * Math.sin(phi) + (Math.random() - 0.5);
        positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi) + (Math.random() - 0.5);
        positions[i * 3 + 2] = r * Math.cos(phi) + (Math.random() - 0.5);

        const color = new THREE.Color();
        color.setHSL(0, 0, 0.1 + Math.random() * 0.2);
        
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
      opacity: 0.8,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // --- 3. ANIMATION LOOP ---
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (particlesRef.current && isSphereRef.current) {
        particlesRef.current.rotation.y += 0.002;
      }
      renderer.render(scene, camera);
    };
    animate();

    // --- 4. RESIZE HANDLER ---
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && container) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
    };
  }, []);

  // --- MORPHING LOGIC ---
  useEffect(() => {
    if (!particlesRef.current || !text) return;

    // A. Helper: Generate Points from Text
    const getTargetPoints = (str: string) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        const maxLineWidth = 1200; 
        const lineHeight = baseFontSize * 1.2;
        
        ctx.font = `900 ${baseFontSize}px "Inter", sans-serif`;
        
        const words = str.split(' ');
        let line = '';
        const lines = [];
        
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
        canvas.height = (lines.length * lineHeight) + 200;

        ctx.fillStyle = 'white';
        ctx.font = `900 ${baseFontSize}px "Inter", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const startY = (canvas.height - (lines.length * lineHeight)) / 2 + (lineHeight/2);
        
        lines.forEach((l, i) => {
            ctx.fillText(l, canvas.width / 2, startY + (i * lineHeight));
        });

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const points = [];
        const step = 4;

        for (let i = 0; i < pixels.length; i += 4 * step) {
            if (pixels[i] > 128) {
                const posX = (i / 4) % canvas.width;
                const posY = Math.floor((i / 4) / canvas.width);
                points.push({
                    // --- CHANGED SCALING HERE ---
                    // Changed from 25 to 14. 
                    // Lower number = Larger Text in 3D world.
                    x: (posX - canvas.width / 2) / 10,
                    y: -(posY - canvas.height / 2) / 10
                });
            }
        }

        // Force Centering
        if (points.length > 0) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          points.forEach(p => {
            p.x -= centerX;
            p.y -= centerY;
          });
        }

        return points;
    };

    // B. ANIMATION SEQUENCE
    const geometry = particlesRef.current.geometry;
    const currentPositions = geometry.attributes.position.array as Float32Array;
    
    // 1. Calculate Sphere Targets
    const spherePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        const r = 10; // Sphere radius maintained at 10
        spherePositions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
        spherePositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        spherePositions[i * 3 + 2] = r * Math.cos(phi);
    }

    // 2. Calculate Text Targets
    const textPoints = getTargetPoints(text);
    const textPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        if (i < textPoints.length) {
            textPositions[i * 3] = textPoints[i].x;
            textPositions[i * 3 + 1] = textPoints[i].y;
            textPositions[i * 3 + 2] = 0; 
        } else {
            const rndIndex = Math.floor(Math.random() * textPoints.length);
            if (textPoints.length > 0) {
                 textPositions[i * 3] = textPoints[rndIndex].x;
                 textPositions[i * 3 + 1] = textPoints[rndIndex].y;
                 textPositions[i * 3 + 2] = (Math.random() - 0.5) * 5; 
            } else {
                textPositions[i * 3] = 0;
                textPositions[i * 3+1] = 0;
                textPositions[i * 3+2] = 0;
            }
        }
    }

    // C. Execute Timeline
    const tl = gsap.timeline();
    const dummy = { val: 0 };
    const startPosCopy = Float32Array.from(currentPositions);

    // Step 1: Start spinning and Morph to Sphere
    tl.add(() => { isSphereRef.current = true; }); 
    
    tl.to(dummy, {
        val: 1,
        duration: 0.8,
        ease: "power2.inOut",
        onUpdate: () => {
            const t = dummy.val;
            for (let i = 0; i < particleCount * 3; i++) {
                currentPositions[i] = startPosCopy[i] + (spherePositions[i] - startPosCopy[i]) * t;
            }
            geometry.attributes.position.needsUpdate = true;
        }
    });

    // Step 2: Brief pause (spinning sphere)
    tl.to({}, { duration: 0.2 });

    // Step 3: Stop Rotation, Align to Center, Morph to Text
    tl.add(() => { 
        isSphereRef.current = false; 
        
        // Reset rotation to exactly 0,0,0
        gsap.to(particlesRef.current!.rotation, {
            x: 0, 
            y: 0, 
            z: 0, 
            duration: 0.8,
            ease: "power2.out"
        });
    });

    tl.to(dummy, { 
        val: 0, 
        duration: 0.01, 
        onComplete: () => { dummy.val = 0; } 
    });
    
    tl.to(dummy, {
        val: 1,
        duration: 1.5,
        ease: "elastic.out(1, 0.5)",
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