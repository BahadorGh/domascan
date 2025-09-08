import React, { useEffect, useRef, useState } from 'react';

// Lightweight animated starfield / nebula style background using canvas.
// - Renders a set of star particles with parallax drift.
// - Adds a subtle radial gradient + noise overlay for depth.
// - Keeps work per frame minimal (< ~1k particles) for perf.
// - Respects prefers-reduced-motion (disables animation if requested).

interface Star {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  z: number; // depth 0..1 (smaller is farther)
  vx: number;
  vy: number;
  size: number;
  twinkle: number; // base twinkle phase
}

const MAX_STARS = 1400; // increased density

export const StarfieldBackground: React.FC<{ className?: string }>=({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const lastTsRef = useRef<number>(0);
  const reduceMotion = useRef<boolean>(false);
  const lowPower = useRef<boolean>(false);
  // Nebula removed per request (placeholders retained for minimal diff avoidance)
  const [fallbackCss, setFallbackCss] = useState(false);

  // Detect low power & reduced motion for fallback
  useEffect(()=>{
    try {
      const hwc = (navigator as any).hardwareConcurrency;
      const mem = (navigator as any).deviceMemory;
      if ((hwc && hwc <= 4) || (mem && mem <= 4)) lowPower.current = true;
    } catch {}
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion.current = media.matches;
    if (reduceMotion.current || lowPower.current) setFallbackCss(true);
  }, []);

  // Initialize stars + nebula (skip if fallback)
  useEffect(()=>{
    if (fallbackCss) return;
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext('2d'); if(!ctx) return;

    function resize(){
      if(!canvas) return; const c = canvas; const context = ctx; if(!context) return;
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth; const h = window.innerHeight;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      c.width = w * dpr; c.height = h * dpr;
      context.setTransform(1,0,0,1,0,0);
      context.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

  // create stars (denser, smaller divisor)
  const count = Math.min(MAX_STARS, Math.floor((canvas.clientWidth * canvas.clientHeight)/ 2500));
  starsRef.current = new Array(count).fill(0).map(()=> makeStar());

  // Nebula removed: no offscreen initialization

    let stop = false;
    function loop(ts: number){
      if(stop) return;
    const dt = (ts - lastTsRef.current) / 1000 || 0.016;
    lastTsRef.current = ts;
    if (ctx && canvas) draw(ctx, canvas, dt);
      if(!reduceMotion.current) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return ()=>{ stop = true; window.removeEventListener('resize', resize); };
  }, [fallbackCss]);

  function makeStar(): Star {
    const depth = Math.random();
  const speed = 0.01 + Math.random()*0.025; // faster base speed
    return {
      x: Math.random(),
      y: Math.random(),
      z: depth,
      vx: (Math.random()-0.5) * speed,
      vy: (Math.random()-0.5) * speed,
      size: 0.5 + (1-depth) * 1.8 + Math.random()*0.6,
      twinkle: Math.random()*Math.PI*2,
    };
  }

  function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dt: number){
    const w = canvas.width / (window.devicePixelRatio||1);
    const h = canvas.height / (window.devicePixelRatio||1);
    ctx.clearRect(0,0,w,h);

    // Background gradient (subtle space feel)
    const g = ctx.createRadialGradient(w*0.5, h*0.6, 0, w*0.5, h*0.6, Math.max(w,h)*0.9);
    g.addColorStop(0, '#0e1525');
    g.addColorStop(1, '#050810');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    const stars = starsRef.current;
    for (let s of stars){
      // update
      if(!reduceMotion.current){
        s.x += s.vx * dt * (0.3 + (1-s.z)*2);
        s.y += s.vy * dt * (0.3 + (1-s.z)*2);
        // wrap
        if (s.x < 0) s.x += 1; else if (s.x > 1) s.x -= 1;
        if (s.y < 0) s.y += 1; else if (s.y > 1) s.y -= 1;
      }
      const px = s.x * w;
      const py = s.y * h;
      const baseAlpha = 0.15 + (1-s.z)*0.85;
      const tw = 0.5 + 0.5*Math.sin(performance.now()/1000 + s.twinkle);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${(baseAlpha*tw).toFixed(3)})`;
      ctx.arc(px, py, s.size * (0.3 + (1-s.z)*0.7), 0, Math.PI*2);
      ctx.fill();
    }

    // Reduced noise (crisper)
    const imgData = ctx.getImageData(0,0,Math.min(120,w), Math.min(60,h));
    const data = imgData.data;
    for(let i=0;i<data.length;i+=4){
      const n = (Math.random()-0.5)*4; // subtle
      data[i] += n; data[i+1]+=n; data[i+2]+=n;
    }
    ctx.putImageData(imgData,0,0);
  }
  if (fallbackCss){
    return (
      <div className={"pointer-events-none fixed inset-0 -z-10 transition-opacity " + (className||'')} aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e1525] via-[#0a1120] to-[#050810]" />
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, rgba(80,120,255,0.15), transparent 60%), radial-gradient(circle at 70% 65%, rgba(150,60,220,0.18), transparent 55%), radial-gradient(circle at 40% 80%, rgba(20,160,200,0.15), transparent 55%)`
        }} />
        <div className="absolute inset-0 animate-pulse opacity-20" style={{
          backgroundImage: 'radial-gradient(2px 2px at 10% 20%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.45), transparent), radial-gradient(2px 2px at 80% 50%, rgba(255,255,255,0.35), transparent)',
          backgroundRepeat: 'repeat',
          backgroundSize: '600px 600px'
        }} />
      </div>
    );
  }

  return <canvas ref={canvasRef} className={"pointer-events-none fixed inset-0 -z-10 transition-opacity " + (className||'')} />
};
