"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  N8N_PROJECT_URL,
  OFFICE_AGENTS,
  OFFICE_DEPARTMENTS,
  STATUS_COLOR,
  STATUS_LABEL,
  allIdleStatuses,
  liveStatuses,
  liveTaskText,
  taskText,
  type AgentStatus,
  type OfficeAgent,
  type OfficeLive,
} from "@/lib/office-agents";

type Statuses = Record<string, AgentStatus>;

const CYCLE_SECONDS = 24;
const POLL_MS = 10_000;
const NAMES_KEY = "falco-office-names";
const CAMERA_HOME = new THREE.Vector3(10, 19, 24);
const CAMERA_TARGET = new THREE.Vector3(-1, 0.6, 0.8);

const allIdle = (): Statuses => allIdleStatuses();

// Mô phỏng một vòng làm việc: 4 sale tìm lead → Quân kiểm tra → Huy-bot báo
// cáo → anh Huy duyệt. Chỉ để xem thử giao diện; mặc định trang đọc dữ liệu
// thật từ n8n.
function simulate(t: number): Statuses {
  const s = allIdle();
  if (t >= 0 && t < 8) s.linh = "working";
  if (t >= 1 && t < 8) s.nam = "working";
  if (t >= 2 && t < 8) s.vy = "working";
  if (t >= 8 && t < 14) s.quan = "review";
  if (t >= 14 && t < 18) s.huybot = "working";
  if (t >= 18 && t < 21) s.huy = "review";
  return s;
}

type Runtime = {
  agent: OfficeAgent;
  group: THREE.Group;
  figure: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  screenMat: THREE.MeshStandardMaterial;
  dot: HTMLSpanElement;
  nameEl: HTMLSpanElement;
  chip: HTMLDivElement;
  dots: HTMLSpanElement;
  target: THREE.Vector3;
  nextMoveAt: number;
  yaw: number;
  phase: number;
  lastStatus: string;
};

function tint(color: number, amount: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), amount);
}

export default function OfficeScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [statuses, setStatuses] = useState<Statuses>(allIdle);
  const [simulating, setSimulating] = useState(false);
  const [live, setLive] = useState<OfficeLive | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [walking, setWalking] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tên hiển thị do người dùng tự đặt (chỉ đổi cách gọi trên trang này,
  // không đổi tên agent trong n8n). Lưu trong trình duyệt hiện tại.
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const statusRef = useRef<Statuses>(statuses);
  const walkingRef = useRef(walking);
  const selectedRef = useRef<string | null>(selectedId);
  const runtimeRef = useRef<Map<string, Runtime>>(new Map());
  const resetViewRef = useRef<() => void>(() => {});

  useEffect(() => {
    statusRef.current = statuses;
    runtimeRef.current.forEach((rt, id) => {
      rt.dot.style.background = STATUS_COLOR[statuses[id] ?? "idle"];
    });
  }, [statuses]);

  useEffect(() => {
    walkingRef.current = walking;
  }, [walking]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAMES_KEY);
      if (raw) setNames(JSON.parse(raw) as Record<string, string>);
    } catch {
      // Không đọc được thì dùng tên mặc định.
    }
  }, []);

  useEffect(() => {
    runtimeRef.current.forEach((rt, id) => {
      rt.nameEl.textContent = names[id] || rt.agent.name;
    });
  }, [names]);

  useEffect(() => {
    setEditing(false);
  }, [selectedId]);

  const displayName = (a: OfficeAgent) => names[a.id] || a.name;

  function saveName(agent: OfficeAgent, value: string) {
    const next = { ...names };
    const clean = value.trim().slice(0, 20);
    if (clean && clean !== agent.name) next[agent.id] = clean;
    else delete next[agent.id];
    setNames(next);
    try {
      window.localStorage.setItem(NAMES_KEY, JSON.stringify(next));
    } catch {
      // Trình duyệt chặn lưu thì tên chỉ có hiệu lực đến khi tải lại trang.
    }
    setEditing(false);
  }

  useEffect(() => {
    selectedRef.current = selectedId;
    runtimeRef.current.forEach((rt, id) => {
      rt.chip.style.borderColor = id === selectedId ? "#132440" : "#e2e8f0";
      rt.chip.style.fontWeight = id === selectedId ? "700" : "600";
    });
  }, [selectedId]);

  // Dữ liệu thật từ n8n (hàng đợi Muse, nhịp sống, lead chờ duyệt).
  useEffect(() => {
    if (simulating) return;
    let cancelled = false;
    let failures = 0;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/office/status", { cache: "no-store" });
        const data = (await res.json()) as OfficeLive & { error?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
        failures = 0;
        setLive(data);
        setLiveError(null);
        setStatuses(liveStatuses(data));
      } catch (e) {
        if (cancelled) return;
        failures += 1;
        // Lỗi thoáng qua (deploy, mạng chậm): giữ nguyên hình đang thấy, chỉ báo khi lỗi kéo dài.
        if (failures >= 3) setLiveError(e instanceof Error && e.message ? e.message : "Không kết nối được n8n");
      }
    };
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [simulating]);

  useEffect(() => {
    if (!simulating) return;
    const started = Date.now();
    const tick = () => {
      const t = ((Date.now() - started) / 1000) % CYCLE_SECONDS;
      setStatuses(simulate(t));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [simulating]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.copy(CAMERA_HOME);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.inset = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    mount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_TARGET);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.3;
    controls.minDistance = 8;
    controls.maxDistance = 42;
    controls.update();
    resetViewRef.current = () => {
      camera.position.copy(CAMERA_HOME);
      controls.target.copy(CAMERA_TARGET);
      controls.update();
    };

    // Ánh sáng: trời + nắng có bóng đổ.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8e6, 1.25));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
    sun.position.set(9, 18, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -17;
    sun.shadow.camera.right = 17;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // ----- tiện ích dựng hình -----
    const std = (
      color: number,
      o: { rough?: number; metal?: number; emissive?: number; ei?: number; opacity?: number } = {},
    ) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: o.rough ?? 0.7,
        metalness: o.metal ?? 0.05,
        emissive: o.emissive ?? 0x000000,
        emissiveIntensity: o.ei ?? 0,
        transparent: o.opacity !== undefined,
        opacity: o.opacity ?? 1,
        depthWrite: o.opacity === undefined,
      });
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
      shadow = true,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const cyl = (
      rt: number,
      rb: number,
      h: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
    ) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const ball = (
      r: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
    ) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const canvasTex = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      draw(ctx);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return { tex, ctx };
    };
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const M = {
      wood: std(0xc9a27a, { rough: 0.55 }),
      woodDark: std(0x8b6a4a, { rough: 0.6 }),
      metal: std(0x94a3b8, { rough: 0.35, metal: 0.6 }),
      dark: std(0x1e293b, { rough: 0.4, metal: 0.3 }),
      white: std(0xf8fafc, { rough: 0.5 }),
      wall: std(0xf1f5f9, { rough: 0.9 }),
      glass: std(0xbfe3ff, { rough: 0.1, metal: 0.1, opacity: 0.22 }),
      pot: std(0xb45309, { rough: 0.8 }),
      leaf: std(0x2f9e5b, { rough: 0.8 }),
      leaf2: std(0x3fb36b, { rough: 0.8 }),
      cardboard: std(0xc59a62, { rough: 0.85 }),
      tape: std(0xe9d8b4, { rough: 0.7 }),
      red: std(0xd92a0a, { rough: 0.5 }),
      navy: std(0x132440, { rough: 0.5 }),
    };

    // ----- nền, sàn, tường -----
    const tileTex = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = "#eef2f7";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#d5dce6";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 256, 256);
    }).tex;
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(10, 6.6);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 30),
      new THREE.MeshStandardMaterial({ color: 0xdbe3ee, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-1, -0.4, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // Tầng sàn văn phòng (dày như mô hình thu nhỏ).
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(21, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTex, roughness: 0.6 }),
    );
    slab.position.set(-1, -0.2, 0);
    slab.receiveShadow = true;
    scene.add(slab);
    box(21.3, 0.12, 14.3, M.navy, -1, -0.34, 0, scene, false);

    // Tường sau và tường trái có cửa sổ.
    const WALL_H = 3.2;
    box(21, WALL_H, 0.25, M.wall, -1, WALL_H / 2, -7.0);
    box(0.25, WALL_H, 14, M.wall, -11.5, WALL_H / 2, 0);
    box(21, 0.12, 0.3, M.navy, -1, 0.06, -6.98, scene, false);
    const windowMat = std(0x9ed0ff, { rough: 0.1, metal: 0.2, emissive: 0x7cc0ff, ei: 0.5, opacity: 0.8 });
    for (const wx of [-9.4, -6.6, -3.8, -1.0]) box(2, 1.3, 0.06, windowMat, wx, 1.95, -6.85, scene, false);
    for (const wz of [-4.2, -1.4, 1.4, 4.2]) box(0.06, 1.3, 2, windowMat, -11.36, 1.95, wz, scene, false);

    // Bảng hiệu FALCO EXPRESS trên tường sau.
    const logoImg = new Image();
    const signCanvas = canvasTex(1400, 360, (ctx) => drawSign(ctx, null));
    const matCanvas = canvasTex(640, 480, (ctx) => drawMat(ctx, null));
    function drawSign(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) {
      ctx.fillStyle = "#132440";
      roundRect(ctx, 0, 0, 1400, 360, 36);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 28, 28, 420, 304, 28);
      ctx.fill();
      if (img) ctx.drawImage(img, 0.115 * img.width, 0.2 * img.height, 0.77 * img.width, 0.58 * img.height, 40, 40, 396, 280);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 118px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("FALCO EXPRESS", 490, 170);
      ctx.fillStyle = "#d92a0a";
      ctx.fillRect(494, 196, 340, 12);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "500 46px system-ui, -apple-system, sans-serif";
      ctx.fillText("Văn phòng AI · Gửi hàng Việt Nam đi châu Âu", 492, 274);
    }
    function drawMat(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) {
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 0, 0, 640, 480, 40);
      ctx.fill();
      ctx.strokeStyle = "#132440";
      ctx.lineWidth = 14;
      roundRect(ctx, 10, 10, 620, 460, 34);
      ctx.stroke();
      if (img) ctx.drawImage(img, 0.115 * img.width, 0.2 * img.height, 0.77 * img.width, 0.58 * img.height, 60, 50, 520, 380);
    }
    logoImg.onload = () => {
      if (disposed) return;
      drawSign(signCanvas.ctx, logoImg);
      drawMat(matCanvas.ctx, logoImg);
      signCanvas.tex.needsUpdate = true;
      matCanvas.tex.needsUpdate = true;
    };
    logoImg.src = "/falco-logo.png";
    box(5.9, 1.62, 0.1, M.navy, 4.2, 2.25, -6.8, scene, false);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 1.44),
      new THREE.MeshBasicMaterial({ map: signCanvas.tex, transparent: true }),
    );
    sign.position.set(4.2, 2.25, -6.74);
    scene.add(sign);

    // Thảm đón khách có logo ở cửa vào.
    const doormat = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.55),
      new THREE.MeshBasicMaterial({ map: matCanvas.tex, transparent: true, depthWrite: false }),
    );
    doormat.rotation.x = -Math.PI / 2;
    doormat.position.set(-1, 0.05, 8.6);
    scene.add(doormat);
    box(3.5, 0.03, 2.65, M.navy, -1, 0.005, 8.6, scene, false);

    const plant = (x: number, z: number, s = 1) => {
      const g = new THREE.Group();
      cyl(0.2 * s, 0.15 * s, 0.34 * s, M.pot, 0, 0.17 * s, 0, g);
      ball(0.3 * s, M.leaf, 0, 0.62 * s, 0, g);
      ball(0.22 * s, M.leaf2, 0.17 * s, 0.8 * s, 0.07 * s, g);
      ball(0.2 * s, M.leaf2, -0.15 * s, 0.76 * s, -0.08 * s, g);
      g.position.set(x, 0, z);
      scene.add(g);
    };
    const parcel = (x: number, z: number, s: number, rot: number, y = 0) => {
      const g = new THREE.Group();
      box(s, s * 0.7, s * 0.8, M.cardboard, 0, (s * 0.7) / 2, 0, g);
      box(s * 0.16, s * 0.71, s * 0.82, M.tape, 0, (s * 0.7) / 2, 0, g, false);
      g.position.set(x, y, z);
      g.rotation.y = rot;
      scene.add(g);
    };

    // ----- phòng ban -----
    const museLeds: { mat: THREE.MeshStandardMaterial; offset: number }[] = [];
    for (const dept of OFFICE_DEPARTMENTS) {
      const left = dept.x - dept.w / 2;
      const top = dept.z - dept.d / 2;
      const pending = dept.id === "pending";

      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(dept.w - 0.3, dept.d - 0.3),
        new THREE.MeshStandardMaterial({ color: tint(dept.color, pending ? 0.9 : 0.78), roughness: 1 }),
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(dept.x, 0.012, dept.z);
      carpet.receiveShadow = true;
      scene.add(carpet);

      // Vách kính thấp có thanh ray màu phòng ban.
      const rail = std(dept.color, { rough: 0.5 });
      if (top > -6.4) {
        box(dept.w - 0.2, 1.1, 0.05, M.glass, dept.x, 0.55, top, scene, false);
        box(dept.w - 0.2, 0.08, 0.1, rail, dept.x, 1.12, top, scene, false);
      }
      if (left > -10.9) {
        box(0.05, 1.1, dept.d - 0.2, M.glass, left, 0.55, dept.z, scene, false);
        box(0.1, 0.08, dept.d - 0.2, rail, left, 1.12, dept.z, scene, false);
      }
      box(dept.w - 0.3, 0.06, 0.08, rail, dept.x, 0.04, dept.z + dept.d / 2 - 0.15, scene, false);

      const tag = document.createElement("div");
      tag.textContent = dept.label;
      tag.style.cssText = `font:700 11px system-ui,sans-serif;color:#fff;background:#${dept.color
        .toString(16)
        .padStart(6, "0")};padding:3px 9px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(15,23,42,.25);`;
      const tagObj = new CSS2DObject(tag);
      tagObj.position.set(left + 1.9, 0.15, top + dept.d - 0.3);
      scene.add(tagObj);

      // Đồ đạc riêng từng phòng.
      if (dept.id === "exec") {
        box(2.4, 1.7, 0.4, M.woodDark, -10.0, 0.85, -6.7);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 9; c++) {
            const colors = [0xd92a0a, 0x132440, 0x2f9e5b, 0xf59e0b, 0x7a5cc7];
            box(0.1, 0.3, 0.3, std(colors[(r + c) % colors.length]), -10.95 + c * 0.24, 0.3 + r * 0.4, -6.58, scene, false);
          }
        }
        plant(-4.6, -6.0, 1.2);
        box(1.6, 0.04, 1.2, std(0x7a5cc7, { rough: 1 }), -7.5, 0.04, -1.6, scene, false);
        const sofa = new THREE.Group();
        box(1.6, 0.4, 0.7, std(0x475569), 0, 0.3, 0, sofa);
        box(1.6, 0.5, 0.18, std(0x475569), 0, 0.62, 0.3, sofa);
        sofa.position.set(-7.5, 0, -1.4);
        sofa.rotation.y = Math.PI;
        scene.add(sofa);
      } else if (dept.id === "sale") {
        box(2.6, 1.3, 0.06, M.white, -0.9, 1.9, -6.84, scene, false);
        box(2.7, 1.4, 0.04, M.metal, -0.9, 1.9, -6.87, scene, false);
        for (let i = 0; i < 4; i++) box(1.6 - i * 0.2, 0.05, 0.02, std([0xd92a0a, 0x1f9d8a, 0x132440, 0xf59e0b][i]), -1.2 + (i % 2) * 0.2, 2.35 - i * 0.28, -6.8, scene, false);
        plant(-3.6, -6.0, 1.1);
        plant(8.5, -6.0, 1.1);
        parcel(8.2, -1.1, 0.7, 0.3);
        parcel(7.4, -1.0, 0.55, -0.2);
        parcel(7.9, -1.05, 0.5, 0.1, 0.39);
      } else if (dept.id === "qa") {
        box(1.4, 1.5, 0.45, M.metal, -10.1, 0.75, 1.1);
        for (let i = 0; i < 4; i++) box(1.2, 0.02, 0.02, M.dark, -10.1, 0.35 + i * 0.35, 1.34, scene, false);
        // Bảng kiểm: dấu đạt và loại.
        box(1.9, 1.2, 0.06, M.white, -7.5, 1.7, 0.62, scene, false);
        for (let i = 0; i < 5; i++) {
          box(0.18, 0.18, 0.03, std(i % 3 === 2 ? 0xe11d48 : 0x22c55e, { emissive: i % 3 === 2 ? 0xe11d48 : 0x22c55e, ei: 0.3 }), -8.2 + i * 0.35, 1.7, 0.66, scene, false);
        }
        plant(-4.6, 6.0, 1.1);
      } else if (dept.id === "muse") {
        for (let r = 0; r < 3; r++) {
          const rack = new THREE.Group();
          box(0.8, 1.9, 0.8, M.dark, 0, 0.95, 0, rack);
          for (let i = 0; i < 6; i++) {
            const led = std(0x22d3ee, { emissive: 0x22d3ee, ei: 0.15 });
            museLeds.push({ mat: led, offset: r * 1.7 + i * 0.9 });
            box(0.5, 0.06, 0.03, led, 0, 0.35 + i * 0.28, 0.42, rack, false);
            box(0.08, 0.06, 0.03, std(0x22c55e, { emissive: 0x22c55e, ei: 0.8 }), 0.28, 0.35 + i * 0.28, 0.42, rack, false);
          }
          rack.position.set(-3.1 + r * 1.0, 0, 6.0);
          scene.add(rack);
        }
        plant(1.5, 6.0, 1.0);
      } else if (pending) {
        for (let i = 0; i < 3; i++) box(1.0, 1.6, 0.5, std(0xcbd5e1, { rough: 0.9, opacity: 0.55 }), 3.5 + i * 1.3, 0.8, 5.9, scene, false);
        parcel(7.4, 5.4, 0.8, 0.4);
        parcel(8.1, 5.0, 0.7, -0.3);
        parcel(7.7, 5.2, 0.55, 0.2, 0.56);
        parcel(3.4, 2.3, 0.6, 0.5);
        const soon = document.createElement("div");
        soon.textContent = "Sắp mở";
        soon.style.cssText = "font:700 12px system-ui,sans-serif;color:#64748b;border:1.5px dashed #94a3b8;border-radius:8px;padding:3px 10px;background:rgba(255,255,255,.7);";
        const soonObj = new CSS2DObject(soon);
        soonObj.position.set(dept.x, 0.6, dept.z);
        scene.add(soonObj);
      }
    }

    // ----- bàn làm việc + nhân viên -----
    const pickables: THREE.Object3D[] = [];
    const runtime = runtimeRef.current;
    runtime.clear();
    const skins = [0xf1d9c0, 0xe8c4a0, 0xd9a877, 0xf5dcc8, 0xc98f62, 0xefd0b0, 0xe0b88f, 0xf3d5b8, 0xd6a06f];
    const hairs = [0x1f2937, 0x3b2a20, 0x111827, 0x5b3a29, 0x0f172a, 0x2b2118, 0x4a3426, 0x1c1917, 0x3f2d1e];

    OFFICE_AGENTS.forEach((agent, index) => {
      const dept = OFFICE_DEPARTMENTS.find((d) => d.id === agent.deptId)!;
      const dx = agent.deskX;
      const dz = agent.deskZ;
      const deskZ = dz - 0.78;

      // Bàn.
      box(1.9, 0.07, 0.95, M.wood, dx, 0.78, deskZ);
      for (const lx of [-0.88, 0.88]) for (const lz of [-0.4, 0.4]) box(0.06, 0.76, 0.06, M.metal, dx + lx, 0.38, deskZ + lz);
      box(0.5, 0.5, 0.8, M.woodDark, dx + 0.6, 0.45, deskZ);
      // Màn hình.
      const screenMat = std(0x0b1220, { rough: 0.3, emissive: 0x38bdf8, ei: 0.12 });
      box(0.84, 0.54, 0.05, M.dark, dx, 1.32, deskZ - 0.2);
      box(0.76, 0.46, 0.02, screenMat, dx, 1.32, deskZ - 0.17, scene, false);
      cyl(0.04, 0.05, 0.28, M.metal, dx, 0.96, deskZ - 0.2);
      box(0.32, 0.03, 0.2, M.metal, dx, 0.83, deskZ - 0.2);
      box(0.56, 0.025, 0.18, M.dark, dx - 0.1, 0.83, deskZ + 0.2);
      box(0.08, 0.03, 0.12, M.dark, dx + 0.45, 0.83, deskZ + 0.22);
      cyl(0.06, 0.05, 0.1, M.white, dx - 0.7, 0.87, deskZ + 0.15);
      cyl(0.03, 0.03, 0.35, M.metal, dx + 0.78, 0.97, deskZ - 0.3);
      box(0.22, 0.05, 0.14, std(dept.color), dx + 0.7, 1.16, deskZ - 0.25, scene, false);

      // Ghế.
      const chair = new THREE.Group();
      box(0.56, 0.08, 0.52, std(dept.color, { rough: 0.8 }), 0, 0.5, 0, chair);
      box(0.52, 0.62, 0.08, std(dept.color, { rough: 0.8 }), 0, 0.86, 0.28, chair);
      cyl(0.04, 0.04, 0.4, M.metal, 0, 0.26, 0, chair);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        box(0.3, 0.04, 0.05, M.dark, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, chair).rotation.y = -a;
      }
      chair.position.set(dx, 0, dz + 0.1);
      scene.add(chair);

      // Nhân vật (mặt quay về +z của nhóm).
      const group = new THREE.Group();
      const figure = new THREE.Group();
      group.add(figure);
      const isAi = agent.kind === "ai";
      const shirt = std(isAi ? dept.color : 0x334155, { rough: 0.7 });
      const pants = std(isAi ? 0x2b3547 : 0x1f2937, { rough: 0.8 });
      const skin = std(skins[index % skins.length], { rough: 0.6 });
      const hair = std(hairs[index % hairs.length], { rough: 0.7 });

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 16), shirt);
      torso.position.y = 1.08;
      torso.castShadow = true;
      figure.add(torso);
      if (!isAi) {
        box(0.07, 0.34, 0.03, M.red, 0, 1.08, 0.215, figure, false);
      } else {
        box(0.2, 0.14, 0.03, std(0xffffff, { emissive: 0xffffff, ei: 0.5 }), 0, 1.1, 0.215, figure, false);
      }
      const makeLimb = (x: number, y: number, r: number, h: number, mat: THREE.Material) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 10), mat);
        m.position.y = -(h / 2 + r);
        m.castShadow = true;
        pivot.add(m);
        figure.add(pivot);
        return pivot;
      };
      const legL = makeLimb(-0.11, 0.8, 0.1, 0.42, pants);
      const legR = makeLimb(0.11, 0.8, 0.1, 0.42, pants);
      const armL = makeLimb(-0.33, 1.28, 0.075, 0.32, shirt);
      const armR = makeLimb(0.33, 1.28, 0.075, 0.32, shirt);
      for (const leg of [legL, legR]) {
        const shoe = box(0.16, 0.08, 0.26, M.dark, 0, -0.66, 0.05, leg, false);
        shoe.castShadow = true;
      }
      for (const arm of [armL, armR]) ball(0.07, skin, 0, -0.5, 0, arm);

      const head = new THREE.Group();
      head.position.y = 1.58;
      figure.add(head);
      ball(0.23, skin, 0, 0, 0, head);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.245, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        hair,
      );
      cap.rotation.x = -0.25;
      cap.castShadow = true;
      head.add(cap);
      if (isAi) {
        const visor = std(0x22d3ee, { emissive: 0x22d3ee, ei: 0.9 });
        box(0.36, 0.08, 0.05, visor, 0, 0.02, 0.2, head, false);
        cyl(0.015, 0.015, 0.16, M.metal, 0, 0.32, 0, head);
        ball(0.05, visor, 0, 0.42, 0, head);
        box(0.05, 0.14, 0.12, M.dark, -0.24, -0.02, 0, head, false);
        box(0.05, 0.14, 0.12, M.dark, 0.24, -0.02, 0, head, false);
      } else {
        ball(0.028, M.dark, -0.08, 0.02, 0.2, head);
        ball(0.028, M.dark, 0.08, 0.02, 0.2, head);
        box(0.1, 0.02, 0.02, std(0x9a3412), 0, -0.1, 0.21, head, false);
      }

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      group.add(ring);

      group.position.set(dx, 0, dz);
      group.userData.agentId = agent.id;
      scene.add(group);
      pickables.push(group);

      const chip = document.createElement("div");
      chip.style.cssText =
        "display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid #e2e8f0;border-radius:999px;padding:2px 9px 2px 7px;font:600 12px system-ui,sans-serif;color:#132440;box-shadow:0 1px 4px rgba(15,23,42,.15);cursor:pointer;pointer-events:auto;white-space:nowrap;";
      const dot = document.createElement("span");
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${STATUS_COLOR.idle};`;
      chip.appendChild(dot);
      const nameEl = document.createElement("span");
      nameEl.textContent = agent.name;
      chip.appendChild(nameEl);
      const dots = document.createElement("span");
      dots.style.cssText = "color:#64748b;font-weight:700;min-width:0;";
      chip.appendChild(dots);
      chip.addEventListener("click", () => setSelectedId(agent.id));
      const label = new CSS2DObject(chip);
      label.position.set(0, 2.25, 0);
      group.add(label);

      runtime.set(agent.id, {
        agent,
        group,
        figure,
        legL,
        legR,
        armL,
        armR,
        ring,
        ringMat,
        screenMat,
        dot,
        nameEl,
        chip,
        dots,
        target: new THREE.Vector3(dx, 0, dz),
        nextMoveAt: 0,
        yaw: Math.PI,
        phase: index * 1.3,
        lastStatus: "",
      });
    });

    // Bấm vào người để chọn (phân biệt với kéo xoay góc nhìn).
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, true)[0];
      if (!hit) return;
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.agentId) o = o.parent;
      if (o) setSelectedId(o.userData.agentId as string);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      const now = clock.elapsedTime;
      let museBusy = false;

      runtime.forEach((rt) => {
        const status = statusRef.current[rt.agent.id] ?? "idle";
        const active = status === "working" || status === "review";
        if (rt.agent.museBot && status === "working") museBusy = true;
        const dept = OFFICE_DEPARTMENTS.find((d) => d.id === rt.agent.deptId)!;
        const desk = new THREE.Vector3(rt.agent.deskX, 0, rt.agent.deskZ);

        if (active) {
          rt.target.copy(desk);
        } else if (walkingRef.current && now >= rt.nextMoveAt) {
          rt.target.set(
            dept.x + (Math.random() - 0.5) * (dept.w - 2.4),
            0,
            dept.z + (Math.random() - 0.3) * (dept.d - 2.4),
          );
          rt.nextMoveAt = now + 3 + Math.random() * 4;
        }

        const pos = rt.group.position;
        const toTarget = rt.target.clone().sub(pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        const moving = (active || (status === "idle" && walkingRef.current)) && dist > 0.05;
        let desiredYaw = rt.yaw;
        if (moving) {
          desiredYaw = Math.atan2(toTarget.x, toTarget.z);
          toTarget.normalize().multiplyScalar(Math.min(dist, 1.6 * dt));
          pos.add(toTarget);
        }
        const seated = active && dist < 0.1;
        if (seated) desiredYaw = Math.PI;
        let diff = desiredYaw - rt.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        rt.yaw += diff * Math.min(1, dt * 9);
        rt.group.rotation.y = rt.yaw;

        // Tư thế: ngồi gõ phím, đi bộ, hoặc đứng thở.
        if (seated) {
          const typing = status === "working";
          rt.figure.position.y = -0.3;
          rt.legL.rotation.x = -Math.PI / 2;
          rt.legR.rotation.x = -Math.PI / 2;
          rt.armL.rotation.x = -1.1 + (typing ? Math.sin(now * 13 + rt.phase) * 0.1 : 0);
          rt.armR.rotation.x = -1.1 + (typing ? Math.sin(now * 13 + 2 + rt.phase) * 0.1 : 0);
        } else if (moving) {
          const swing = Math.sin(now * 8 + rt.phase) * 0.6;
          rt.figure.position.y = Math.abs(Math.sin(now * 8 + rt.phase)) * 0.05;
          rt.legL.rotation.x = swing;
          rt.legR.rotation.x = -swing;
          rt.armL.rotation.x = -swing * 0.8;
          rt.armR.rotation.x = swing * 0.8;
        } else {
          rt.figure.position.y = Math.sin(now * 1.6 + rt.phase) * 0.012;
          rt.legL.rotation.x = 0;
          rt.legR.rotation.x = 0;
          rt.armL.rotation.x = Math.sin(now * 1.6 + rt.phase) * 0.04;
          rt.armR.rotation.x = -Math.sin(now * 1.6 + rt.phase) * 0.04;
        }

        const selectedNow = rt.agent.id === selectedRef.current;
        rt.group.scale.setScalar(selectedNow ? 1.1 : 1);

        if (rt.lastStatus !== status) {
          rt.ringMat.color.set(STATUS_COLOR[status]);
          rt.lastStatus = status;
        }
        rt.ringMat.opacity = active ? 0.6 + 0.3 * Math.sin(now * 4 + rt.phase) : status === "offline" ? 0.12 : 0.28;
        rt.ring.scale.setScalar(selectedNow ? 1.25 : 1);

        const sm = rt.screenMat;
        if (status === "working") {
          sm.emissive.setHex(0x38bdf8);
          sm.emissiveIntensity = 0.75 + 0.25 * Math.sin(now * 9 + rt.phase);
        } else if (status === "review") {
          sm.emissive.setHex(0xfbbf24);
          sm.emissiveIntensity = 0.65;
        } else if (status === "offline") {
          sm.emissive.setHex(0x000000);
          sm.emissiveIntensity = 0;
        } else {
          sm.emissive.setHex(0x38bdf8);
          sm.emissiveIntensity = 0.12;
        }

        const dotsText =
          status === "working" ? ".".repeat(1 + (Math.floor(now * 3) % 3)) : status === "review" ? " kiểm tra" : "";
        if (rt.dots.textContent !== dotsText) rt.dots.textContent = dotsText;
      });

      for (const led of museLeds) {
        led.mat.emissiveIntensity = museBusy ? 0.5 + 0.5 * Math.sin(now * 10 + led.offset) : 0.15;
      }

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          const mats = Array.isArray(m) ? m : [m];
          for (const x of mats) {
            const map = (x as THREE.MeshBasicMaterial).map;
            if (map) map.dispose();
            x.dispose();
          }
        }
      });
      renderer.dispose();
      mount.replaceChildren();
      runtime.clear();
    };
  }, []);

  const working = useMemo(
    () =>
      Object.values(statuses).filter((s) => s === "working" || s === "review").length,
    [statuses],
  );
  const taskLine = (a: OfficeAgent, st: AgentStatus) =>
    !simulating && live ? liveTaskText(a, st, live) : taskText(a, st);
  const selected = OFFICE_AGENTS.find((a) => a.id === selectedId) ?? null;
  const selectedStatus: AgentStatus = selected ? (statuses[selected.id] ?? "idle") : "idle";
  const selectedDept = selected
    ? OFFICE_DEPARTMENTS.find((d) => d.id === selected.deptId)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">Văn phòng AI</h1>
          <p className="mt-1 text-slate-500">
            {OFFICE_AGENTS.length} nhân viên, {working} đang làm việc. Bấm vào
            nhân viên để xem chi tiết, kéo để xoay góc nhìn.
          </p>
        </div>
        {simulating ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Đang xem thử mô phỏng — không phải dữ liệu thật
          </span>
        ) : liveError ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            Không đọc được n8n: {liveError}
          </span>
        ) : live ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Dữ liệu thật từ n8n · cập nhật{" "}
            {new Date(live.generatedAt).toLocaleTimeString("vi-VN")}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Đang tải dữ liệu từ n8n…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSimulating((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
        >
          {simulating ? "Quay lại dữ liệu thật" : "Xem thử mô phỏng"}
        </button>
        <button
          type="button"
          onClick={() => setWalking((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
        >
          {walking ? "Dừng đi lại" : "Cho đi lại"}
        </button>
        <button
          type="button"
          onClick={() => resetViewRef.current()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
        >
          Đặt lại góc nhìn
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div
          ref={mountRef}
          className="relative h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-200 lg:h-[620px]"
        />

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {selected && selectedDept ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {editing ? (
                    <input
                      autoFocus
                      value={draft}
                      maxLength={20}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName(selected, draft);
                        if (e.key === "Escape") setEditing(false);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-base font-bold text-navy-800 outline-none focus:border-navy-800"
                    />
                  ) : (
                    <h2 className="text-base font-bold text-navy-800">{displayName(selected)}</h2>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: STATUS_COLOR[selectedStatus] }}
                  >
                    {STATUS_LABEL[selectedStatus]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveName(selected, draft)}
                        className="rounded-lg bg-navy-800 px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Lưu tên
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Huỷ
                      </button>
                      {names[selected.id] ? (
                        <button
                          type="button"
                          onClick={() => saveName(selected, selected.name)}
                          className="text-xs font-semibold text-slate-500 underline"
                        >
                          Về tên gốc ({selected.name})
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(displayName(selected));
                        setEditing(true);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                    >
                      Đổi tên
                    </button>
                  )}
                </div>
                <p className="text-slate-600">{selected.role}</p>
                <dl className="space-y-1 text-xs text-slate-500">
                  <div>
                    <dt className="inline font-semibold">Phòng: </dt>
                    <dd className="inline">{selectedDept.label}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Loại: </dt>
                    <dd className="inline">
                      {selected.kind === "ai" ? "Nhân viên AI" : "Người thật"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Việc hiện tại: </dt>
                    <dd className="inline">{taskLine(selected, selectedStatus)}</dd>
                  </div>
                </dl>
                {selected.n8nId ? (
                  <a
                    href={`${N8N_PROJECT_URL}/${selected.n8nId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Mở agent trong n8n
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-slate-500">Chọn một nhân viên trong sơ đồ hoặc danh sách.</p>
            )}
          </div>

          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {OFFICE_AGENTS.map((a) => {
              const st = statuses[a.id] ?? "idle";
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ${
                      a.id === selectedId ? "bg-slate-50" : ""
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[st] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy-800">{displayName(a)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {STATUS_LABEL[st]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {!simulating && live ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
              {live.alerts.length > 0 ? (
                <ul className="space-y-1 rounded-lg bg-red-50 p-2 font-semibold text-red-700">
                  {live.alerts.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <div>
                <h3 className="mb-1 text-sm font-bold text-navy-800">Hàng đợi Muse</h3>
                <p>
                  Chờ giao {live.queue.cho_giao} · Đang làm {live.queue.dang_lam} · Chờ nạp{" "}
                  {live.queue.cho_nap} · Xong {live.queue.done} · Bị chặn {live.queue.blocked} ·
                  Lỗi {live.queue.failed}
                </p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-navy-800">
                  Lead chờ anh Huy duyệt ({live.leads.cho_duyet})
                </h3>
                {live.pending.length === 0 ? (
                  <p>Chưa có lead nào chờ duyệt.</p>
                ) : (
                  <ul className="space-y-2">
                    {live.pending.slice(0, 5).map((l) => (
                      <li key={l.id} className="rounded-lg border border-slate-100 p-2">
                        <p className="font-semibold text-navy-800">
                          {l.company} · {l.score} điểm
                        </p>
                        <p className="text-slate-500">
                          {l.saleAgent} · {l.contact}
                        </p>
                        <p className="mt-1">{l.draft}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-slate-400">
                  Đã loại tự động: {live.leads.loai}. Duyệt và gửi hiện làm trong n8n.
                </p>
              </div>
              {live.recent.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-sm font-bold text-navy-800">Việc gần đây</h3>
                  <ul className="space-y-1">
                    {live.recent.slice(0, 5).map((t) => (
                      <li key={t.taskCode} className="truncate">
                        <span className="font-semibold">{t.taskCode}</span> · {t.status}
                        {t.bot ? ` · ${t.bot}` : ""}
                        {t.found ? ` · ${t.passed}/${t.found} lead đạt` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
