import React, { useEffect, useRef } from 'react';

/**
 * Свой робот — вместо заимствованной сцены Spline.
 *
 * Тот же принцип: белый глянцевый робот следит головой и глазами за курсором, парит,
 * его можно покрутить мышью. Отличия: тёмный овальный «визор» с фиолетовыми глазами,
 * которые моргают, антенна-огонёк, светящиеся кольца на «ушах» и груди, руки парят
 * отдельно и иногда машут. Платформы нет — под роботом только мягкое свечение.
 *
 * three грузится внутри эффекта (отдельный чанк, на сборке страниц не нужен);
 * сцена спит, когда её не видно, и при «уменьшить движение» стоит на месте.
 */
export default function TinkerRobot3D({ className = '', label = '' }) {
  const host = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (disposed || !host.current) return;
      const el = host.current;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      el.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', cursor: 'grab' });

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      // Свет: мягкий ключ сверху-справа, фиолетовый контровой сзади, холодная подсветка снизу
      scene.add(new THREE.AmbientLight(0x9988ff, 0.25));
      const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 6); scene.add(key);
      const rim = new THREE.PointLight(0x7c5cff, 45, 18); rim.position.set(-3.5, 2.5, -3); scene.add(rim);
      const rim2 = new THREE.PointLight(0x9d86ff, 22, 16); rim2.position.set(3.5, -1, -2.5); scene.add(rim2);
      const under = new THREE.PointLight(0x7c5cff, 10, 8); under.position.set(0, -3, 1.5); scene.add(under);

      const shell = new THREE.MeshPhysicalMaterial({
        color: 0xf2f0f8, metalness: 0, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06,
        sheen: 0.5, sheenColor: new THREE.Color(0xc9b9ff), envMapIntensity: 0.95,
      });
      const visor = new THREE.MeshPhysicalMaterial({
        color: 0x06050b, metalness: 0.4, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
      });
      const joint = new THREE.MeshStandardMaterial({ color: 0x1b1826, metalness: 0.6, roughness: 0.35 });
      const glow = new THREE.MeshBasicMaterial({ color: 0xb3a1ff, toneMapped: false });
      const glowSoft = new THREE.MeshBasicMaterial({ color: 0x8a6dff, toneMapped: false });

      const robot = new THREE.Group();
      scene.add(robot);

      // Корпус — «яйцо», шире к плечам: профиль, повёрнутый вокруг оси
      const H = 1.9;
      const bodyR = (k) => Math.sin(Math.PI * k) ** 0.85 * (0.66 + 0.16 * k);
      const profile = [];
      for (let i = 0; i <= 48; i += 1) {
        const k = i / 48;
        profile.push(new THREE.Vector2(Math.max(bodyR(k), 0.0001), -Math.cos(Math.PI * k) * H / 2));
      }
      const body = new THREE.Group();
      const bodyMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), shell);
      bodyMesh.scale.z = 0.86;
      body.add(bodyMesh);
      body.position.y = -0.98;
      robot.add(body);

      // Огонёк на груди: кольцо и точка
      const chestK = 0.64;
      const chestY = -Math.cos(Math.PI * chestK) * H / 2;
      const chestZ = bodyR(chestK) * 0.86;
      const chest = new THREE.Group();
      chest.position.set(0, chestY, chestZ - 0.02);
      chest.rotation.x = -0.32;
      const chestRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 16, 48), glow);
      const chestDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), glow);
      const chestPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 48), visor);
      chestPlate.rotation.x = Math.PI / 2;
      chestRing.position.z = 0.025; chestDot.position.z = 0.03;
      chest.add(chestPlate, chestRing, chestDot);
      body.add(chest);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.28, 32), joint);
      neck.position.y = 0.02;
      robot.add(neck);

      // Голова: сплюснутая сфера, тёмный овальный визор, глаза
      const head = new THREE.Group();
      head.position.y = 0.98;
      robot.add(head);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), shell);
      skull.scale.set(1.1, 0.9, 0.96);
      head.add(skull);
      const face = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), visor);
      face.scale.set(0.84, 0.56, 0.5);
      face.position.set(0, -0.06, 0.5);
      head.add(face);

      const eyes = new THREE.Group();
      eyes.position.set(0, -0.04, 0.985);
      head.add(eyes);
      const eyeGeo = new THREE.CapsuleGeometry(0.09, 0.13, 8, 24);
      const eyeL = new THREE.Mesh(eyeGeo, glow); eyeL.position.x = -0.29; eyeL.rotation.y = -0.28; eyeL.scale.z = 0.35;
      const eyeR = new THREE.Mesh(eyeGeo, glow); eyeR.position.x = 0.29; eyeR.rotation.y = 0.28; eyeR.scale.z = 0.35;
      eyes.add(eyeL, eyeR);

      const ear = (side) => {
        const g = new THREE.Group();
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.18, 48), joint);
        cap.rotation.z = Math.PI / 2;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 16, 48), glowSoft);
        ring.rotation.y = Math.PI / 2; ring.position.x = side * 0.095;
        g.add(cap, ring);
        g.position.set(side * 1.08, 0, 0);
        return g;
      };
      head.add(ear(-1), ear(1));

      const antenna = new THREE.Group();
      antenna.position.set(0.18, 0.86, -0.05);
      antenna.rotation.z = -0.22;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 16), joint);
      stalk.position.y = 0.21;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), glow);
      bulb.position.y = 0.46;
      antenna.add(stalk, bulb);
      head.add(antenna);

      // Руки парят отдельно от корпуса; шарнир — у плеча
      const arm = (side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.93, -0.4, 0);
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 24), joint);
        const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.52, 10, 32), shell);
        limb.position.y = -0.36;
        pivot.add(shoulder, limb);
        pivot.rotation.z = side * 0.2;
        robot.add(pivot);
        return pivot;
      };
      const armL = arm(-1); const armR = arm(1);

      // Свечение снизу и позади вместо платформы
      const blob = document.createElement('canvas'); blob.width = blob.height = 128;
      const bc = blob.getContext('2d'); const bg = bc.createRadialGradient(64, 64, 0, 64, 64, 64);
      bg.addColorStop(0, 'rgba(124,92,255,0.85)'); bg.addColorStop(0.4, 'rgba(110,80,240,0.3)'); bg.addColorStop(1, 'rgba(124,92,255,0)');
      bc.fillStyle = bg; bc.fillRect(0, 0, 128, 128);
      const blobTex = new THREE.CanvasTexture(blob);
      const haloMat = new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32 });
      const halo = new THREE.Sprite(haloMat); halo.scale.set(2.2, 0.5, 1); halo.position.set(0, -2.4, 0.3);
      const backMat = new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18 });
      const back = new THREE.Sprite(backMat); back.scale.set(7, 7, 1); back.position.set(0, 0.2, -3);
      scene.add(halo, back);

      // Размер, курсор, перетаскивание
      const resize = () => {
        const w = el.clientWidth || 1; const h = el.clientHeight || 1;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        camera.position.set(0, 0.1, w / h < 0.9 ? 15 : 11.5);
        camera.lookAt(0, 0.1, 0);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(el);

      const mouse = { x: 0, y: 0, at: -10 };
      const spin = { y: 0, v: 0, drag: false, lastX: 0 };
      const clock = new THREE.Clock();
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2; const cy = r.top + r.height * 0.4;
        mouse.x = Math.max(-1.5, Math.min(1.5, (e.clientX - cx) / (r.width / 2)));
        mouse.y = Math.max(-1.5, Math.min(1.5, (e.clientY - cy) / (r.height / 2)));
        mouse.at = clock.getElapsedTime();
        if (spin.drag) { spin.v = (e.clientX - spin.lastX) * 0.012; spin.y += spin.v; spin.lastX = e.clientX; }
        if (reduce && !raf) raf = requestAnimationFrame(frame);
      };
      const onDown = (e) => { spin.drag = true; spin.lastX = e.clientX; renderer.domElement.style.cursor = 'grabbing'; };
      const onUp = () => { spin.drag = false; renderer.domElement.style.cursor = 'grab'; };
      window.addEventListener('pointermove', onMove, { passive: true });
      renderer.domElement.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);

      let visible = true; let raf = 0;
      const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
      io.observe(el);

      let nextBlink = 2; let nextWave = 6;
      const ease = (a, b, k) => a + (b - a) * k;

      function frame() {
        raf = 0;
        if (!visible) return;
        const t = clock.getElapsedTime();
        const live = reduce ? 0 : 1;

        // Курсор давно не двигался — робот сам оглядывается
        const idle = t - mouse.at > 4;
        const lookX = idle ? Math.sin(t * 0.45) * 0.5 * live : mouse.x;
        const lookY = idle ? Math.sin(t * 0.3 + 1) * 0.2 * live : mouse.y;

        if (!spin.drag) { spin.v *= 0.92; spin.y = spin.y * 0.97 + spin.v; }
        robot.rotation.y = ease(robot.rotation.y, spin.y + lookX * 0.22, 0.08);
        robot.position.y = Math.sin(t * 1.1) * 0.1 * live;
        head.rotation.y = ease(head.rotation.y, lookX * 0.55, 0.1);
        head.rotation.x = ease(head.rotation.x, lookY * 0.32, 0.1);
        head.rotation.z = ease(head.rotation.z, -lookX * 0.06, 0.06);
        eyes.position.x = ease(eyes.position.x, lookX * 0.06, 0.15);
        eyes.position.y = ease(eyes.position.y, -0.04 - lookY * 0.04, 0.15);

        // Моргание
        let lid = 1;
        if (live && t > nextBlink) {
          const p = (t - nextBlink) / 0.16;
          if (p >= 1) nextBlink = t + 2.5 + Math.random() * 3.5;
          else lid = 1 - Math.sin(p * Math.PI) * 0.9;
        }
        eyeL.scale.y = lid; eyeR.scale.y = lid;

        // Руки покачиваются; правая иногда машет
        armL.rotation.z = -0.2 - Math.sin(t * 1.3) * 0.05 * live;
        armL.rotation.x = Math.sin(t * 1.1) * 0.08 * live;
        let wave = 0;
        if (live && t > nextWave) {
          const p = (t - nextWave) / 2.2;
          if (p >= 1) nextWave = t + 8 + Math.random() * 6;
          else wave = Math.sin(p * Math.PI);
        }
        armR.rotation.z = 0.2 + Math.sin(t * 1.3 + 1) * 0.05 * live + wave * (2.3 + Math.sin(t * 11) * 0.25);
        armR.rotation.x = Math.sin(t * 1.1 + 1) * 0.08 * live;

        const pulse = (Math.sin(t * 2.2) + 1) / 2;
        bulb.scale.setScalar(1 + pulse * 0.25 * live);
        chestDot.scale.setScalar(0.8 + pulse * 0.4 * live);
        rim.intensity = 40 + pulse * 10 * live;
        halo.scale.set(2.2 - robot.position.y * 1.2, 0.5, 1);

        renderer.render(scene, camera);
        if (!reduce || spin.drag || Math.abs(spin.v) > 0.0005) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        [shell, visor, joint, glow, glowSoft, haloMat, backMat, blobTex].forEach((m) => m.dispose());
        envTex.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => { /* нет WebGL — остаётся свечение-подложка */ });
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div ref={host} className={className} role="img" aria-label={label} />;
}
