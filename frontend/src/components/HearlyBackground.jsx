import { useEffect, useRef } from 'react';

const BLOBS = [
  {
    // Champagne / peach
    x: 0.22, y: 0.28, r: 340,
    color: [254, 215, 170], alpha: 0.45,
    speed: { x: 0.00015, y: 0.00010 },
    sine: { ax: 0.0003, ay: 0.0002, px: 0, py: 1.2 },
  },
  {
    // Warm amber / sunbeam
    x: 0.70, y: 0.50, r: 300,
    color: [245, 158, 11], alpha: 0.18,
    speed: { x: -0.00012, y: 0.00014 },
    sine: { ax: 0.0002, ay: 0.0003, px: 2.1, py: 0.7 },
  },
  {
    // Soft rose-clay
    x: 0.48, y: 0.78, r: 320,
    color: [251, 191, 186], alpha: 0.35,
    speed: { x: 0.00010, y: -0.00011 },
    sine: { ax: 0.00025, ay: 0.00018, px: 1.0, py: 2.5 },
  },
];

const DOT_SPACING  = 32;
const DOT_R_BASE   = 1.0;
const DOT_INFLUENCE = 200;
const LERP = 0.06;
const BASE_COLOR = '#FAF7F2';

export default function HearlyBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const mouse  = { tx: -800, ty: -800, x: -800, y: -800 };
    const blobs  = BLOBS.map((b) => ({ ...b, sine: { ...b.sine } }));

    let W = 0, H = 0, dpr = 1, rafId = null, t = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      W   = window.innerWidth;
      H   = window.innerHeight;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      t++;

      // ── Base fill ──
      ctx.fillStyle = BASE_COLOR;
      ctx.fillRect(0, 0, W, H);

      // ── Ambient blobs (sine drift) ──
      blobs.forEach((b) => {
        b.x = ((b.x + b.speed.x) % 1 + 1) % 1;
        b.y = ((b.y + b.speed.y) % 1 + 1) % 1;

        const cx = b.x * W + Math.sin(t * b.sine.ax + b.sine.px) * 60;
        const cy = b.y * H + Math.sin(t * b.sine.ay + b.sine.py) * 50;
        const [r, g, bl] = b.color;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
        grad.addColorStop(0,   `rgba(${r},${g},${bl},${b.alpha})`);
        grad.addColorStop(0.55,`rgba(${r},${g},${bl},${(b.alpha * 0.35).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${r},${g},${bl},0)`);

        ctx.beginPath();
        ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // ── Lerp mouse ──
      mouse.x += (mouse.tx - mouse.x) * LERP;
      mouse.y += (mouse.ty - mouse.y) * LERP;

      // ── Cursor warm aura ──
      const auraR = 320;
      const aura = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, auraR
      );
      aura.addColorStop(0,    'rgba(234, 179, 8, 0.16)');
      aura.addColorStop(0.45, 'rgba(234, 179, 8, 0.06)');
      aura.addColorStop(1,    'rgba(234, 179, 8, 0)');
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, auraR, 0, Math.PI * 2);
      ctx.fillStyle = aura;
      ctx.fill();

      // ── Organic dot matrix ──
      const cols = Math.ceil(W / DOT_SPACING) + 1;
      const rows = Math.ceil(H / DOT_SPACING) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const dx = col * DOT_SPACING;
          const dy = row * DOT_SPACING;
          const dist = Math.hypot(dx - mouse.x, dy - mouse.y);
          const inf  = Math.max(0, 1 - dist / DOT_INFLUENCE);

          const radius = DOT_R_BASE + inf * 2.2;

          // Base dot color #D6CEBE → warm amber near cursor
          const rC = Math.round(214 + inf * (245 - 214));
          const gC = Math.round(206 + inf * (158 - 206));
          const bC = Math.round(190 + inf * (11  - 190));
          const a  = (0.55 + inf * 0.45).toFixed(2);

          ctx.beginPath();
          ctx.arc(dx, dy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rC},${gC},${bC},${a})`;
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
