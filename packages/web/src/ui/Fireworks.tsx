import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  alpha: number;
  size: number;
}

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#f06595', '#20c997'];
const GRAVITY = 0.12;

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

function burst(x: number, y: number): Particle[] {
  const count = 28 + Math.floor(Math.random() * 20);
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      color: randomColor(),
      alpha: 1,
      size: 3 + Math.random() * 3,
    };
  });
}

/** Full-screen canvas fireworks — rendered as a fixed overlay so it doesn't affect layout. */
export function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let rafId: number;
    let running = true;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Launch bursts at randomised times and positions.
    const launchTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 8; i++) {
      const delay = i * (300 + Math.random() * 400);
      launchTimers.push(
        setTimeout(() => {
          if (!running || !canvas) return;
          const x = canvas.width * (0.15 + Math.random() * 0.7);
          const y = canvas.height * (0.15 + Math.random() * 0.45);
          particles.push(...burst(x, y));
        }, delay),
      );
    }

    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter((p) => p.alpha > 0.02);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY;
        p.alpha -= 0.012;

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      launchTimers.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
