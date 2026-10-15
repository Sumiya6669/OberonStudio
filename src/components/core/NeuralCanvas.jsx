import React, { useRef, useEffect } from 'react';

export default function NeuralCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let W, H;
    let mouse = { x: 0, y: 0 };

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Nodes
    const N = 80;
    const nodes = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      gold: i < 6,
    }));

    // Цвета — по теме сайта, каждый кадр: тема переключается без перезагрузки.
    // На тёмном фоне точки светлые и «светятся» (screen), на светлом — тёмные
    // и ложатся поверх (multiply, класс neural-canvas в index.css).
    const root = document.documentElement;
    const PALETTE = {
      dark: { line: '80,130,255', gold: '200,170,80', node: 'rgba(100,150,255,0.6)', goldNode: 'rgba(200,170,80,0.7)', k: 1 },
      light: { line: '70,60,200', gold: '160,120,20', node: 'rgba(80,70,210,0.55)', goldNode: 'rgba(170,125,20,0.7)', k: 1.4 },
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const c = root.getAttribute('data-theme') === 'dark' ? PALETTE.dark : PALETTE.light;

      // Move
      nodes.forEach(n => {
        n.x += n.vx + (mouse.x - W / 2) * 0.00005;
        n.y += n.vy + (mouse.y - H / 2) * 0.00005;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        n.x = Math.max(0, Math.min(W, n.x));
        n.y = Math.max(0, Math.min(H, n.y));
      });

      // Connections
      const maxDist = 140;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            const alpha = (1 - d / maxDist) * 0.18 * c.k;
            const isGold = nodes[i].gold || nodes[j].gold;
            ctx.beginPath();
            ctx.strokeStyle = isGold
              ? `rgba(${c.gold},${alpha * 0.6})`
              : `rgba(${c.line},${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.gold ? c.goldNode : c.node;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="neural-canvas absolute inset-0 w-full h-full opacity-60"
    />
  );
}