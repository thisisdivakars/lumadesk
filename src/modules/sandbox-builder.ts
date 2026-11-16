import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { StageCallbacks } from './therapy-quests.js';
import { store } from '../state/store.js';
import {
  UNLOCKABLE_CATALOG,
  WorldGenerator,
} from '../worlds/world-generator.js';

type TraceGuideType = 'INFINITY' | 'WAVE' | 'STAR' | 'FREE';

interface TraceCheckpoint {
  pos: Vector3;
  mesh: Mesh;
  hit: boolean;
}

export class SandboxBuilderModule {
  public group = new Group();
  public isHoldingBrush = false;
  public isPressingToDraw = false;
  public airCanvasPlane: Mesh | null = null;

  private cb: StageCallbacks;
  private worldGen: WorldGenerator;
  private onStartNextQuest: () => void;
  private onBrushModeChanged?: (active: boolean) => void;

  private nonDrawingUIGroup = new Group();
  private canvasControlsGroup = new Group();
  private paintPotsGroup = new Group();
  private traceGuideGroup = new Group();
  private drawingsGroup = new Group();
  private brushMeshGroup = new Group();
  private brushTipMesh!: Mesh;

  private activePaintHex = 0x00f0ff;
  private lastPaintPoint: Vector3 | null = null;

  private currentGuideIndex = 0;
  private guideOrder: TraceGuideType[] = ['INFINITY', 'WAVE', 'STAR', 'FREE'];
  private checkpoints: TraceCheckpoint[] = [];

  constructor(
    callbacks: StageCallbacks,
    worldGenerator: WorldGenerator,
    onStartNextQuest: () => void,
    onBrushModeChanged?: (active: boolean) => void,
  ) {
    this.cb = callbacks;
    this.worldGen = worldGenerator;
    this.onStartNextQuest = onStartNextQuest;
    this.onBrushModeChanged = onBrushModeChanged;
  }

  public setBrushModeChangeListener(fn: (active: boolean) => void): void {
    this.onBrushModeChanged = fn;
  }

  public openSandbox(): void {
    this.clearMeshes();
    store.state.appMode = 'SANDBOX';

    this.group.add(this.nonDrawingUIGroup);
    this.group.add(this.paintPotsGroup);
    this.group.add(this.canvasControlsGroup);
    this.group.add(this.traceGuideGroup);
    this.group.add(this.drawingsGroup);
    this.group.add(this.brushMeshGroup);

    this.airCanvasPlane = new Mesh(
      new PlaneGeometry(1.1, 0.75),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    this.airCanvasPlane.position.set(0, 0.14, 0.08);
    this.group.add(this.airCanvasPlane);

    this.buildXylophoneAndShop();
    this.buildPaintPots();
    this.build3DLightBrushMesh();
    this.buildCanvasModeControls();

    this.setFocusedCanvasMode(false);

    this.cb.setSubtitle(
      '🎨 SANDBOX — Tap Xylophone keys to play music, or tap "🖌️ Open 3D Drawing Canvas" to trace & paint!',
    );
  }

  private buildXylophoneAndShop(): void {
    const notes = [
      { freq: 523.25, color: 0xf43f5e, label: 'C' },
      { freq: 587.33, color: 0xf59e0b, label: 'D' },
      { freq: 659.25, color: 0xfacc15, label: 'E' },
      { freq: 698.46, color: 0x4ade80, label: 'F' },
      { freq: 783.99, color: 0x38bdf8, label: 'G' },
      { freq: 880.0, color: 0x818cf8, label: 'A' },
      { freq: 987.77, color: 0xc084fc, label: 'B' },
      { freq: 1046.5, color: 0xf472b6, label: 'C6' },
    ];

    notes.forEach((n, idx) => {
      const bar = new Mesh(
        new BoxGeometry(0.038, 0.015, 0.14 - idx * 0.006),
        new MeshStandardMaterial({
          color: n.color,
          emissive: n.color,
          emissiveIntensity: 0.4,
          roughness: 0.25,
        }),
      );
      bar.position.set(-0.15 + idx * 0.043, -0.19, -0.02);
      this.nonDrawingUIGroup.add(bar);

      this.cb.registerTarget(`xylo_bar_${idx}`, bar, () => {
        if (this.isHoldingBrush) return;
        store.state.telemetry.xylophoneNotesPlayed += 1;
        store.addSparks(5);
        this.cb.playChime(n.freq, 0.28);
        bar.scale.y = 1.6;
        setTimeout(() => (bar.scale.y = 1.0), 150);
      });
    });

    const openCanvasBtn = this.cb.createPillBadge(
      '🖌️ Open 3D Drawing Canvas',
      0.26,
      0.045,
      '#00f0ff',
    );
    openCanvasBtn.position.set(0.0, 0.01, 0.08);
    this.nonDrawingUIGroup.add(openCanvasBtn);
    this.cb.registerTarget('sandbox_open_canvas_btn', openCanvasBtn, () => {
      this.equipBrushToHand();
    });

    const nextQuestBtn = this.cb.createPillBadge(
      '🎯 Next Routine (+35✨) ➔',
      0.26,
      0.044,
      '#10b981',
    );
    nextQuestBtn.position.set(0.12, -0.19, 0.22);
    this.nonDrawingUIGroup.add(nextQuestBtn);
    this.cb.registerTarget('sandbox_next_quest_btn', nextQuestBtn, () => {
      if (this.isHoldingBrush) return;
      store.addSparks(35);
      this.onStartNextQuest();
    });

    UNLOCKABLE_CATALOG.filter((item) => item.propType !== 'crystal_tree')
      .slice(0, 2)
      .forEach((item, idx) => {
        const btn = this.cb.createPillBadge(
          `🎁 ${item.label} (${item.cost}✨)`,
          0.22,
          0.042,
          '#a855f7',
        );
        btn.position.set(-0.14 + idx * 0.28, 0.23, -0.06);
        this.nonDrawingUIGroup.add(btn);

        this.cb.registerTarget(`sandbox_buy_${item.propType}`, btn, () => {
          if (this.isHoldingBrush) return;
          if (store.state.lumaSparks >= item.cost) {
            store.addSparks(-item.cost);
            if (!store.state.unlockedProps.includes(item.propType)) {
              store.state.unlockedProps.push(item.propType);
              store.save();
            }
            this.worldGen.applyTheme(store.state.worldTheme);
            this.cb.playChime(783.99, 0.3);
            this.cb.setSubtitle(
              `✨ Spawned ${item.label} in your Sanctuary Sky!`,
            );
          } else {
            this.cb.playChime(320, 0.2);
            this.cb.setSubtitle(
              `Need ${item.cost}✨ Sparks! Play Xylophone or trace shapes to earn more.`,
            );
          }
        });
      });
  }

  private buildPaintPots(): void {
    const colors = [
      { id: 'cyan', hex: 0x00f0ff, border: '#00f0ff', x: -0.15 },
      { id: 'pink', hex: 0xf43f5e, border: '#f43f5e', x: -0.05 },
      { id: 'gold', hex: 0xfacc15, border: '#facc15', x: 0.05 },
      { id: 'green', hex: 0x4ade80, border: '#4ade80', x: 0.15 },
    ];

    colors.forEach((c) => {
      const pot = new Mesh(
        new CylinderGeometry(0.026, 0.022, 0.032, 20),
        new MeshStandardMaterial({
          color: c.hex,
          emissive: c.hex,
          emissiveIntensity: 0.65,
          roughness: 0.2,
        }),
      );
      pot.position.set(c.x, -0.17, 0.12);
      this.paintPotsGroup.add(pot);

      this.cb.registerTarget(`paint_pot_${c.id}`, pot, () => {
        this.activePaintHex = c.hex;
        this.endDrawingStroke();
        if (this.brushTipMesh) {
          (this.brushTipMesh.material as MeshStandardMaterial).color.setHex(
            c.hex,
          );
          (this.brushTipMesh.material as MeshStandardMaterial).emissive.setHex(
            c.hex,
          );
        }
        this.cb.playChime(659.25, 0.18);
        if (!this.isHoldingBrush) {
          this.equipBrushToHand();
        } else {
          this.cb.setSubtitle(
            '🎨 Color switched! Hold click/pinch and drag along the glowing guide path to draw!',
          );
        }
      });
    });
  }

  private buildCanvasModeControls(): void {
    const clearBtn = this.cb.createPillBadge(
      '🧹 Clear Drawing',
      0.21,
      0.048,
      '#f59e0b',
    );
    clearBtn.position.set(-0.23, -0.15, 0.22);
    clearBtn.renderOrder = 20;
    this.canvasControlsGroup.add(clearBtn);

    this.cb.registerTarget('canvas_clear_btn', clearBtn, () => {
      this.clearDrawingsOnly();
      this.rebuildTracingGuide(this.guideOrder[this.currentGuideIndex]);
      this.cb.playChime(523.25, 0.2);
      this.cb.setSubtitle(
        '🧹 Canvas cleared! Hold click/pinch and trace the glowing stars (1 ★ ➔ 5 ★)!',
      );
    });

    const nextGuideBtn = this.cb.createPillBadge(
      '✨ Change Trace Guide',
      0.22,
      0.048,
      '#a855f7',
    );
    nextGuideBtn.position.set(0.0, -0.15, 0.22);
    nextGuideBtn.renderOrder = 20;
    this.canvasControlsGroup.add(nextGuideBtn);

    this.cb.registerTarget('canvas_guide_btn', nextGuideBtn, () => {
      this.currentGuideIndex =
        (this.currentGuideIndex + 1) % this.guideOrder.length;
      const guide = this.guideOrder[this.currentGuideIndex];
      this.clearDrawingsOnly();
      this.rebuildTracingGuide(guide);
      this.cb.playChime(659.25, 0.2);
      this.cb.setSubtitle(
        guide === 'FREE'
          ? '🖌️ Free Draw Mode! Hold click/pinch and move in the air to paint anything!'
          : `✨ Tracing Guide: ${guide}! Hold click/pinch and connect the 5 glowing stars!`,
      );
    });

    const closeCanvasBtn = this.cb.createPillBadge(
      '❌ Close Canvas',
      0.21,
      0.048,
      '#ef4444',
    );
    closeCanvasBtn.position.set(0.23, -0.15, 0.22);
    closeCanvasBtn.renderOrder = 20;
    this.canvasControlsGroup.add(closeCanvasBtn);

    this.cb.registerTarget('canvas_close_btn', closeCanvasBtn, () => {
      this.closeFocusedCanvas();
    });
  }

  private build3DLightBrushMesh(): void {
    const handle = new Mesh(
      new CylinderGeometry(0.008, 0.011, 0.11, 16),
      new MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 }),
    );
    handle.rotation.x = Math.PI / 2;
    this.brushMeshGroup.add(handle);

    const ferrule = new Mesh(
      new CylinderGeometry(0.011, 0.009, 0.02, 16),
      new MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6 }),
    );
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.z = -0.06;
    this.brushMeshGroup.add(ferrule);

    this.brushTipMesh = new Mesh(
      new ConeGeometry(0.014, 0.036, 16),
      new MeshStandardMaterial({
        color: this.activePaintHex,
        emissive: this.activePaintHex,
        emissiveIntensity: 0.9,
      }),
    );
    this.brushTipMesh.rotation.x = -Math.PI / 2;
    this.brushTipMesh.position.z = -0.085;
    this.brushMeshGroup.add(this.brushTipMesh);

    this.brushMeshGroup.position.set(0.22, -0.12, 0.08);
  }

  private rebuildTracingGuide(type: TraceGuideType): void {
    while (this.traceGuideGroup.children.length > 0) {
      this.traceGuideGroup.remove(this.traceGuideGroup.children[0]);
    }
    this.checkpoints = [];

    if (type === 'FREE') return;

    const points: Vector3[] = [];
    const totalSamples = 48;

    for (let i = 0; i <= totalSamples; i++) {
      const t = i / totalSamples;
      if (type === 'INFINITY') {
        const angle = t * Math.PI * 2;
        const x = Math.sin(angle) * 0.25;
        const y = 0.13 + Math.sin(angle * 2) * 0.095;
        points.push(new Vector3(x, y, 0.08));
      } else if (type === 'WAVE') {
        const x = -0.26 + t * 0.52;
        const y = 0.13 + Math.sin(t * Math.PI * 2) * 0.09;
        points.push(new Vector3(x, y, 0.08));
      } else if (type === 'STAR') {
        const corners = [
          new Vector3(-0.22, 0.04, 0.08),
          new Vector3(-0.11, 0.22, 0.08),
          new Vector3(0.0, 0.06, 0.08),
          new Vector3(0.11, 0.22, 0.08),
          new Vector3(0.22, 0.04, 0.08),
        ];
        const seg = Math.min(3, Math.floor(t * 4));
        const localT = t * 4 - seg;
        const p = new Vector3().lerpVectors(
          corners[seg],
          corners[seg + 1],
          localT,
        );
        points.push(p);
      }
    }

    const guideMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = p1.distanceTo(p2);
      if (dist < 0.001) continue;

      const segMesh = new Mesh(
        new CylinderGeometry(0.0065, 0.0065, dist, 8),
        guideMat,
      );
      segMesh.position.copy(p1).add(p2).multiplyScalar(0.5);
      segMesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        p2.clone().sub(p1).normalize(),
      );
      this.traceGuideGroup.add(segMesh);
    }

    const checkpointIndices = [0, 12, 24, 36, 47];
    checkpointIndices.forEach((ptIdx) => {
      const pt = points[ptIdx];
      const gem = new Mesh(
        new OctahedronGeometry(0.016, 0),
        new MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.85,
        }),
      );
      gem.position.copy(pt);
      this.traceGuideGroup.add(gem);
      this.checkpoints.push({ pos: pt.clone(), mesh: gem, hit: false });
    });
  }

  private setFocusedCanvasMode(focused: boolean): void {
    this.isHoldingBrush = focused;
    this.isPressingToDraw = false;
    this.lastPaintPoint = null;

    this.nonDrawingUIGroup.visible = !focused;
    this.canvasControlsGroup.visible = focused;
    this.drawingsGroup.visible = focused;
    this.traceGuideGroup.visible = focused;
    this.brushMeshGroup.visible = focused;

    if (focused) {
      this.rebuildTracingGuide(this.guideOrder[this.currentGuideIndex]);
    } else {
      this.clearDrawingsOnly();
      while (this.traceGuideGroup.children.length > 0) {
        this.traceGuideGroup.remove(this.traceGuideGroup.children[0]);
      }
      this.brushMeshGroup.position.set(0.22, -0.12, 0.08);
      this.brushMeshGroup.rotation.set(0, 0, 0);
    }

    if (this.onBrushModeChanged) {
      this.onBrushModeChanged(focused);
    }
  }

  public equipBrushToHand(): void {
    this.setFocusedCanvasMode(true);
    this.cb.playChime(783.99, 0.25);
    this.cb.setSubtitle(
      '🖌️ FOCUSED CANVAS — Hold Click/Pinch & drag over the transparent line! (Pick Colors, Clear, or Close below)',
    );
    this.cb.speak(
      'Focused drawing canvas open! Hold and drag along the glowing guide line to paint.',
    );
  }

  public closeFocusedCanvas(): void {
    this.setFocusedCanvasMode(false);
    this.cb.playChime(523.25, 0.22);
    this.cb.setSubtitle(
      '✅ Closed Drawing Canvas! All room tables & xylophone restored cleanly.',
    );
  }

  public startDrawingStroke(localPos: Vector3): void {
    if (!this.isHoldingBrush) return;
    this.isPressingToDraw = true;
    this.lastPaintPoint = localPos.clone();
    this.addPaintSegment(localPos);
  }

  public endDrawingStroke(): void {
    this.isPressingToDraw = false;
    this.lastPaintPoint = null;
  }

  public moveBrushAndPaint(localPos: Vector3): void {
    if (!this.isHoldingBrush) return;

    this.brushMeshGroup.position.set(
      localPos.x,
      localPos.y,
      localPos.z + 0.085,
    );

    if (!this.isPressingToDraw) {
      this.lastPaintPoint = null;
      return;
    }

    this.addPaintSegment(localPos);
  }

  private addPaintSegment(pos: Vector3): void {
    this.checkpoints.forEach((cp, idx) => {
      if (!cp.hit && cp.pos.distanceTo(pos) < 0.048) {
        cp.hit = true;
        const mat = cp.mesh.material as MeshStandardMaterial;
        mat.color.setHex(0xfacc15);
        mat.emissive.setHex(0xeab308);
        cp.mesh.scale.setScalar(1.4);
        store.addSparks(5);
        this.cb.playChime(523.25 + idx * 80, 0.18);

        if (this.checkpoints.every((c) => c.hit)) {
          store.addSparks(20);
          this.cb.playChime(880, 0.35);
          this.cb.setSubtitle(
            '🌟 AMAZING MOTOR CONTROL! You traced the entire shape (+20✨ Sparks)! Tap "✨ Change Trace Guide" for a new shape!',
          );
          this.cb.speak('Amazing tracing! You connected all five stars!');
        }
      }
    });

    if (!this.lastPaintPoint) {
      this.lastPaintPoint = pos.clone();
      return;
    }

    const dist = this.lastPaintPoint.distanceTo(pos);
    if (dist < 0.004) return;
    if (dist > 0.18) {
      this.lastPaintPoint.copy(pos);
      return;
    }

    const tube = new Mesh(
      new CylinderGeometry(0.0075, 0.0075, dist, 10),
      new MeshStandardMaterial({
        color: this.activePaintHex,
        emissive: this.activePaintHex,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
    );

    const mid = this.lastPaintPoint.clone().add(pos).multiplyScalar(0.5);
    tube.position.copy(mid);
    tube.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      pos.clone().sub(this.lastPaintPoint).normalize(),
    );

    const joint = new Mesh(
      new SphereGeometry(0.0075, 8, 8),
      tube.material,
    );
    joint.position.copy(pos);

    this.drawingsGroup.add(tube, joint);
    this.lastPaintPoint.copy(pos);
  }

  public clearDrawingsOnly(): void {
    while (this.drawingsGroup.children.length > 0) {
      this.drawingsGroup.remove(this.drawingsGroup.children[0]);
    }
    this.lastPaintPoint = null;
  }

  public clearRoomProps(): void {
    this.clearDrawingsOnly();
    store.state.unlockedProps = [];
    store.save();
    this.worldGen.applyTheme(store.state.worldTheme);
    this.cb.playChime(440, 0.2);
  }

  public clearMeshes(): void {
    this.isHoldingBrush = false;
    this.isPressingToDraw = false;
    this.lastPaintPoint = null;
    if (this.onBrushModeChanged) {
      this.onBrushModeChanged(false);
    }
    while (this.nonDrawingUIGroup.children.length > 0) {
      this.nonDrawingUIGroup.remove(this.nonDrawingUIGroup.children[0]);
    }
    while (this.paintPotsGroup.children.length > 0) {
      this.paintPotsGroup.remove(this.paintPotsGroup.children[0]);
    }
    while (this.canvasControlsGroup.children.length > 0) {
      this.canvasControlsGroup.remove(this.canvasControlsGroup.children[0]);
    }
    while (this.traceGuideGroup.children.length > 0) {
      this.traceGuideGroup.remove(this.traceGuideGroup.children[0]);
    }
    while (this.drawingsGroup.children.length > 0) {
      this.drawingsGroup.remove(this.drawingsGroup.children[0]);
    }
    while (this.brushMeshGroup.children.length > 0) {
      this.brushMeshGroup.remove(this.brushMeshGroup.children[0]);
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }

  public update(delta: number, time: number): void {
    this.checkpoints.forEach((cp, idx) => {
      if (!cp.hit) {
        const s = 1.0 + Math.sin(time * 4.0 + idx) * 0.15;
        cp.mesh.scale.setScalar(s);
        cp.mesh.rotation.y = time * 1.8;
      }
    });
  }
}