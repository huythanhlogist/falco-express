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
const CAMERA_HOME = new THREE.Vector3(11, 22, 25);
const CAMERA_TARGET = new THREE.Vector3(-2.5, 0, 0.5);

const allIdle = (): Statuses => allIdleStatuses();

// Mô phỏng một vòng làm việc: 3 sale tìm lead → Quân kiểm tra → Huy-bot báo
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
  body: THREE.Mesh;
  dot: HTMLSpanElement;
  nameEl: HTMLSpanElement;
  chip: HTMLDivElement;
  target: THREE.Vector3;
  nextMoveAt: number;
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
    const load = async () => {
      try {
        const res = await fetch("/api/admin/office/status", { cache: "no-store" });
        const data = (await res.json()) as OfficeLive & { error?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setLiveError(data.error ?? `Lỗi ${res.status}`);
          setStatuses(allIdle());
          return;
        }
        setLive(data);
        setLiveError(null);
        setStatuses(liveStatuses(data));
      } catch {
        if (!cancelled) {
          setLiveError("Không kết nối được n8n");
          setStatuses(allIdle());
        }
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.copy(CAMERA_HOME);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.inset = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    mount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_TARGET);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.25;
    controls.minDistance = 8;
    controls.maxDistance = 40;
    controls.update();
    resetViewRef.current = () => {
      camera.position.copy(CAMERA_HOME);
      controls.target.copy(CAMERA_TARGET);
      controls.update();
    };

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(8, 16, 10);
    scene.add(sun);

    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 22),
      new THREE.MeshStandardMaterial({ color: 0xe3e9f1 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.03;
    scene.add(base);

    // Phòng ban: sàn tô nhạt + tường sau/trái + nhãn.
    for (const dept of OFFICE_DEPARTMENTS) {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(dept.w - 0.2, dept.d - 0.2),
        new THREE.MeshStandardMaterial({ color: tint(dept.color, 0.84) }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(dept.x, 0, dept.z);
      scene.add(floor);

      const wallMat = new THREE.MeshStandardMaterial({
        color: dept.color,
        transparent: true,
        opacity: dept.id === "pending" ? 0.22 : 0.55,
      });
      const back = new THREE.Mesh(new THREE.BoxGeometry(dept.w, 0.9, 0.12), wallMat);
      back.position.set(dept.x, 0.45, dept.z - dept.d / 2);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, dept.d), wallMat);
      left.position.set(dept.x - dept.w / 2, 0.45, dept.z);
      scene.add(back, left);

      const tag = document.createElement("div");
      tag.textContent = dept.label;
      tag.style.cssText = `font:600 11px system-ui,sans-serif;color:#fff;background:#${dept.color
        .toString(16)
        .padStart(6, "0")};padding:2px 8px;border-radius:6px;white-space:nowrap;`;
      const tagObj = new CSS2DObject(tag);
      tagObj.position.set(dept.x - dept.w / 2 + 1.6, 1.5, dept.z - dept.d / 2);
      scene.add(tagObj);
    }

    // Bàn làm việc + nhân viên.
    const pickables: THREE.Object3D[] = [];
    const deskMat = new THREE.MeshStandardMaterial({ color: 0xc8a27a });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1d9c0 });
    const runtime = runtimeRef.current;
    runtime.clear();

    for (const agent of OFFICE_AGENTS) {
      const dept = OFFICE_DEPARTMENTS.find((d) => d.id === agent.deptId)!;

      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.9), deskMat);
      desk.position.set(agent.deskX, 0.75, agent.deskZ - 0.75);
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.7, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x9aa7b8 }),
      );
      legs.position.set(agent.deskX, 0.35, agent.deskZ - 0.75);
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), screenMat);
      monitor.position.set(agent.deskX, 1.1, agent.deskZ - 0.95);
      scene.add(desk, legs, monitor);

      const group = new THREE.Group();
      const bodyColor = agent.kind === "human" ? 0x334155 : dept.color;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.3, 0.85, 20),
        new THREE.MeshStandardMaterial({ color: bodyColor }),
      );
      body.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skinMat);
      head.position.y = 1.1;
      group.add(body, head);
      if (agent.kind === "ai") {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8),
          new THREE.MeshStandardMaterial({ color: 0x64748b }),
        );
        stem.position.y = 1.4;
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.8 }),
        );
        tip.position.y = 1.52;
        group.add(stem, tip);
      }
      group.position.set(agent.deskX, 0, agent.deskZ);
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
      chip.addEventListener("click", () => setSelectedId(agent.id));
      const label = new CSS2DObject(chip);
      label.position.set(0, 1.95, 0);
      group.add(label);

      runtime.set(agent.id, {
        agent,
        group,
        body,
        dot,
        nameEl,
        chip,
        target: new THREE.Vector3(agent.deskX, 0, agent.deskZ),
        nextMoveAt: 0,
      });
    }

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

      runtime.forEach((rt) => {
        const status = statusRef.current[rt.agent.id] ?? "idle";
        const active = status === "working" || status === "review";
        const dept = OFFICE_DEPARTMENTS.find((d) => d.id === rt.agent.deptId)!;
        const desk = new THREE.Vector3(rt.agent.deskX, 0, rt.agent.deskZ);

        if (active) {
          rt.target.copy(desk);
        } else if (walkingRef.current && now >= rt.nextMoveAt) {
          rt.target.set(
            dept.x + (Math.random() - 0.5) * (dept.w - 2),
            0,
            dept.z + (Math.random() - 0.3) * (dept.d - 2),
          );
          rt.nextMoveAt = now + 3 + Math.random() * 4;
        }

        const pos = rt.group.position;
        const toTarget = rt.target.clone().sub(pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        const moving = (active || (status === "idle" && walkingRef.current)) && dist > 0.05;
        if (moving) {
          toTarget.normalize().multiplyScalar(Math.min(dist, 1.6 * dt));
          pos.add(toTarget);
        }
        const seated = active && dist < 0.1;
        const bob = moving ? Math.abs(Math.sin(now * 9)) * 0.06 : 0;
        rt.body.position.y = (seated ? 0.4 : 0.5) + bob;
        rt.group.scale.setScalar(rt.agent.id === selectedRef.current ? 1.12 : 1);
      });

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
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
          <h1 className="text-xl font-bold text-navy">Văn phòng AI</h1>
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
        >
          {simulating ? "Quay lại dữ liệu thật" : "Xem thử mô phỏng"}
        </button>
        <button
          type="button"
          onClick={() => setWalking((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
        >
          {walking ? "Dừng đi lại" : "Cho đi lại"}
        </button>
        <button
          type="button"
          onClick={() => resetViewRef.current()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
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
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-base font-bold text-navy outline-none focus:border-navy"
                    />
                  ) : (
                    <h2 className="text-base font-bold text-navy">{displayName(selected)}</h2>
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
                        className="rounded-lg bg-navy px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
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
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50"
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
                    className="inline-block rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
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
                      <span className="block truncate font-semibold text-navy">{displayName(a)}</span>
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
                <h3 className="mb-1 text-sm font-bold text-navy">Hàng đợi Muse</h3>
                <p>
                  Chờ giao {live.queue.cho_giao} · Đang làm {live.queue.dang_lam} · Chờ nạp{" "}
                  {live.queue.cho_nap} · Xong {live.queue.done} · Bị chặn {live.queue.blocked} ·
                  Lỗi {live.queue.failed}
                </p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-navy">
                  Lead chờ anh Huy duyệt ({live.leads.cho_duyet})
                </h3>
                {live.pending.length === 0 ? (
                  <p>Chưa có lead nào chờ duyệt.</p>
                ) : (
                  <ul className="space-y-2">
                    {live.pending.slice(0, 5).map((l) => (
                      <li key={l.id} className="rounded-lg border border-slate-100 p-2">
                        <p className="font-semibold text-navy">
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
                  <h3 className="mb-1 text-sm font-bold text-navy">Việc gần đây</h3>
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
