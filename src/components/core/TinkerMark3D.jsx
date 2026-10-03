import React, { useEffect, useRef } from 'react';

/**
 * Знак Tinker в 3D — вместо заимствованного робота со Spline.
 *
 * Те же тиски, что в логотипе (components/brand/Mark.jsx): две фиолетовые губки и
 * буква «Т» между ними. Губки «дышат» — поджимают заготовку, как анимация
 * знака на сайте; знак парит, следит за курсором, вращается мышью. Платформы
 * нет: фон прозрачный, под сценой только свечение страницы.
 *
 * three грузится внутри эффекта (отдельный чанк, на сборке страниц не нужен);
 * сцена спит, когда её не видно, и при «уменьшить движение» стоит на месте.
 */
export default function TinkerMark3D({ className = '' }) {
  const host = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
      if (disposed || !host.current) return;
      const el = host.current;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', cursor: 'grab' });

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0, 10.5);

      // Свет: холодный ключ, фиолетовый контровой и снизу — тёплое отражение
      scene.add(new THREE.AmbientLight(0x8877ff, 0.35));
      const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 6); scene.add(key);
      const rim = new THREE.PointLight(0x7c5cff, 40, 20); rim.position.set(-4, 2, -3); scene.add(rim);
      const fill = new THREE.PointLight(0xb49bff, 18, 16); fill.position.set(4, -3, 3); scene.add(fill);

      const violet = new THREE.MeshPhysicalMaterial({
        color: 0x7c5cff, metalness: 0.35, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08,
        emissive: 0x2a1580, emissiveIntensity: 0.35, envMapIntensity: 1.3,
      });
      const pearl = new THREE.MeshPhysicalMaterial({
        color: 0xf4f1ff, metalness: 0.05, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
        sheen: 1, sheenColor: new THREE.Color(0xc9b9ff), envMapIntensity: 1.1,
      });

      // Координаты из SVG знака (200×200, центр 100,100) → единицы сцены: 1 ед. = 40 px
      const U = (v) => v / 40;
      const mark = new THREE.Group();
      const jaw = (side) => {
        const g = new THREE.Group();
        const t = U(16); const depth = U(22);
        const bar = new THREE.Mesh(new RoundedBoxGeometry(t, U(120) + t, depth, 4, t * 0.45), violet);
        const top = new THREE.Mesh(new RoundedBoxGeometry(U(18) + t, t, depth, 4, t * 0.45), violet);
        const bottom = top.clone();
        top.position.set(-side * U(9), U(60), 0);
        bottom.position.set(-side * U(9), -U(60), 0);
        g.add(bar, top, bottom);
        g.position.x = side * U(74);
        return g;
      };
      const left = jaw(-1); const right = jaw(1);
      mark.add(left, right);

      // Буква «Т» — тот же контур, что в Mark.jsx, со скруглёнными концами
      const tee = new THREE.Shape();
      const p = (x, y) => [U(x - 100), U(100 - y)];
      tee.moveTo(...p(48, 47)); tee.lineTo(...p(152, 47));
      tee.absarc(...p(152, 58), U(11), Math.PI / 2, -Math.PI / 2, true);
      tee.lineTo(...p(111, 69)); tee.lineTo(...p(111, 150));
      tee.absarc(...p(100, 150), U(11), 0, -Math.PI, true);
      tee.lineTo(...p(89, 69)); tee.lineTo(...p(48, 69));
      tee.absarc(...p(48, 58), U(11), -Math.PI / 2, Math.PI / 2, true);
      const teeGeo = new THREE.ExtrudeGeometry(tee, { depth: U(18), bevelEnabled: true, bevelThickness: U(4), bevelSize: U(3), bevelSegments: 6, curveSegments: 24 });
      teeGeo.center();
      const teeMesh = new THREE.Mesh(teeGeo, pearl);
      teeMesh.position.y = -U(4);
      mark.add(teeMesh);
      mark.scale.setScalar(0.92);
      scene.add(mark);

      // Искры вокруг — мягкие точки на орбитах
      const N = 140; const pos = new Float32Array(N * 3); const seeds = [];
      for (let i = 0; i < N; i += 1) {
        seeds.push({ r: 3.2 + Math.random() * 2.4, a: Math.random() * Math.PI * 2, y: (Math.random() - 0.5) * 4.2, s: 0.08 + Math.random() * 0.25 });
      }
      const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dot = document.createElement('canvas'); dot.width = dot.height = 64;
      const dc = dot.getContext('2d'); const gr = dc.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(190,170,255,.8)'); gr.addColorStop(1, 'rgba(124,92,255,0)');
      dc.fillStyle = gr; dc.fillRect(0, 0, 64, 64);
      const sparkMat = new THREE.PointsMaterial({ size: 0.13, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xc9b9ff });
      const sparks = new THREE.Points(sparkGeo, sparkMat);
      scene.add(sparks);

      // Размер, мышь, перетаскивание
      const resize = () => {
        const w = el.clientWidth || 1; const h = el.clientHeight || 1;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        camera.position.z = w / h < 0.9 ? 13.5 : 10.5;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(el);
      const mouse = { x: 0, y: 0 }; const spin = { y: 0, v: 0, drag: false, lastX: 0 };
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (spin.drag) { spin.v = (e.clientX - spin.lastX) * 0.01; spin.y += spin.v; spin.lastX = e.clientX; }
      };
      const onDown = (e) => { spin.drag = true; spin.lastX = e.clientX; renderer.domElement.style.cursor = 'grabbing'; };
      const onUp = () => { spin.drag = false; renderer.domElement.style.cursor = 'grab'; };
      window.addEventListener('pointermove', onMove, { passive: true });
      renderer.domElement.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);

      let visible = true; let raf = 0; const clock = new THREE.Clock();
      const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
      io.observe(el);

      function frame() {
        raf = 0;
        if (!visible) return;
        const t = reduce ? 0 : clock.getElapsedTime();
        if (!spin.drag) { spin.v *= 0.94; spin.y += spin.v; }
        const auto = reduce ? 0 : t * 0.25;
        mark.rotation.y += ((spin.y + auto + mouse.x * 0.35) - mark.rotation.y) * 0.08;
        mark.rotation.x += ((mouse.y * 0.22 + Math.sin(t * 0.6) * 0.05) - mark.rotation.x) * 0.08;
        mark.position.y = Math.sin(t * 0.9) * 0.12;
        const squeeze = (Math.sin(t * 1.4) + 1) / 2;           // губки поджимают «Т»
        left.position.x = -U(74) + squeeze * U(6);
        right.position.x = U(74) - squeeze * U(6);
        teeMesh.rotation.z = Math.sin(t * 1.4) * 0.015;
        for (let i = 0; i < N; i += 1) {
          const s = seeds[i]; const a = s.a + t * s.s;
          pos[i * 3] = Math.cos(a) * s.r; pos[i * 3 + 1] = s.y + Math.sin(t * s.s * 2 + i) * 0.15; pos[i * 3 + 2] = Math.sin(a) * s.r - 1;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        rim.intensity = 36 + Math.sin(t * 1.4) * 8;
        renderer.render(scene, camera);
        if (!reduce || spin.drag || Math.abs(spin.v) > 0.0005) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      if (reduce) renderer.domElement.addEventListener('pointermove', () => { if (!raf) raf = requestAnimationFrame(frame); });

      cleanup = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        [violet, pearl, sparkMat, sparkMat.map].forEach((m) => m.dispose());
        envTex.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => { /* нет WebGL — остаётся свечение-подложка */ });
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div ref={host} className={className} aria-label="Знак Tinker в 3D — тиски и буква Т" role="img" />;
}
