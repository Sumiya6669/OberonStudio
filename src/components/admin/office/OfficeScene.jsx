/* eslint-disable react/no-unknown-property -- position, args, intensity и др. — свойства three.js
   в JSX @react-three/fiber, а не атрибуты DOM. */
/**
 * 3D-офис агентов: пол, зоны отделов с табличками, столы, за столами — фирменные роботы Tinker.
 *
 * Грузится только на экране «ИИ → 3D-офис» (React.lazy в OfficeView): three, @react-three/fiber
 * и drei попадают в отдельные чанки, публичный сайт их не качает.
 *
 * Робот — тот же, что на главной (src/components/core/TinkerRobot3D.jsx; в роликах — его копия
 * ИИ-маркетолог/video/robot/robot.js): белый глянцевый корпус-«яйцо», тёмный овальный визор,
 * фиолетовые глаза-капсулы, «уши», антенна-огонёк, парящие руки. Здесь он собран из тех же
 * примитивов с меньшим числом граней, а все роботы и столы рисуются через instancing (drei Merged):
 * на ~40 столов — около двадцати вызовов отрисовки вместо шестисот.
 *
 * Состояние агента видно издалека: цвет кольца на полу, голографический экран над столом и огонёк
 * антенны. Работает — печатает, экран мерцает; ждёт — спокойно парит и оглядывается; ошибка —
 * красные глаза, голова набок, «!» над столом; очередь — стопка папок и число; нет активности
 * или «готов, ждёт сервера» — дремлет; «скоро» — пустой стол с табличкой.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Merged, OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STATE_META, backlogOf, deptSummary } from '@/lib/admin/agentsOffice';

/* ── Раскладка ──────────────────────────────────────────────────────────── */

const CELL_X = 2.4;   // шаг столов по ширине
const CELL_Z = 2.7;   // шаг столов по глубине
const PAD = 0.7;      // поле зоны вокруг столов
const HEAD = 0.75;    // полоса под подпись отдела у передней (ближней к камере) границы зоны
const GAP = 1.4;      // проход между зонами

function shelve(zones, maxRowW) {
  const shelves = [];
  let cur = null;
  for (const z of zones) {
    if (!cur || cur.w + GAP + z.w > maxRowW) {
      cur = { zones: [], w: -GAP, d: 0 };
      shelves.push(cur);
    }
    cur.zones.push(z);
    cur.w += GAP + z.w;
    cur.d = Math.max(cur.d, z.d);
  }
  const width = Math.max(...shelves.map((sh) => sh.w));
  const depth = shelves.reduce((sum, sh) => sum + sh.d, 0) + GAP * (shelves.length - 1);
  return { shelves, width, depth };
}

/**
 * Отделы → зоны на полу и места столов. Центр офиса — в начале координат.
 * Зоны встают рядами («полками»); ширина ряда подбирается так, чтобы офис по пропорциям лёг
 * в окно (aspect — ширина/высота холста): на широком экране — шире, на телефоне — выше.
 */
export function layoutOffice(departments, aspect = 1.8) {
  const zones = departments.map((dept) => {
    const n = dept.agents.length;
    const cols = n > 6 ? Math.min(6, Math.ceil(n / 2)) : Math.min(n, 3);
    const rows = Math.ceil(n / cols);
    return { dept, cols, rows, w: cols * CELL_X + PAD * 2, d: rows * CELL_Z + PAD * 2 + HEAD };
  });

  // Камера смотрит сверху под углом: глубина на экране сжимается, поэтому офис можно делать
  // чуть «глубже» холста.
  const want = Math.min(Math.max(aspect * 0.85, 0.45), 2.6);
  const minW = Math.max(...zones.map((z) => z.w));
  let best = null;
  for (let maxW = minW; maxW <= minW * 8; maxW += 1) {
    const cand = shelve(zones, maxW);
    const score = Math.abs(Math.log(cand.width / cand.depth / want));
    if (!best || score < best.score - 1e-6) best = { ...cand, score };
  }
  const { shelves, width: totalW, depth: totalD } = best;

  const desks = [];
  let zTop = -totalD / 2;
  for (const sh of shelves) {
    let x = -sh.w / 2;
    for (const z of sh.zones) {
      z.x0 = x; z.z0 = zTop;
      z.cx = x + z.w / 2; z.cz = zTop + z.d / 2;
      z.dept.agents.forEach((agent, i) => {
        const col = i % z.cols;
        const row = Math.floor(i / z.cols);
        desks.push({
          agent,
          dept: z.dept,
          pos: [x + PAD + CELL_X * (col + 0.5), 0, zTop + PAD + CELL_Z * (row + 0.5)],
        });
      });
      x += z.w + GAP;
    }
    zTop += sh.d + GAP;
  }
  return { zones, desks, width: totalW, depth: totalD };
}

/* ── Детали: геометрия и материалы, общие для всех экземпляров ───────────── */

const S = 0.36;          // масштаб робота (единицы TinkerRobot3D → метры офиса)
const ROBOT_Y = 0.86;    // высота «центра» робота над полом: парит за столом
const ROBOT_Z = -0.62;   // робот за столом, лицом к камере (+z)
const FACE = { sx: 0.84, sy: 0.56, sz: 0.5, y: -0.06, z: 0.5 };

/** Положение глаза на визоре (как onFace у робота сайта), в координатах головы. */
function eyePose(x, y, lift = 0.012) {
  const nx = x / FACE.sx;
  const ny = (y - FACE.y) / FACE.sy;
  const k = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
  const nrm = new THREE.Vector3(nx / FACE.sx, ny / FACE.sy, k / FACE.sz).normalize();
  const pos = new THREE.Vector3(x, y, FACE.z + FACE.sz * k).addScaledVector(nrm, lift);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
  return { position: pos.toArray(), quaternion: q.toArray() };
}
const EYE_L = eyePose(-0.29, -0.04);
const EYE_R = eyePose(0.29, -0.04);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeParts(lowPower) {
  const seg = lowPower ? 0.6 : 1;
  const r = (n) => Math.max(8, Math.round(n * seg));

  // Корпус — «яйцо», шире к плечам: тот же профиль, что у робота сайта.
  const H = 1.9;
  const bodyR = (k) => Math.sin(Math.PI * k) ** 0.85 * (0.66 + 0.16 * k);
  const profile = [];
  for (let i = 0; i <= 20; i += 1) {
    const k = i / 20;
    profile.push(new THREE.Vector2(Math.max(bodyR(k), 0.0001), -Math.cos(Math.PI * k) * H / 2));
  }
  const body = new THREE.LatheGeometry(profile, r(32)).scale(1, 1, 0.86).translate(0, -0.98, 0);
  const skull = new THREE.SphereGeometry(1, r(32), r(20)).scale(1.1, 0.9, 0.96);
  const visor = new THREE.SphereGeometry(1, r(32), r(20)).scale(FACE.sx, FACE.sy, FACE.sz).translate(0, FACE.y, FACE.z);
  const eye = new THREE.CapsuleGeometry(0.09, 0.13, 4, r(12));
  const ear = new THREE.CylinderGeometry(0.21, 0.24, 0.18, r(20)).rotateZ(Math.PI / 2);
  const stalk = new THREE.CylinderGeometry(0.022, 0.03, 0.42, 8).translate(0, 0.21, 0);
  const bulb = new THREE.SphereGeometry(0.1, r(16), r(12));
  const arm = new THREE.CapsuleGeometry(0.15, 0.52, 4, r(16)).translate(0, -0.36, 0);
  const chest = new THREE.SphereGeometry(0.07, 12, 8);

  // Стол: столешница и две боковины одним куском, клавиатура, проектор голографического экрана.
  const deskTop = new THREE.BoxGeometry(1.7, 0.07, 0.9);
  const legL = new THREE.BoxGeometry(0.06, 0.7, 0.8).translate(-0.78, 0.35, 0);
  const legR = new THREE.BoxGeometry(0.06, 0.7, 0.8).translate(0.78, 0.35, 0);
  const deskLegs = mergeGeometries([legL, legR]);
  legL.dispose(); legR.dispose();
  const keyboard = new THREE.BoxGeometry(0.62, 0.025, 0.2);
  const emitter = new THREE.CylinderGeometry(0.07, 0.09, 0.05, 16);
  const screen = new THREE.PlaneGeometry(0.86, 0.46);
  const ring = new THREE.RingGeometry(1.0, 1.1, 48).rotateX(-Math.PI / 2);
  const shadow = new THREE.PlaneGeometry(2.3, 1.9).rotateX(-Math.PI / 2);
  const folder = new THREE.BoxGeometry(0.34, 0.04, 0.25);
  const signPlate = new THREE.BoxGeometry(0.78, 0.32, 0.04);
  const signFace = new THREE.PlaneGeometry(0.74, 0.28);

  const shadowTex = canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const soonTex = canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#16131f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8b7cf6';
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#d9d2ff';
    g.font = '600 46px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('СКОРО', w / 2, h / 2 + 2);
  });

  const shell = new THREE.MeshStandardMaterial({ color: 0xf2f0f8, roughness: 0.28, metalness: 0.05, envMapIntensity: 0.9 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x06050b, roughness: 0.12, metalness: 0.45, envMapIntensity: 1.3 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x1b1826, roughness: 0.35, metalness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a2540, roughness: 0.55, metalness: 0.1 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x17141f, roughness: 0.6, metalness: 0.3 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x3a3458, roughness: 0.5 });
  const holo = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.38, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false,
  });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 });
  const folderMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x2b2838, roughness: 0.6 });
  const signFaceMat = new THREE.MeshBasicMaterial({ map: soonTex, toneMapped: false });

  const m = (g, mat) => new THREE.Mesh(g, mat);
  const meshes = {
    Shadow: m(shadow, shadowMat),
    Ring: m(ring, ringMat),
    DeskTop: m(deskTop, deskMat),
    DeskLegs: m(deskLegs, legMat),
    Keyboard: m(keyboard, keyMat),
    Emitter: m(emitter, joint.clone()),
    Folder: m(folder, folderMat),
    SignPlate: m(signPlate, signMat),
    SignFace: m(signFace, signFaceMat),
    Body: m(body, shell),
    Arm: m(arm, shell),
    Skull: m(skull, shell),
    Visor: m(visor, visorMat),
    Ear: m(ear, joint),
    Stalk: m(stalk, joint),
    Eye: m(eye, glow),
    Bulb: m(bulb, glow.clone()),
    Chest: m(chest, glow.clone()),
    Screen: m(screen, holo),
  };
  const dispose = () => {
    const seen = new Set();
    for (const mesh of Object.values(meshes)) {
      mesh.geometry.dispose();
      if (!seen.has(mesh.material)) { seen.add(mesh.material); mesh.material.dispose(); }
    }
    shadowTex.dispose();
    soonTex.dispose();
  };
  return { meshes, dispose };
}

/* ── Цвета состояний ────────────────────────────────────────────────────── */

const C = (hex) => new THREE.Color(hex);
const EYE_COLORS = {
  normal: C('#b3a1ff'), error: C('#ff5a5a'), dim: C('#4a4566'), off: C('#2b2838'), live: C('#c4b5fd'),
};
const stateColor = (state) => C((STATE_META[state] || STATE_META.unknown).color);

/** Простой хеш строки → 0..1, чтобы роботы двигались не в такт. */
function seedOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Сглаживание, не зависящее от частоты кадров: k — доля пути за кадр при 60 к/с. */
const ease = (cur, target, k, dt = 1 / 60) => cur + (target - cur) * (1 - (1 - k) ** Math.min(dt * 60, 30));

/* ── Стол с роботом ─────────────────────────────────────────────────────── */

function Desk({ M, desk, selected, hovered, onHover, onSelect, reduced }) {
  const { agent } = desk;
  const state = agent.state;
  const soon = state === 'soon';
  const sleepy = state === 'asleep' || state === 'ready' || state === 'disabled' || state === 'unknown';
  const screenOn = !soon && state !== 'disabled' && state !== 'ready' && state !== 'asleep';
  const backlog = backlogOf(agent);
  const folders = Math.min(backlog, 6);
  const hasError = state === 'error' || (agent.live && agent.live.errors_24h > 0 && state === 'working');

  const root = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();
  const eyeL = useRef();
  const eyeR = useRef();
  const bulb = useRef();
  const ring = useRef();
  const screen = useRef();

  const seed = useMemo(() => seedOf(agent.id), [agent.id]);
  const base = useMemo(() => stateColor(state), [state]);
  const eyeBase = useMemo(() => {
    if (state === 'error') return EYE_COLORS.error;
    if (state === 'disabled') return EYE_COLORS.off;
    if (sleepy) return EYE_COLORS.dim;
    return EYE_COLORS.normal;
  }, [state, sleepy]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + seed * 10;
    const r = root.current;
    const h = head.current;
    if (r && h && armL.current && armR.current) {
      const still = reduced ? 0 : 1;
      let y = ROBOT_Y;
      let hx = 0; let hy = 0; let hz = 0;
      let lx = 0; let rx = 0; let lz = -0.2; let rz = 0.2;
      if (state === 'working') {
        y += Math.sin(t * 2.2) * 0.012 * still;
        hx = 0.26 + Math.sin(t * 1.7) * 0.03 * still;
        hy = Math.sin(t * 0.6) * 0.12 * still;
        lx = -0.95 + Math.sin(t * 15) * 0.14 * still;
        rx = -0.95 + Math.sin(t * 15 + 1.9) * 0.14 * still;
        lz = -0.08; rz = 0.08;
      } else if (state === 'error') {
        y += Math.sin(t * 1.3) * 0.02 * still;
        hz = 0.32 + Math.sin(t * 9) * 0.03 * still;
        hy = Math.sin(t * 0.9) * 0.25 * still;
        lz = -0.55; rz = 0.55;
        lx = -0.25; rx = -0.25;
      } else if (sleepy) {
        y -= 0.1;
        y += Math.sin(t * 0.7) * 0.012 * still;
        hx = 0.42 + Math.sin(t * 0.7) * 0.03 * still;
        lz = -0.1; rz = 0.1;
      } else {
        // ждёт / очередь / работает вне базы: парит и оглядывается
        y += Math.sin(t * 1.2) * 0.03 * still;
        hy = (state === 'queued' ? -0.35 + Math.sin(t * 0.8) * 0.2 : Math.sin(t * 0.35) * 0.4) * still;
        hx = -0.05 + Math.sin(t * 0.5) * 0.06 * still;
        lx = Math.sin(t * 1.1) * 0.08 * still;
        rx = Math.sin(t * 1.1 + 1) * 0.08 * still;
      }
      r.position.y = ease(r.position.y, y, 0.15, dt);
      h.rotation.x = ease(h.rotation.x, hx, 0.12, dt);
      h.rotation.y = ease(h.rotation.y, hy, 0.08, dt);
      h.rotation.z = ease(h.rotation.z, hz, 0.12, dt);
      armL.current.rotation.x = ease(armL.current.rotation.x, lx, 0.25, dt);
      armR.current.rotation.x = ease(armR.current.rotation.x, rx, 0.25, dt);
      armL.current.rotation.z = ease(armL.current.rotation.z, lz, 0.12, dt);
      armR.current.rotation.z = ease(armR.current.rotation.z, rz, 0.12, dt);

      // Моргание; во сне глаза — щёлочки.
      const blink = !reduced && !sleepy && ((t + seed * 3) % (3.2 + seed * 2)) < 0.12;
      const sy = sleepy ? 0.22 : blink ? 0.1 : 1;
      if (eyeL.current) eyeL.current.scale.y = ease(eyeL.current.scale.y, sy, 0.4, dt);
      if (eyeR.current) eyeR.current.scale.y = ease(eyeR.current.scale.y, sy, 0.4, dt);
      if (eyeL.current) eyeL.current.color.copy(eyeBase);
      if (eyeR.current) eyeR.current.color.copy(eyeBase);
    }
    // Огонёк антенны: работа и ошибка мигают.
    if (bulb.current) {
      const k = state === 'working' ? 0.65 + 0.35 * Math.sin(t * 6)
        : state === 'error' ? (Math.sin(t * 8) > 0 ? 1 : 0.25)
          : sleepy ? 0.45 : 0.9;
      bulb.current.color.copy(base).multiplyScalar(reduced ? 0.9 : k);
    }
    // Кольцо на полу: ярче у выбранного и под курсором.
    if (ring.current) {
      const pulse = state === 'error' || state === 'working' ? 0.8 + 0.2 * Math.sin(t * 4) : 0.85;
      const boost = selected ? 1.6 : hovered ? 1.3 : 1;
      ring.current.color.copy(base).multiplyScalar((reduced ? 0.85 : pulse) * boost * (soon ? 0.5 : 1));
      const s = selected ? 1.08 + Math.sin(t * 3) * 0.02 : 1;
      ring.current.scale.set(s, 1, s);
    }
    // Голографический экран: мерцает в работе, ровный в ожидании.
    if (screen.current) {
      tmp.copy(state === 'error' ? EYE_COLORS.error : state === 'working' ? base : EYE_COLORS.live);
      const k = state === 'working' ? 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 3.1)
        : state === 'error' ? 0.6 + 0.4 * (Math.sin(t * 6) > 0 ? 1 : 0) : 0.45;
      screen.current.color.copy(tmp).multiplyScalar(reduced ? 0.7 : k);
    }
  });

  const over = (e) => { e.stopPropagation(); onHover(agent.id); };
  const out = (e) => { e.stopPropagation(); onHover(null); };
  const click = (e) => {
    e.stopPropagation();
    if (e.delta > 6) return; // это был поворот камеры, а не нажатие
    onHover(null); // камера улетит к столу, а курсор останется на месте — старая подсказка не нужна
    onSelect(agent.id);
  };

  return (
    <group position={desk.pos}>
      <M.Shadow position={[0, 0.004, -0.2]} />
      <M.Ring ref={ring} position={[0, 0.012, -0.2]} color={base} />
      <M.DeskTop position={[0, 0.72, 0]} />
      <M.DeskLegs />

      {soon ? (
        <group position={[0, 0.92, 0.2]} rotation={[-0.18, 0, 0]}>
          <M.SignPlate />
          <M.SignFace position={[0, 0, 0.022]} />
        </group>
      ) : (
        <>
          <M.Keyboard position={[0, 0.768, -0.12]} />
          <M.Emitter position={[0, 0.78, 0.22]} />
          {screenOn && (
            <M.Screen ref={screen} position={[0, 1.08, 0.22]} rotation={[-0.12, 0, 0]} color={base} />
          )}
          {Array.from({ length: folders }, (_, i) => (
            <M.Folder key={i} position={[-0.6, 0.775 + i * 0.045, 0.12]}
              rotation={[0, (seedOf(`${agent.id}${i}`) - 0.5) * 0.5, 0]} color="#f5b942" />
          ))}

          {/* Робот */}
          <group ref={root} position={[0, ROBOT_Y, ROBOT_Z]} scale={S}>
            <M.Body />
            <M.Chest position={[0, -0.576, 0.62]} color={eyeBase} />
            <group ref={head} position={[0, 0.98, 0]}>
              <M.Skull />
              <M.Visor />
              <M.Eye ref={eyeL} position={EYE_L.position} quaternion={EYE_L.quaternion} color={eyeBase} />
              <M.Eye ref={eyeR} position={EYE_R.position} quaternion={EYE_R.quaternion} color={eyeBase} />
              <M.Ear position={[-1.08, 0, 0]} />
              <M.Ear position={[1.08, 0, 0]} />
              <group position={[0.18, 0.86, -0.05]} rotation={[0, 0, -0.22]}>
                <M.Stalk />
                <M.Bulb ref={bulb} position={[0, 0.46, 0]} color={base} />
              </group>
            </group>
            <group ref={armL} position={[-0.93, -0.4, 0]} rotation={[0, 0, -0.2]}><M.Arm /></group>
            <group ref={armR} position={[0.93, -0.4, 0]} rotation={[0, 0, 0.2]}><M.Arm /></group>
          </group>
        </>
      )}

      {/* Зона нажатия: невидимая, но ловит луч (у three луч не проверяет visible). */}
      <mesh visible={false} position={[0, 0.9, -0.2]} onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[2.0, 1.9, 2.0]} />
      </mesh>

      {(hasError || backlog > 0) && (
        <Html position={[0, 2.0, ROBOT_Z]} center pointerEvents="none" zIndexRange={[30, 0]}>
          <div className="flex select-none items-center gap-1">
            {hasError && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-500/40">!</span>
            )}
            {backlog > 0 && (
              <span className="whitespace-nowrap rounded-full bg-amber-400/90 px-1.5 py-px text-[10px] font-semibold text-black">
                очередь {backlog}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Зоны отделов ───────────────────────────────────────────────────────── */

function Zone({ zone, compact }) {
  const { dept } = zone;
  const color = useMemo(() => new THREE.Color(dept.accent), [dept.accent]);
  const outline = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(zone.w, 0, 0),
      new THREE.Vector3(zone.w, 0, zone.d), new THREE.Vector3(0, 0, zone.d),
    ]);
    return g;
  }, [zone.w, zone.d]);
  useEffect(() => () => outline.dispose(), [outline]);

  return (
    <group position={[zone.x0, 0, zone.z0]}>
      <mesh position={[zone.w / 2, 0.002, zone.d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[zone.w, zone.d]} />
        <meshBasicMaterial color={color} transparent opacity={dept.soon ? 0.04 : 0.07} depthWrite={false} />
      </mesh>
      <lineLoop geometry={outline} position={[0, 0.006, 0]}>
        <lineBasicMaterial color={color} transparent opacity={dept.soon ? 0.25 : 0.55} />
      </lineLoop>
      {/* Подпись — в пустой передней полосе зоны, низом к её границе: свои столы стоят дальше
          и на экране выше, а столы зоны впереди не дотягиваются. */}
      <Html position={[zone.w / 2, 0, zone.d - 0.05]} pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="-translate-x-1/2 -translate-y-full select-none whitespace-nowrap rounded-md border bg-black/70 px-2 py-0.5 text-center leading-tight backdrop-blur-sm"
          style={{ borderColor: `${dept.accent}aa` }}>
          <div className="text-[11px] font-semibold text-white">{dept.title}{dept.soon ? ' · скоро' : ''}</div>
          {!compact && <div className="text-[9px] text-white/60">{deptSummary(dept)}</div>}
        </div>
      </Html>
    </group>
  );
}

/* ── Окружение, камера ──────────────────────────────────────────────────── */

function Environment({ enabled }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled) return undefined;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const tex = pmrem.fromScene(room, 0.04).texture;
    scene.environment = tex;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
      room.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    };
  }, [enabled, gl, scene]);
  return null;
}

/** Начальный вид, «Обзор» и плавный перелёт к выбранному столу. Цель камеры не уходит за пол. */
const VIEW_DIR = new THREE.Vector3(0.3, 1.0, 0.78).normalize();
const FOV = 38;

/** Расстояние камеры, на котором офис целиком входит в кадр по ширине и по глубине. */
function homeDistance(layout, aspect) {
  const v = THREE.MathUtils.degToRad(FOV / 2);
  const fitW = ((layout.width / 2 + 1.5) * 1.12) / (Math.tan(v) * aspect);
  const elev = Math.asin(VIEW_DIR.y);
  const fitD = (((layout.depth / 2 + 1.5) * Math.sin(elev) + 1.2) * 1.12) / Math.tan(v);
  return Math.max(fitW, fitD, 8);
}

function CameraRig({ layout, focusId, resetKey, panelPx = 0 }) {
  const { camera, controls, size } = useThree();
  const goal = useRef(null);
  const aspect = size.width / Math.max(1, size.height);
  const homeDist = useMemo(() => homeDistance(layout, aspect), [layout, aspect]);
  // Раскладка пересчитывается при каждом обновлении данных; перелёт — только при смене выбора.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    camera.position.copy(VIEW_DIR).multiplyScalar(homeDist);
    camera.lookAt(0, 0, 0);
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    goal.current = null;
    // homeDist намеренно не в зависимостях: камера не прыгает от каждого пересчёта раскладки.
  }, [resetKey, camera, controls]);

  useEffect(() => {
    const desk = focusId && layoutRef.current.desks.find((d) => d.agent.id === focusId);
    if (desk && controls) {
      const dist = Math.min(camera.position.distanceTo(controls.target), 8.5);
      const target = new THREE.Vector3(desk.pos[0], 0.8, desk.pos[2]);
      // Справа открыта панель агента: сдвигаем цель вправо на половину её ширины, чтобы стол
      // оказался посередине видимой части, а не под панелью.
      if (panelPx > 0 && size.width > panelPx * 1.6) {
        const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.height;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
        target.addScaledVector(right, (panelPx / 2) * perPx);
      }
      goal.current = { target, dist };
    }
  }, [focusId, camera, controls, panelPx, size.width, size.height]);

  const offset = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!controls) return;
    const t = controls.target;
    if (goal.current) {
      offset.copy(camera.position).sub(t);
      const len = offset.length();
      const k = 1 - 0.9 ** Math.min(dt * 60, 30); // ~0,4 с на перелёт при любой частоте кадров
      t.lerp(goal.current.target, k);
      const next = len + (goal.current.dist - len) * k;
      camera.position.copy(t).addScaledVector(offset.normalize(), next);
      if (goal.current.target.distanceTo(t) < 0.02 && Math.abs(next - goal.current.dist) < 0.05) goal.current = null;
    }
    const hx = layout.width / 2 + 2;
    const hz = layout.depth / 2 + 2;
    const cx = THREE.MathUtils.clamp(t.x, -hx, hx);
    const cz = THREE.MathUtils.clamp(t.z, -hz, hz);
    const cy = THREE.MathUtils.clamp(t.y, 0, 3);
    if (cx !== t.x || cz !== t.z || cy !== t.y) {
      camera.position.x += cx - t.x; camera.position.z += cz - t.z; camera.position.y += cy - t.y;
      t.set(cx, cy, cz);
    }
  });
  return null;
}

/* ── Сцена ──────────────────────────────────────────────────────────────── */

function Office({ office, selectedId, onSelect, reduced, lowPower, resetKey }) {
  const { size } = useThree();
  // Пропорции окна округляем: раскладка не должна перестраиваться от каждого пикселя.
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 4) / 4;
  const layout = useMemo(() => layoutOffice(office.departments, aspect), [office.departments, aspect]);
  const [hoverId, setHoverId] = useState(null);
  const parts = useMemo(() => makeParts(lowPower), [lowPower]);
  useEffect(() => () => parts.dispose(), [parts]);

  useEffect(() => {
    document.body.style.cursor = hoverId ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hoverId]);

  const hoverDesk = hoverId && hoverId !== selectedId ? layout.desks.find((d) => d.agent.id === hoverId) : null;
  const span = Math.max(layout.width, layout.depth);
  // Туман — от расстояния камеры, а не от размера офиса: в портретном окне камера дальше.
  const far = homeDistance(layout, size.width / Math.max(1, size.height));

  return (
    <>
      <color attach="background" args={['#07060c']} />
      <fog attach="fog" args={['#07060c', far * 1.15, far * 2.6]} />
      {/* Без карты окружения (облегчённый режим) глянцевый корпус темнеет — добавляем рассеянный свет. */}
      <ambientLight intensity={lowPower ? 0.7 : 0.12} />
      <hemisphereLight args={['#d9ceff', '#0b0a12', 0.75]} />
      <directionalLight position={[8, 14, 10]} intensity={1.4} />
      <directionalLight position={[-10, 6, -8]} intensity={0.35} color="#7c5cff" />
      <Environment enabled={!lowPower} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[layout.width + 12, layout.depth + 12]} />
        <meshStandardMaterial color="#0d0b16" roughness={0.9} metalness={0} />
      </mesh>
      <gridHelper args={[Math.ceil(span + 12), Math.ceil(span + 12), '#1d1930', '#141120']} position={[0, 0.001, 0]} />

      {layout.zones.map((z) => <Zone key={z.dept.code} zone={z} compact={size.width < 560} />)}

      <Merged meshes={parts.meshes} limit={512} frustumCulled={false}>
        {(M) => (
          <>
            {layout.desks.map((desk) => (
              <Desk key={desk.agent.id} M={M} desk={desk} reduced={reduced}
                selected={desk.agent.id === selectedId} hovered={desk.agent.id === hoverId}
                onHover={setHoverId} onSelect={onSelect} />
            ))}
          </>
        )}
      </Merged>

      {hoverDesk && (
        <Html position={[hoverDesk.pos[0], 2.6, hoverDesk.pos[2] + ROBOT_Z]} center pointerEvents="none" zIndexRange={[40, 0]}>
          <div className="select-none whitespace-nowrap rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs shadow-xl">
            <div className="font-semibold text-white">{hoverDesk.agent.title}</div>
            <div className="mt-0.5" style={{ color: (STATE_META[hoverDesk.agent.state] || STATE_META.unknown).color }}>
              {hoverDesk.agent.stateText}
            </div>
          </div>
        </Html>
      )}

      <CameraRig layout={layout} focusId={selectedId} resetKey={resetKey} panelPx={selectedId ? 380 : 0} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08}
        minDistance={4} maxDistance={Math.max(span * 1.8, far * 1.3)}
        minPolarAngle={0.2} maxPolarAngle={1.32}
        screenSpacePanning={false} />
    </>
  );
}

export default function OfficeScene({ office, selectedId, onSelect, resetKey = 0, onFail }) {
  const [reduced] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [lowPower] = useState(() => typeof window !== 'undefined'
    && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768));

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={lowPower ? 1 : [1, 1.5]}
      frameloop={reduced ? 'demand' : 'always'}
      camera={{ fov: FOV, near: 0.1, far: 600, position: [12, 18, 24] }}
      gl={{ antialias: !lowPower, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        // При размонтировании R3F сам «теряет» контекст (forceContextLoss) — это не сбой. Сбой —
        // когда холст остался на странице, а контекст за 2 с не вернулся (сброс драйвера, нехватка памяти).
        const el = gl.domElement;
        let restored = false;
        el.addEventListener('webglcontextrestored', () => { restored = true; });
        el.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          restored = false;
          setTimeout(() => { if (el.isConnected && !restored) onFail?.('потерян контекст WebGL'); }, 2000);
        });
      }}
      onPointerMissed={() => onSelect(null)}
      aria-label="3D-офис агентов: отделы и столы с роботами. Та же информация — в виде таблицы."
      role="img"
    >
      <Office office={office} selectedId={selectedId} onSelect={onSelect}
        reduced={reduced} lowPower={lowPower} resetKey={resetKey} />
    </Canvas>
  );
}
