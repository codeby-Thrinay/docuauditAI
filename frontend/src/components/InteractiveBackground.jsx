import { useEffect, useRef } from 'react';

const ORBS = [
  { x: 0.25, y: 0.30, r: 320, color: [99, 102, 241],  speed: { x: 0.00018, y: 0.00012 } }, // indigo
  { x: 0.72, y: 0.55, r: 280, color: [6,  182, 212],   speed: { x: -0.00014, y: 0.00016 } }, // cyan
  { x: 0.50, y: 0.80, r: 300, color: [139, 92, 246],  speed: { x: 0.00010, y: -0.00013 } }, // violet
];

const DOT_SPACING = 28;
const DOT_RADIUS_BASE = 1.2;
const DOT_INFLUENCE = 180;
const LERP = 0.08;

export default function InteractiveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Mouse state (raw target + lerped position)
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    // Orb animation state (normalised 0-1 offsets that drift over time)
    const orbs = ORBS.map((o) => ({ ...o }));

    let dpr = 1;
    let W = 0;
    let H = 0;
    let rafId = null;

    /* ── Resize ── */
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    /* ── Mouse ── */
    const onMouseMove = (e) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Draw loop ── */
    let t = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      t++;

      ctx.clearRect(0, 0, W, H);

      /* 1 — Ambient orbs */
      orbs.forEach((orb) => {
        // Drift normalised position over time
        orb.x = ((orb.x + orb.speed.x) % 1 + 1) % 1;
        orb.y = ((orb.y + orb.speed.y) % 1 + 1) % 1;

        const cx = orb.x * W;
        const cy = orb.y * H;
        const [r, g, b] = orb.color;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.r);
        grad.addColorStop(0,   `rgba(${r},${g},${b},0.18)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.07)`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.arc(cx, cy, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      /* 2 — Lerped cursor position */
      mouse.x += (mouse.tx - mouse.x) * LERP;
      mouse.y += (mouse.ty - mouse.y) * LERP;

      /* 3 — Cursor spotlight */
      const spotR = 260;
      const spot = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, spotR
      );
      spot.addColorStop(0,   'rgba(99, 102, 241, 0.13)');
      spot.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)');
      spot.addColorStop(1,   'rgba(99, 102, 241, 0)');

      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, spotR, 0, Math.PI * 2);
      ctx.fillStyle = spot;
      ctx.fill();

      /* 4 — Dot grid */
      const cols = Math.ceil(W / DOT_SPACING) + 1;
      const rows = Math.ceil(H / DOT_SPACING) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const dx = col * DOT_SPACING;
          const dy = row * DOT_SPACING;
          const dist = Math.hypot(dx - mouse.x, dy - mouse.y);
          const influence = Math.max(0, 1 - dist / DOT_INFLUENCE);

          const radius = DOT_RADIUS_BASE + influence * 1.8;
          const alpha  = 0.18 + influence * 0.55;

          // Base grey with indigo tint near cursor
          const rC = Math.round(148 + influence * (99  - 148));
          const gC = Math.round(163 + influence * (102 - 163));
          const bC = Math.round(184 + influence * (241 - 184));

          ctx.beginPath();
          ctx.arc(dx, dy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha.toFixed(2)})`;
          ctx.fill();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
