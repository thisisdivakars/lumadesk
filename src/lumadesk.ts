import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  createSystem,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { SandboxBuilderModule } from './modules/sandbox-builder.js';
import {
  CLINICAL_QUESTS,
  StageCallbacks,
  TherapyQuestModule,
} from './modules/therapy-quests.js';
import { WitVoiceController } from './modules/wit-voice.js';
import { KanbanTask, store, TherapyStage, WorldThemeId } from './state/store.js';
import { DevInspectorUI } from './ui/dev-inspector.js';
import { WorldGenerator } from './worlds/world-generator.js';

interface InteractiveTarget {
  id: string;
  mesh: Mesh | Group;
  baseScale: number;
  onTrigger: () => void;
}

interface SkyBird {
  group: Group;
  leftWing: Group;
  rightWing: Group;
  phaseOffset: number;
  speed: number;
  radiusX: number;
  baseY: number;
  baseZ: number;
}

const STICKY_NOTE_IDEAS = [
  'Put charger in bag',
  'Stretch arms & back',
  'Check tomorrow schedule',
  'Put shoes by door',
  'Tidy 3 items on desk',
  'Pack water bottle',
];

export class LumaDeskSystem extends createSystem({}) {
  private deskRoot = new Group();
  private deskPositioned = false;
  private xrRaysAttached = false;

  private worldGenerator!: WorldGenerator;
  private questModule!: TherapyQuestModule;
  private sandboxModule!: SandboxBuilderModule;
  private inspectorUI!: DevInspectorUI;
  private witVoice!: WitVoiceController;

  private lumaGroup = new Group();
  private lumaBodyMesh!: Mesh;
  private lumaHaloMesh!: Mesh;
  private subtitleMesh!: Mesh;
  private centerTableMesh!: Mesh;

  // Left-Side World Theme Orbs + 3D House MR Passthrough Switch Group
  private worldOrbsGroup = new Group();

  // 3D Visual ADHD Focus Timer Station (Anchored at Front-Left Rim — Zero Overlap!)
  private focusTimerGroup = new Group();
  private focusTimerBadge!: Mesh;
  private focusTimerArcMesh!: Mesh;
  private focusTimerActive = false;
  private focusTimerTotalSec = 120;
  private focusTimerRemainingSec = 120;
  private focusTimerLastBadgeSec = -1;

  private activeHitCursorDot!: Mesh;
  private lastRightRayPos = new Vector3();
  private lastLeftRayPos = new Vector3();
  private activeXRHandSide: 'left' | 'right' | 'none' = 'none';
  private xrHandActiveUntil = 0;

  // Stationary Neon Liquid-Plasma Voice Orb
  private witPlasmaOrbGroup = new Group();
  private plasmaCyanShell!: Mesh;
  private plasmaPinkShell!: Mesh;
  private plasmaWaveRing1!: Mesh;
  private plasmaWaveRing2!: Mesh;
  private plasmaPulseActiveUntil = 0;

  private savedSceneBackground: any = null;

  // Flock of 4 Colorful Ambient Sky Birds
  private skyBirds: SkyBird[] = [];

  private weatherHoloGroup = new Group();
  private forceShowLeftUntil = 0;

  // Center Table Stations: Hydration Pitcher & Safe Meal Plate
  private waterStation = new Group();
  private waterFillMesh!: Mesh;
  private waterLabelMesh!: Mesh;
  private mealPlateGroup = new Group();
  private mealLabelMesh!: Mesh;
  private hydrationAlertMesh: Mesh | null = null;

  // Left-Wing 3D Kanban Productivity Board (TO-DO / DOING / DONE) + Daily Contexts
  private leftTimelineTable = new Group();
  private leftHeaderMesh!: Mesh;
  private leftAddBtnMesh!: Mesh;
  private timelineCardsGroup = new Group();
  private kanbanBoardGroup = new Group();
  private stickyNotesGroup = new Group();
  private stickyIdeaIdx = 0;

  // Right-Wing Botanical Garden Table
  private rightGardenTable = new Group();
  private gardenPotsGroup = new Group();
  private gardenPotTags: Mesh[] = [];
  private seedPlateGroup = new Group();
  private seedBadgeMesh!: Mesh;
  private wateringCanGroup = new Group();
  private wateringCanBadgeMesh!: Mesh;
  private waterDropsGroup = new Group();
  private birthdayBannerMesh!: Mesh;
  private gardenCoachMesh!: Mesh;

  private heldTool: 'NONE' | 'SEED' | 'WATERING_CAN' = 'NONE';
  private heldSeedMesh!: Mesh;
  private wateringCanHomePos = new Vector3(0.22, -0.12, 0.16);
  private potLocalPositions: Vector3[] = [
    new Vector3(-0.15, -0.17, -0.06),
    new Vector3(0.0, -0.17, -0.09),
    new Vector3(0.15, -0.17, -0.06),
    new Vector3(-0.14, -0.17, -0.06),
    new Vector3(0.0, -0.17, -0.06),
    new Vector3(0.14, -0.17, -0.06),
  ];
  private lastWateredPodTime: number[] = [0, 0, 0, 0, 0, 0];

  private targets: InteractiveTarget[] = [];
  private hoveredTarget: InteractiveTarget | null = null;
  private raycaster = new Raycaster();
  private mouseNDC = new Vector2(0, 0);
  private brushLocalPos = new Vector3();
  private rightHandObj: Object3D | null = null;
  private lastHandWorldPos = new Vector3();
  private handWorldPos = new Vector3();
  private lastTriggerTime = 0;
  private audioCtx: AudioContext | null = null;
  private tempVec = new Vector3();

  init(): void {
    store.state.unlockedProps = (store.state.unlockedProps || []).filter(
      (id: string) => id !== 'crystal_tree',
    );
    store.save();

    if (!store.state.kanbanTasks || store.state.kanbanTasks.length === 0) {
      store.state.kanbanTasks = [
        { id: 'k1', title: 'Pack drawing pad', status: 'todo' },
        { id: 'k2', title: 'Read 3 lines of book', status: 'doing' },
        { id: 'k3', title: 'Drink morning water', status: 'done' },
      ];
    }

    this.world.scene.traverse((child: any) => {
      if (
        child.parent === this.world.scene &&
        child !== this.deskRoot &&
        child !== this.player &&
        !child.isLight &&
        !child.name?.toLowerCase().includes('hand') &&
        !child.name?.toLowerCase().includes('controller') &&
        !child.name?.toLowerCase().includes('player') &&
        !child.name?.toLowerCase().includes('camera') &&
        !child.name?.toLowerCase().includes('origin')
      ) {
        child.visible = false;
      }
    });

    this.worldGenerator = new WorldGenerator();
    this.deskRoot.add(this.worldGenerator.root);

    this.deskRoot.name = 'LumaSanctuaryRoot';
    this.deskRoot.position.set(0, 1.42, 0.38);
    this.world.scene.add(this.deskRoot);

    this.buildSanctuaryTable();
    this.buildLumaCompanionPet();
    this.build3DVisualADHDFocusTimer();
    this.buildStationaryNeonPlasmaVoiceOrb();
    this.buildFlockOfColorfulSkyBirds();
    this.buildWorldThemeOrbsOnLeft();
    this.buildHydrationPitcherStation();
    this.buildMealNourishStation();
    this.buildLeftWingTimelineAndStickyTable();
    this.buildRightSideGardenTable();

    this.activeHitCursorDot = new Mesh(
      new SphereGeometry(0.008, 16, 16),
      new MeshBasicMaterial({
        color: 0xfacc15,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.activeHitCursorDot.renderOrder = 999;
    this.activeHitCursorDot.visible = false;
    this.world.scene.add(this.activeHitCursorDot);

    store.subscribe(() => {
      this.updateBirthdayBanner();
    });

    const startNextQuest = () => {
      store.state.activeQuestIndex =
        (store.state.activeQuestIndex + 1) % CLINICAL_QUESTS.length;
      this.rebuildTimelineCards();
      this.jumpToTherapyStage('STAGE_1_MOTOR_POP');
    };

    const callbacks: StageCallbacks = {
      registerTarget: (id, mesh, fn) => this.registerTarget(id, mesh, fn),
      unregisterTarget: (id) => this.unregisterTarget(id),
      clearStageTargets: () => this.clearDynamicTargets(),
      setSubtitle: (text) => this.setSubtitle(text),
      speak: (text) => this.speak(text),
      playChime: (freq, dur = 0.25) => this.playChime(freq, dur),
      createPillBadge: (text, w, h, borderHex) =>
        this.createCleanPillBadge(text, w, h, borderHex),
      setLumaMood: (mood) => this.setLumaMood(mood),
      onEveningDimChanged: (dimmed) =>
        this.worldGenerator.setEveningDimMode(dimmed),
      onMorningWaterReset: () => this.resetWaterForNewMorning(),
      onTriggerHydrationAlert: () => this.showMidQuestHydrationAlert(),
      onQuestCompleted: () => {
        store.state.completedContexts[store.state.activeQuestIndex] = true;
        store.save();
        this.rebuildTimelineCards();
        this.rebuildSeedPlate();
        this.sandboxModule.openSandbox();
      },
    };

    this.questModule = new TherapyQuestModule(callbacks);
    this.sandboxModule = new SandboxBuilderModule(
      callbacks,
      this.worldGenerator,
      startNextQuest,
      (canvasActive: boolean) => {
        this.setIsolatedDrawingCanvasUI(canvasActive);
      },
    );

    this.deskRoot.add(this.questModule.group);
    this.deskRoot.add(this.sandboxModule.group);

    this.inspectorUI = new DevInspectorUI({
      onSelectWorld: (theme) => this.switchWorldTheme(theme),
      onTogglePassthrough: () => this.toggleMixedRealityPassthrough(),
      onJumpToStage: (stage) => this.jumpToTherapyStage(stage),
      onOpenSandbox: () => {
        this.questModule.clearMeshes();
        this.sandboxModule.openSandbox();
      },
      onAdvanceStep: () => this.advanceActiveExperience(),
      onDrinkWater: () => this.handleDrinkWater(),
      onLogMeal: () => this.handleLogMeal(),
      onGrowGarden: () => this.handleAutoPlantOrWater(),
      onClearRoom: () => this.sandboxModule.clearRoomProps(),
      onNextQuest: startNextQuest,
      onTriggerWitVoice: (customUtterance) => {
        this.plasmaPulseActiveUntil = performance.now() + 3500;
        this.witVoice.startListeningOrCycleDemo(customUtterance);
      },
      onProfileSaved: () => {
        this.updateBirthdayBanner();
        const nick = store.state.profile.nickname;
        const bday = store.getDaysUntilBirthday();
        this.setSubtitle(
          `👉 Welcome, ${nick}! 🎂 ${bday} days until your birthday! Tap the 4 shapes to start.`,
        );
        this.speak(
          `Welcome ${nick}! Only ${bday} days until your birthday! Let's play.`,
        );
      },
    });

    this.witVoice = new WitVoiceController({
      onPinCustomSticky: (noteText) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        const cleanTitle = noteText.replace(/^📌\s*/, '').slice(0, 22);
        store.state.kanbanTasks.unshift({
          id: `wit_${Date.now()}`,
          title: cleanTitle,
          status: 'todo',
        });
        store.addSparks(10);
        this.rebuildStickyNotes();
        this.forceShowLeftUntil = performance.now() + 10000;
        this.playChime(659.25, 0.25);
        this.setSubtitle(
          `🎙️ Wit.ai added "${cleanTitle}" to 🔴 TO-DO on your Left Kanban Board (+10✨)!`,
        );
        this.speak(`Added ${cleanTitle} to your To-Do column!`);
      },
      onChunkBigTask: (taskTitle, steps) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        store.state.kanbanTasks = [
          {
            id: `c1_${Date.now()}`,
            title: steps[0].replace(/^📌\s*/, ''),
            status: 'doing',
          },
          {
            id: `c2_${Date.now()}`,
            title: steps[1].replace(/^📌\s*/, ''),
            status: 'todo',
          },
          {
            id: `c3_${Date.now()}`,
            title: steps[2].replace(/^📌\s*/, ''),
            status: 'todo',
          },
        ];
        store.addSparks(15);
        this.rebuildStickyNotes();
        this.startOrCycleFocusTimer(120);
        this.forceShowLeftUntil = performance.now() + 12000;
        this.playChime(783.99, 0.3);
        this.setSubtitle(
          `🧩 Wit.ai split "${taskTitle}" into 🔴 TO-DO & 🟡 DOING + started 2-Min Focus Timer (+15✨)!`,
        );
        this.speak(
          `I broke ${taskTitle} into three tiny steps and started your 2 minute focus timer!`,
        );
      },
      onShowWeatherHologram: (report) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        store.addSparks(10);
        this.spawn3DWeatherSensoryHologram(
          report.tempC,
          report.condition,
          report.headline,
          report.sensoryOutfitTip,
        );
      },
      onTriggerSensorySOS: () => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.worldGenerator.setEveningDimMode(true);
        this.jumpToTherapyStage('STAGE_2_BREATH_SYNC');
        this.playChime(432, 0.45);
        this.setSubtitle(
          '🛡️ Wit.ai Sensory SOS: Dimmed lights & started Calm Breath Sync. You are safe!',
        );
        this.speak(
          'Sensory shield activated. I dimmed the lights. Let us take three slow breaths together.',
        );
      },
      onDrinkWater: (cups) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        for (let i = 0; i < cups; i++) this.handleDrinkWater();
      },
      onLogMeal: () => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.handleLogMeal();
      },
      onWaterGarden: () => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.handleAutoPlantOrWater();
      },
      onSwitchWorld: (theme) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.switchWorldTheme(theme);
      },
      onDimLights: (dimmed) => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.worldGenerator.setEveningDimMode(dimmed);
        this.setSubtitle(
          '🌙 Wit.ai Sensory Shield: Dimmed room lights into soothing Night Mode!',
        );
        this.speak('Dimming the room lights for sensory comfort.');
      },
      onOpen3DBrush: () => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.questModule.clearMeshes();
        this.sandboxModule.openSandbox();
        this.sandboxModule.equipBrushToHand();
      },
      onAdvanceStep: () => {
        store.state.telemetry.witVoiceCommands =
          (store.state.telemetry.witVoiceCommands || 0) + 1;
        this.advanceActiveExperience();
      },
      onShowTelemetry: (summary) => {
        this.inspectorUI.showWitTelemetry(summary);
      },
    });

    this.worldGenerator.applyTheme(store.state.worldTheme);
    this.removeWhiteCrystalRingsFromSky();
    this.jumpToTherapyStage('STAGE_1_MOTOR_POP');

    window.addEventListener('pointermove', (e: PointerEvent) => {
      this.activeXRHandSide = 'none';
      if (document.pointerLockElement) {
        this.mouseNDC.x = Math.max(
          -0.95,
          Math.min(0.95, this.mouseNDC.x + e.movementX * 0.0025),
        );
        this.mouseNDC.y = Math.max(
          -0.95,
          Math.min(0.95, this.mouseNDC.y - e.movementY * 0.0025),
        );
      } else {
        this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }

      if (this.heldTool !== 'NONE') {
        this.updateHeldGardenToolPosition();
      }
    });

    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if (
        (e.target as HTMLElement)?.closest('#lumadesk-hud') ||
        (e.target as HTMLElement)?.closest('#parent-signup-modal') ||
        (e.target as HTMLElement)?.closest('#close-clinical-modal-container')
      ) {
        return;
      }

      if (!document.pointerLockElement) {
        this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }

      const hit = this.findHitTarget();
      if (hit) {
        this.triggerWithCooldown(hit.onTrigger);
      } else if (
        store.state.appMode === 'SANDBOX' &&
        this.sandboxModule.isHoldingBrush &&
        this.sandboxModule.airCanvasPlane
      ) {
        const planeHits = this.raycaster.intersectObject(
          this.sandboxModule.airCanvasPlane,
          false,
        );
        if (planeHits.length > 0) {
          this.brushLocalPos.copy(planeHits[0].point);
          this.sandboxModule.group.worldToLocal(this.brushLocalPos);
          this.sandboxModule.startDrawingStroke(this.brushLocalPos);
        } else {
          this.computeBrushLocalPos();
          this.sandboxModule.startDrawingStroke(this.brushLocalPos);
        }
      } else if (this.hoveredTarget) {
        this.triggerWithCooldown(this.hoveredTarget.onTrigger);
      } else if (this.heldTool !== 'NONE') {
        this.releaseHeldGardenTool();
      } else if (
        store.state.appMode === 'QUEST' &&
        store.state.currentStage === 'STAGE_2_BREATH_SYNC'
      ) {
        this.triggerWithCooldown(() => this.questModule.triggerBreathPulse());
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.sandboxModule?.isHoldingBrush) {
        this.sandboxModule.endDrawingStroke();
      }
      if (this.heldTool === 'WATERING_CAN') {
        setTimeout(() => {
          if (this.heldTool === 'WATERING_CAN') {
            this.releaseHeldGardenTool();
          }
        }, 600);
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === ' ') {
        this.triggerWithCooldown(() => this.advanceActiveExperience());
      } else if (e.key.toLowerCase() === 'v') {
        this.plasmaPulseActiveUntil = performance.now() + 3500;
        this.witVoice.startListeningOrCycleDemo();
      } else if (e.key.toLowerCase() === 'p') {
        this.toggleMixedRealityPassthrough();
      } else if (e.key.toLowerCase() === 't') {
        this.startOrCycleFocusTimer();
      } else if (
        e.key.toLowerCase() === 'f' ||
        e.key === '\\' ||
        e.key === 'Enter'
      ) {
        const hit = this.findHitTarget();
        if (hit) {
          this.triggerWithCooldown(hit.onTrigger);
        } else if (
          store.state.appMode === 'SANDBOX' &&
          this.sandboxModule.isHoldingBrush &&
          this.sandboxModule.airCanvasPlane
        ) {
          if (this.sandboxModule.isPressingToDraw) {
            this.sandboxModule.endDrawingStroke();
          } else {
            const planeHits = this.raycaster.intersectObject(
              this.sandboxModule.airCanvasPlane,
              false,
            );
            if (planeHits.length > 0) {
              this.brushLocalPos.copy(planeHits[0].point);
              this.sandboxModule.group.worldToLocal(this.brushLocalPos);
              this.sandboxModule.startDrawingStroke(this.brushLocalPos);
            }
          }
        } else if (this.hoveredTarget) {
          this.triggerWithCooldown(this.hoveredTarget.onTrigger);
        }
      }
    });
  }

  private setIsolatedDrawingCanvasUI(isolated: boolean): void {
    this.leftTimelineTable.visible = !isolated;
    this.rightGardenTable.visible = !isolated;
    this.waterStation.visible = !isolated;
    this.mealPlateGroup.visible = !isolated;
    this.witPlasmaOrbGroup.visible = !isolated;
    this.lumaGroup.visible = !isolated;
    this.focusTimerGroup.visible = !isolated;
    this.worldOrbsGroup.visible = !isolated;

    const hud = document.getElementById('lumadesk-hud');
    if (hud) {
      hud.style.display = isolated ? 'none' : 'flex';
    }
  }

  private removeWhiteCrystalRingsFromSky(): void {
    store.state.unlockedProps = (store.state.unlockedProps || []).filter(
      (id: string) => id !== 'crystal_tree',
    );
    const propsGroup = (this.worldGenerator as any).propsGroup as
      | Group
      | undefined;
    if (propsGroup) {
      for (let i = propsGroup.children.length - 1; i >= 0; i--) {
        const child = propsGroup.children[i];
        if (child.position.x < -0.5) {
          propsGroup.remove(child);
        }
      }
    }
  }

  private build3DVisualADHDFocusTimer(): void {
    this.focusTimerGroup = new Group();
    this.focusTimerGroup.position.set(-0.18, -0.19, 0.22);

    this.focusTimerArcMesh = new Mesh(
      new RingGeometry(0.365, 0.382, 64, 1, 0, Math.PI * 2),
      new MeshBasicMaterial({
        color: 0x10b981,
        side: DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.focusTimerArcMesh.rotation.x = -Math.PI / 2;
    this.focusTimerArcMesh.position.set(0.18, -0.01, -0.22);
    this.focusTimerArcMesh.visible = false;
    this.focusTimerGroup.add(this.focusTimerArcMesh);

    this.focusTimerBadge = this.createCleanPillBadge(
      '⏱️ 2-Min Focus Sprint (+25✨)',
      0.22,
      0.042,
      '#10b981',
    );
    this.focusTimerBadge.renderOrder = 12;
    this.focusTimerGroup.add(this.focusTimerBadge);

    this.deskRoot.add(this.focusTimerGroup);

    this.registerTarget('permanent_focus_timer_btn', this.focusTimerBadge, () => {
      this.startOrCycleFocusTimer();
    });
  }

  private startOrCycleFocusTimer(customSeconds?: number): void {
    if (customSeconds) {
      this.focusTimerTotalSec = customSeconds;
      this.focusTimerRemainingSec = customSeconds;
      this.focusTimerActive = true;
    } else if (!this.focusTimerActive) {
      this.focusTimerTotalSec = 120;
      this.focusTimerRemainingSec = 120;
      this.focusTimerActive = true;
    } else if (this.focusTimerTotalSec === 120) {
      this.focusTimerTotalSec = 300;
      this.focusTimerRemainingSec = 300;
      this.focusTimerActive = true;
    } else {
      this.focusTimerActive = false;
      this.focusTimerArcMesh.visible = false;
      this.refreshFocusTimerBadge('⏱️ 2-Min Focus Sprint (+25✨)', '#10b981');
      this.playChime(440, 0.18);
      this.setSubtitle('⏹️ Focus Timer paused. Tap anytime to start a 2-Min Focus Sprint!');
      return;
    }

    this.focusTimerArcMesh.visible = true;
    this.focusTimerLastBadgeSec = -1;
    const mins = Math.round(this.focusTimerTotalSec / 60);
    const doingTask =
      (store.state.kanbanTasks || []).find(
        (t: KanbanTask) => t.status === 'doing',
      )?.title || 'Current Task';

    this.playChime(659.25, 0.25);
    this.setSubtitle(
      `⏱️ ${mins}-Min ADHD Focus Sprint Started for "${doingTask}"! Watch the glowing table ring!`,
    );
    this.speak(`${mins} minute focus sprint started for ${doingTask}!`);
  }

  private refreshFocusTimerBadge(label: string, borderHex: string): void {
    if (this.focusTimerBadge) {
      this.focusTimerGroup.remove(this.focusTimerBadge);
    }
    this.focusTimerBadge = this.createCleanPillBadge(
      label,
      0.22,
      0.042,
      borderHex,
    );
    this.focusTimerBadge.renderOrder = 12;
    this.focusTimerGroup.add(this.focusTimerBadge);
    this.registerTarget('permanent_focus_timer_btn', this.focusTimerBadge, () => {
      this.startOrCycleFocusTimer();
    });
  }

  private updateFocusTimer(delta: number): void {
    if (!this.focusTimerActive) return;

    this.focusTimerRemainingSec = Math.max(
      0,
      this.focusTimerRemainingSec - delta,
    );

    const ratio =
      this.focusTimerRemainingSec / Math.max(1, this.focusTimerTotalSec);

    this.focusTimerArcMesh.geometry.dispose();
    this.focusTimerArcMesh.geometry = new RingGeometry(
      0.362,
      0.382,
      64,
      1,
      Math.PI / 2,
      Math.max(0.05, ratio * Math.PI * 2),
    );
    const arcMat = this.focusTimerArcMesh.material as MeshBasicMaterial;
    if (ratio > 0.5) arcMat.color.setHex(0x00f0ff);
    else if (ratio > 0.2) arcMat.color.setHex(0xfbbf24);
    else arcMat.color.setHex(0x10b981);

    const wholeSec = Math.ceil(this.focusTimerRemainingSec);
    if (wholeSec !== this.focusTimerLastBadgeSec) {
      this.focusTimerLastBadgeSec = wholeSec;
      const m = Math.floor(wholeSec / 60)
        .toString()
        .padStart(2, '0');
      const s = (wholeSec % 60).toString().padStart(2, '0');
      const doingTask =
        (store.state.kanbanTasks || []).find(
          (t: KanbanTask) => t.status === 'doing',
        )?.title || 'Focus Sprint';
      this.refreshFocusTimerBadge(
        `⏱️ ${m}:${s} • ${doingTask.slice(0, 14)}`,
        ratio > 0.2 ? '#00f0ff' : '#fbbf24',
      );
    }

    if (this.focusTimerRemainingSec <= 0) {
      this.focusTimerActive = false;
      this.focusTimerArcMesh.visible = false;
      store.addSparks(25);
      store.state.gardenSeeds += 1;
      store.save();
      this.rebuildSeedPlate();
      this.setLumaMood('happy');
      this.refreshFocusTimerBadge(
        '🎉 Sprint Done! Tap for Next (+25✨)',
        '#fbbf24',
      );
      this.playChime(880, 0.4);
      this.setSubtitle(
        '🎉 FOCUS SPRINT COMPLETE! You earned +25✨ Sparks & +1🌱 Garden Seed!',
      );
      this.speak(
        'Focus sprint complete! Amazing concentration! You earned 25 sparks and a new garden seed.',
      );
    }
  }

  private attachOfficialXRRayLinesIfReady(): void {
    const xrSession = (this.world as any).renderer?.xr?.getSession?.();
    if (xrSession && !(xrSession as any).__lumaSelectBound) {
      (xrSession as any).__lumaSelectBound = true;
      const onXRPinchOrTrigger = (ev: any) => {
        const handedness = ev?.inputSource?.handedness;
        if (handedness === 'left' || handedness === 'right') {
          this.activeXRHandSide = handedness;
          this.xrHandActiveUntil = performance.now() + 5000;
        }
        const hit = this.findHitTarget();
        if (hit) {
          this.triggerWithCooldown(hit.onTrigger);
        } else if (
          store.state.appMode === 'SANDBOX' &&
          this.sandboxModule.isHoldingBrush &&
          this.sandboxModule.airCanvasPlane
        ) {
          const planeHits = this.raycaster.intersectObject(
            this.sandboxModule.airCanvasPlane,
            false,
          );
          if (planeHits.length > 0) {
            this.brushLocalPos.copy(planeHits[0].point);
            this.sandboxModule.group.worldToLocal(this.brushLocalPos);
            this.sandboxModule.startDrawingStroke(this.brushLocalPos);
          }
        } else if (this.hoveredTarget) {
          this.triggerWithCooldown(this.hoveredTarget.onTrigger);
        } else if (this.heldTool !== 'NONE') {
          this.releaseHeldGardenTool();
        }
      };
      const onXRRelease = () => {
        if (this.sandboxModule?.isHoldingBrush) {
          this.sandboxModule.endDrawingStroke();
        }
      };
      xrSession.addEventListener('selectstart', onXRPinchOrTrigger);
      xrSession.addEventListener('squeezestart', onXRPinchOrTrigger);
      xrSession.addEventListener('selectend', onXRRelease);
      xrSession.addEventListener('squeezeend', onXRRelease);
    }

    if (this.xrRaysAttached) return;
    const origin = (this.world as any).input?.xr?.xrOrigin;
    if (!origin?.raySpaces?.right || !origin?.raySpaces?.left) return;

    this.xrRaysAttached = true;

    const createRayLine = (side: 'left' | 'right'): Group => {
      const rayGroup = new Group();
      rayGroup.name = `luma_xr_ray_${side}`;

      const beamGeo = new CylinderGeometry(0.0012, 0.002, 1.0, 8);
      beamGeo.rotateX(Math.PI / 2);
      beamGeo.translate(0, 0, -0.5);

      const beamMesh = new Mesh(
        beamGeo,
        new MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        }),
      );
      beamMesh.name = 'ray_beam';
      beamMesh.scale.set(1, 1, 0.55);
      rayGroup.add(beamMesh);

      const tipDot = new Mesh(
        new SphereGeometry(0.0065, 14, 14),
        new MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.98,
          depthTest: false,
          depthWrite: false,
        }),
      );
      tipDot.name = 'ray_tip';
      tipDot.renderOrder = 999;
      tipDot.position.set(0, 0, -0.55);
      rayGroup.add(tipDot);

      return rayGroup;
    };

    origin.raySpaces.left.add(createRayLine('left'));
    origin.raySpaces.right.add(createRayLine('right'));
  }

  private toggleMixedRealityPassthrough(): void {
    store.state.passthroughActive = !store.state.passthroughActive;
    const active = store.state.passthroughActive;

    // 1. Hide/Show the 360° Virtual Sky Dome
    this.worldGenerator.root.visible = !active;

    // 2. Make the Center Table Surface hollow in MR so the child sees their REAL notebook & desk inside the glowing rim!
    if (this.centerTableMesh) {
      this.centerTableMesh.visible = !active;
    }

    // 3. Hide ambient sky birds and center-table mini-game shapes in MR so the real-world study space is 100% clutter-free!
    this.skyBirds.forEach((b) => {
      b.group.visible = !active;
    });
    if (this.questModule?.group) {
      this.questModule.group.visible = !active;
    }
    if (this.sandboxModule?.group && !this.sandboxModule.isHoldingBrush) {
      this.sandboxModule.group.visible = !active;
    }

    // 4. Hide the 4 VR theme orbs in MR, keeping ONLY the 3D House Icon & MR switch button visible!
    this.targets.forEach((t) => {
      if (
        t.id.startsWith('permanent_world_') &&
        !t.id.includes('_mr')
      ) {
        t.mesh.visible = !active;
      }
    });

    if (active) {
      this.savedSceneBackground = this.world.scene.background;
      this.world.scene.background = null;
      document.body.style.background = 'transparent';

      // Keep Left Kanban Board & Right Garden visible at a clean peripheral angle
      this.forceShowLeftUntil = performance.now() + 600000;

      // Auto-start the 2-Min Visual Focus Timer Ring around their real-world desk if not already running!
      if (!this.focusTimerActive) {
        this.startOrCycleFocusTimer(120);
      }

      this.playChime(587.33, 0.25);
      this.setSubtitle(
        '🏠 MR STUDY COCKPIT: Center desk cleared for your real notebook! Kanban, Timer Ring & Wit.ai active.',
      );
      this.speak(
        'Mixed reality study mode active. Your center desk is clear for your real notebook, and your focus timer is running!',
      );
    } else {
      if (this.savedSceneBackground) {
        this.world.scene.background = this.savedSceneBackground;
      }
      this.forceShowLeftUntil = 0;
      this.worldGenerator.applyTheme(store.state.worldTheme);
      this.removeWhiteCrystalRingsFromSky();
      this.playChime(523.25, 0.25);
      this.setSubtitle(
        `🌍 Returned to 360° ${store.state.worldTheme.toUpperCase()} Sanctuary Dome! All 3D stages restored.`,
      );
      this.speak(`Returned to ${store.state.worldTheme} sanctuary.`);
    }
  }

  private buildStationaryNeonPlasmaVoiceOrb(): void {
    this.witPlasmaOrbGroup = new Group();
    this.witPlasmaOrbGroup.position.set(0.45, 0.11, 0.12);
    this.witPlasmaOrbGroup.rotation.y = -0.35;

    const voidCore = new Mesh(
      new SphereGeometry(0.042, 48, 48),
      new MeshBasicMaterial({
        color: 0x070312,
      }),
    );
    this.witPlasmaOrbGroup.add(voidCore);

    const plasmaTex1 = this.createPlasmaOrbTexture(false);
    this.plasmaCyanShell = new Mesh(
      new SphereGeometry(0.046, 48, 48),
      new MeshBasicMaterial({
        map: plasmaTex1,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    );
    this.witPlasmaOrbGroup.add(this.plasmaCyanShell);

    const plasmaTex2 = this.createPlasmaOrbTexture(true);
    this.plasmaPinkShell = new Mesh(
      new SphereGeometry(0.049, 48, 48),
      new MeshBasicMaterial({
        map: plasmaTex2,
        transparent: true,
        opacity: 0.75,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    this.witPlasmaOrbGroup.add(this.plasmaPinkShell);

    const rimTex = this.createFresnelRimTexture();
    this.plasmaWaveRing1 = new Mesh(
      new PlaneGeometry(0.118, 0.118),
      new MeshBasicMaterial({
        map: rimTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    this.plasmaWaveRing1.position.set(0, 0, 0.01);
    this.witPlasmaOrbGroup.add(this.plasmaWaveRing1);

    this.plasmaWaveRing2 = new Mesh(
      new PlaneGeometry(0.128, 0.128),
      new MeshBasicMaterial({
        map: rimTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.plasmaWaveRing2.position.set(0, 0, 0.005);
    this.witPlasmaOrbGroup.add(this.plasmaWaveRing2);

    const orbBadge = this.createCleanPillBadge(
      '🎙️ Speak to Luma (Wit.ai)',
      0.22,
      0.046,
      '#00f0ff',
    );
    orbBadge.position.set(0, 0.096, 0.025);
    orbBadge.renderOrder = 10;
    this.witPlasmaOrbGroup.add(orbBadge);

    const hitSphere = new Mesh(
      new SphereGeometry(0.062, 16, 16),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    this.witPlasmaOrbGroup.add(hitSphere);

    this.deskRoot.add(this.witPlasmaOrbGroup);
    this.deskRoot.add(this.weatherHoloGroup);

    const triggerVoiceFn = () => {
      this.playChime(659.25, 0.22);
      this.plasmaPulseActiveUntil = performance.now() + 3500;
      this.witPlasmaOrbGroup.scale.setScalar(1.25);
      setTimeout(() => this.witPlasmaOrbGroup.scale.setScalar(1.0), 320);
      this.witVoice.startListeningOrCycleDemo();
    };

    this.registerTarget('permanent_wit_plasma_orb', hitSphere, triggerVoiceFn);
    this.registerTarget('permanent_wit_plasma_badge', orbBadge, triggerVoiceFn);
  }

  private createPlasmaOrbTexture(secondaryLayer: boolean): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    bgGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.18)');
    bgGrad.addColorStop(1, 'rgba(244, 63, 94, 0.48)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    for (let w = 0; w < 14; w++) {
      ctx.beginPath();
      const isCyanSide = w % 2 === 0;
      ctx.strokeStyle = isCyanSide
        ? 'rgba(0, 245, 255, 0.65)'
        : 'rgba(244, 63, 94, 0.68)';
      ctx.lineWidth = secondaryLayer ? 3.5 : 5.0;
      ctx.shadowColor = isCyanSide ? '#00f0ff' : '#ec4899';
      ctx.shadowBlur = 14;

      const baseY = 35 + w * 34;
      for (let x = 0; x <= 512; x += 8) {
        const wave1 =
          Math.sin((x / 512) * Math.PI * 4 + w * 0.9) *
          (secondaryLayer ? 28 : 36);
        const wave2 = Math.cos((x / 512) * Math.PI * 2 - w * 0.6) * 18;
        const y = baseY + wave1 + wave2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const tex = new CanvasTexture(canvas);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private createFresnelRimTexture(): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const cx = 256;
    const cy = 256;

    for (let angle = 0; angle < 360; angle += 2) {
      const rad = (angle * Math.PI) / 180;
      const nextRad = ((angle + 3) * Math.PI) / 180;

      const t = (Math.cos(rad - Math.PI * 0.75) + 1) * 0.5;
      const r = Math.round(0 * t + 244 * (1 - t));
      const g = Math.round(240 * t + 63 * (1 - t));
      const b = Math.round(255 * t + 160 * (1 - t));

      ctx.beginPath();
      ctx.arc(cx, cy, 196, rad, nextRad);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.88)`;
      ctx.lineWidth = 22;
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.shadowBlur = 24;
      ctx.stroke();

      const waveR = 182 + Math.sin(rad * 5) * 9 + Math.cos(rad * 3) * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, waveR, rad, nextRad);
      ctx.strokeStyle = `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, 255, 0.75)`;
      ctx.lineWidth = 4.5;
      ctx.stroke();
    }

    const tex = new CanvasTexture(canvas);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private buildFlockOfColorfulSkyBirds(): void {
    const birdConfigs = [
      {
        bodyColor: 0xa855f7,
        wingColor: 0x00f0ff,
        tipColor: 0xfde047,
        phaseOffset: 0.0,
        speed: 0.55,
        radiusX: 0.65,
        baseY: 0.52,
        baseZ: -0.08,
      },
      {
        bodyColor: 0x10b981,
        wingColor: 0xfacc15,
        tipColor: 0x38bdf8,
        phaseOffset: 1.8,
        speed: 0.48,
        radiusX: 0.72,
        baseY: 0.58,
        baseZ: -0.18,
      },
      {
        bodyColor: 0xf43f5e,
        wingColor: 0xfde047,
        tipColor: 0xa855f7,
        phaseOffset: 3.6,
        speed: 0.62,
        radiusX: 0.58,
        baseY: 0.49,
        baseZ: -0.12,
      },
      {
        bodyColor: 0x38bdf8,
        wingColor: 0xf472b6,
        tipColor: 0x4ade80,
        phaseOffset: 5.1,
        speed: 0.52,
        radiusX: 0.78,
        baseY: 0.63,
        baseZ: -0.22,
      },
    ];

    birdConfigs.forEach((cfg, idx) => {
      const birdGroup = new Group();

      const birdBody = new Mesh(
        new SphereGeometry(0.024, 20, 20),
        new MeshStandardMaterial({
          color: cfg.bodyColor,
          emissive: cfg.bodyColor,
          emissiveIntensity: 0.75,
          roughness: 0.2,
        }),
      );
      birdGroup.add(birdBody);

      const beak = new Mesh(
        new ConeGeometry(0.007, 0.016, 10),
        new MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.5,
        }),
      );
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.002, 0.028);
      birdGroup.add(beak);

      [-0.009, 0.009].forEach((xOff) => {
        const bEye = new Mesh(
          new SphereGeometry(0.004, 8, 8),
          new MeshBasicMaterial({ color: 0xffffff }),
        );
        bEye.position.set(xOff, 0.007, 0.022);
        birdGroup.add(bEye);
      });

      const wingMat = new MeshStandardMaterial({
        color: cfg.wingColor,
        emissive: cfg.wingColor,
        emissiveIntensity: 0.65,
      });
      const tipMat = new MeshStandardMaterial({
        color: cfg.tipColor,
        emissive: cfg.tipColor,
        emissiveIntensity: 0.6,
      });

      const leftWing = new Group();
      leftWing.position.set(-0.019, 0.005, 0);
      const lMain = new Mesh(new BoxGeometry(0.034, 0.004, 0.019), wingMat);
      lMain.position.set(-0.016, 0, -0.002);
      lMain.rotation.y = 0.2;
      const lTip = new Mesh(new BoxGeometry(0.022, 0.003, 0.012), tipMat);
      lTip.position.set(-0.03, 0.002, -0.007);
      lTip.rotation.y = 0.35;
      leftWing.add(lMain, lTip);
      birdGroup.add(leftWing);

      const rightWing = new Group();
      rightWing.position.set(0.019, 0.005, 0);
      const rMain = new Mesh(new BoxGeometry(0.034, 0.004, 0.019), wingMat);
      rMain.position.set(0.016, 0, -0.002);
      rMain.rotation.y = -0.2;
      const rTip = new Mesh(new BoxGeometry(0.022, 0.003, 0.012), tipMat);
      rTip.position.set(0.03, 0.002, -0.007);
      rTip.rotation.y = -0.35;
      rightWing.add(rMain, rTip);
      birdGroup.add(rightWing);

      const tail = new Mesh(
        new ConeGeometry(0.01, 0.038, 8),
        new MeshBasicMaterial({ color: cfg.tipColor }),
      );
      tail.rotation.x = -Math.PI / 2;
      tail.position.set(0, 0, -0.032);
      birdGroup.add(tail);

      this.deskRoot.add(birdGroup);

      this.skyBirds.push({
        group: birdGroup,
        leftWing,
        rightWing,
        phaseOffset: cfg.phaseOffset,
        speed: cfg.speed,
        radiusX: cfg.radiusX,
        baseY: cfg.baseY,
        baseZ: cfg.baseZ,
      });

      this.registerTarget(`permanent_sky_bird_${idx}`, birdBody, () => {
        store.addSparks(5);
        this.playChime(783.99 + idx * 60, 0.2);
        birdGroup.scale.setScalar(1.35);
        setTimeout(() => birdGroup.scale.setScalar(1.0), 250);
      });
    });
  }

  private findRightHandObject(): Object3D | null {
    const xrOrigin = (this.world as any).input?.xr?.xrOrigin;
    if (xrOrigin?.gripSpaces?.right) {
      return xrOrigin.gripSpaces.right;
    }
    if (xrOrigin?.raySpaces?.right) {
      return xrOrigin.raySpaces.right;
    }
    if (this.rightHandObj && this.rightHandObj.parent) {
      return this.rightHandObj;
    }
    const p = this.player as any;
    if (p?.rightHand) {
      this.rightHandObj = p.rightHand;
      return this.rightHandObj;
    }
    if (p?.hands?.[1]) {
      this.rightHandObj = p.hands[1];
      return this.rightHandObj;
    }
    return null;
  }

  private computeBrushLocalPos(): void {
    const x = Math.max(-0.34, Math.min(0.34, this.mouseNDC.x * 0.42));
    const y = Math.max(-0.08, Math.min(0.28, this.mouseNDC.y * 0.25 + 0.08));
    const z = 0.08;
    this.brushLocalPos.set(x, y, z);
  }

  private updateProgressiveFocusVisibility(): void {
    if (this.sandboxModule?.isHoldingBrush) return;

    const lookingLeft =
      this.mouseNDC.x < -0.15 || performance.now() < this.forceShowLeftUntil;
    const lookingRight =
      this.mouseNDC.x > 0.18 || this.heldTool !== 'NONE';

    if (this.leftHeaderMesh) this.leftHeaderMesh.visible = lookingLeft;
    if (this.leftAddBtnMesh) this.leftAddBtnMesh.visible = lookingLeft;
    this.stickyNotesGroup.visible = true;

    if (this.birthdayBannerMesh)
      this.birthdayBannerMesh.visible = lookingRight;
    if (this.gardenCoachMesh) this.gardenCoachMesh.visible = lookingRight;
    if (this.seedBadgeMesh) this.seedBadgeMesh.visible = lookingRight;
    if (this.wateringCanBadgeMesh)
      this.wateringCanBadgeMesh.visible = lookingRight;
    this.gardenPotTags.forEach((tag) => (tag.visible = lookingRight));
  }

  private buildLeftWingTimelineAndStickyTable(): void {
    this.leftTimelineTable.position.set(-0.68, -0.02, 0.36);
    this.leftTimelineTable.rotation.y = 0.62;
    this.deskRoot.add(this.leftTimelineTable);

    const tableMesh = new Mesh(
      new CylinderGeometry(0.35, 0.38, 0.03, 36),
      new MeshStandardMaterial({
        color: 0x1e1b4b,
        roughness: 0.4,
        metalness: 0.25,
      }),
    );
    tableMesh.position.set(0, -0.2, 0);
    this.leftTimelineTable.add(tableMesh);

    const rimMesh = new Mesh(
      new RingGeometry(0.34, 0.355, 36),
      new MeshBasicMaterial({ color: 0xa855f7, side: DoubleSide }),
    );
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.set(0, -0.183, 0);
    this.leftTimelineTable.add(rimMesh);

    this.leftHeaderMesh = this.createCleanPillBadge(
      '📋 KANBAN BOARD: Tap Card to Move (TO-DO ➔ DOING ➔ DONE)',
      0.54,
      0.052,
      '#a855f7',
    );
    this.leftHeaderMesh.position.set(0, 0.34, -0.05);
    this.leftTimelineTable.add(this.leftHeaderMesh);

    const columns = [
      { title: '🔴 TO-DO', x: -0.19, color: '#f43f5e', hex: 0xf43f5e },
      { title: '🟡 DOING', x: 0.0, color: '#fbbf24', hex: 0xfbbf24 },
      { title: '🟢 DONE', x: 0.19, color: '#10b981', hex: 0x10b981 },
    ];

    columns.forEach((col) => {
      const colBadge = this.createCleanPillBadge(
        col.title,
        0.165,
        0.04,
        col.color,
      );
      colBadge.position.set(col.x, 0.14, 0.0);
      this.kanbanBoardGroup.add(colBadge);

      const laneStrip = new Mesh(
        new BoxGeometry(0.16, 0.008, 0.24),
        new MeshStandardMaterial({
          color: col.hex,
          emissive: col.hex,
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.45,
        }),
      );
      laneStrip.position.set(col.x, -0.18, 0.02);
      this.kanbanBoardGroup.add(laneStrip);
    });

    this.leftTimelineTable.add(this.kanbanBoardGroup);

    this.leftAddBtnMesh = this.createCleanPillBadge(
      '➕ Add New To-Do Task (+5✨)',
      0.34,
      0.046,
      '#fbbf24',
    );
    this.leftAddBtnMesh.position.set(0, -0.13, 0.2);
    this.leftTimelineTable.add(this.leftAddBtnMesh);

    this.registerTarget('permanent_add_sticky', this.leftAddBtnMesh, () => {
      this.spawnInstantStickyNote();
    });

    this.leftTimelineTable.add(this.timelineCardsGroup);
    this.leftTimelineTable.add(this.stickyNotesGroup);

    this.rebuildTimelineCards();
    this.rebuildStickyNotes();
  }

  private rebuildTimelineCards(): void {
    while (this.timelineCardsGroup.children.length > 0) {
      this.timelineCardsGroup.remove(this.timelineCardsGroup.children[0]);
    }

    const contexts = [
      { label: '☀️ Morning', idx: 0 },
      { label: '🚌 Commute', idx: 1 },
      { label: '📚 Study', idx: 2 },
      { label: '🌙 Night', idx: 3 },
    ];

    contexts.forEach((c, i) => {
      const isDone = store.state.completedContexts[i];
      const isActive = store.state.activeQuestIndex === i;
      const statusPrefix = isDone ? '✅ ' : isActive ? '👉 ' : '';
      const border = isDone ? '#10b981' : isActive ? '#00f0ff' : '#64748b';

      const card = this.createCleanPillBadge(
        `${statusPrefix}${c.label}`,
        0.135,
        0.038,
        border,
      );
      card.position.set(-0.225 + i * 0.15, 0.24, -0.02);
      this.timelineCardsGroup.add(card);

      this.registerTarget(`permanent_timeline_${i}`, card, () => {
        store.state.activeQuestIndex = i;
        store.save();
        this.rebuildTimelineCards();
        this.jumpToTherapyStage('STAGE_1_MOTOR_POP');
      });
    });
  }

  private rebuildStickyNotes(): void {
    while (this.stickyNotesGroup.children.length > 0) {
      this.stickyNotesGroup.remove(this.stickyNotesGroup.children[0]);
    }

    const tasks = store.state.kanbanTasks || [];
    const lanes: Array<{
      status: 'todo' | 'doing' | 'done';
      x: number;
      border: string;
    }> = [
      { status: 'todo', x: -0.19, border: '#f43f5e' },
      { status: 'doing', x: 0.0, border: '#fbbf24' },
      { status: 'done', x: 0.19, border: '#10b981' },
    ];

    lanes.forEach((lane) => {
      const laneTasks = tasks
        .filter((t: KanbanTask) => t.status === lane.status)
        .slice(0, 3);

      laneTasks.forEach((task: KanbanTask, rowIdx: number) => {
        const prefix =
          lane.status === 'todo'
            ? '📌 '
            : lane.status === 'doing'
              ? '⚡ '
              : '✅ ';
        const cardMesh = this.createCleanPillBadge(
          `${prefix}${task.title}`,
          0.17,
          0.044,
          lane.border,
        );
        cardMesh.position.set(lane.x, 0.06 - rowIdx * 0.062, 0.03);
        this.stickyNotesGroup.add(cardMesh);

        this.registerTarget(`permanent_kanban_${task.id}`, cardMesh, () => {
          this.advanceKanbanTask(task);
        });
      });
    });
  }

  private advanceKanbanTask(task: KanbanTask): void {
    if (task.status === 'todo') {
      task.status = 'doing';
      store.addSparks(5);
      store.save();
      this.rebuildStickyNotes();
      this.setLumaMood('calm');
      this.startOrCycleFocusTimer(120);
      this.playChime(587.33, 0.22);
      this.setSubtitle(
        `🟡 Moved "${task.title}" to DOING & started 2-Min Focus Timer (+5✨)!`,
      );
      this.speak(
        `Moved ${task.title} to Doing and started your two minute focus timer!`,
      );
    } else if (task.status === 'doing') {
      task.status = 'done';
      store.addSparks(15);
      store.state.gardenSeeds += 1;
      store.save();
      this.rebuildStickyNotes();
      this.rebuildSeedPlate();
      this.setLumaMood('happy');
      this.playChime(783.99, 0.3);
      this.setSubtitle(
        `🟢 Completed "${task.title}" ➔ Moved to DONE! (+15✨ Sparks & +1🌱 Seed)!`,
      );
      this.speak(
        `Awesome job! ${task.title} is Done! You earned 15 sparks and a garden seed.`,
      );
    } else {
      store.state.kanbanTasks = store.state.kanbanTasks.filter(
        (t: KanbanTask) => t.id !== task.id,
      );
      store.addSparks(5);
      store.save();
      this.rebuildStickyNotes();
      this.playChime(880, 0.18);
      this.setSubtitle(`✨ Archived completed task "${task.title}" (+5✨)!`);
    }
  }

  private spawnInstantStickyNote(): void {
    const idea =
      STICKY_NOTE_IDEAS[this.stickyIdeaIdx % STICKY_NOTE_IDEAS.length];
    this.stickyIdeaIdx++;
    store.state.kanbanTasks.unshift({
      id: `task_${Date.now()}`,
      title: idea,
      status: 'todo',
    });
    store.addSparks(5);
    this.rebuildStickyNotes();
    this.forceShowLeftUntil = performance.now() + 8000;
    this.playChime(523.25, 0.2);
    this.setSubtitle(
      `🔴 Added "${idea}" to TO-DO on your Left Kanban Board (+5✨)! Tap it to move to DOING.`,
    );
    this.speak(`Added ${idea} to your To-Do column!`);
  }

  private buildRightSideGardenTable(): void {
    this.rightGardenTable.position.set(0.68, -0.02, 0.36);
    this.rightGardenTable.rotation.y = -0.62;
    this.deskRoot.add(this.rightGardenTable);

    const tableMesh = new Mesh(
      new CylinderGeometry(0.32, 0.35, 0.03, 36),
      new MeshStandardMaterial({
        color: 0x064e3b,
        roughness: 0.4,
        metalness: 0.25,
      }),
    );
    tableMesh.position.set(0, -0.2, 0);
    this.rightGardenTable.add(tableMesh);

    const rimMesh = new Mesh(
      new RingGeometry(0.31, 0.325, 36),
      new MeshBasicMaterial({ color: 0x10b981, side: DoubleSide }),
    );
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.set(0, -0.183, 0);
    this.rightGardenTable.add(rimMesh);

    this.updateBirthdayBanner();
    this.updateGardenCoachBanner(
      '🌱 GARDEN: 1. Tap Seed Dish ➔ 2. Tap Watering Can!',
    );

    this.seedPlateGroup.position.set(-0.04, -0.15, 0.21);
    this.rightGardenTable.add(this.seedPlateGroup);
    this.rebuildSeedPlate();

    this.heldSeedMesh = new Mesh(
      new SphereGeometry(0.024, 16, 16),
      new MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.8,
      }),
    );
    this.heldSeedMesh.visible = false;
    this.rightGardenTable.add(this.heldSeedMesh);

    this.buildGrabbableWateringCan();

    this.rightGardenTable.add(this.gardenPotsGroup);
    this.rebuildTabletopGarden();
  }

  private updateBirthdayBanner(): void {
    if (this.birthdayBannerMesh) {
      this.rightGardenTable.remove(this.birthdayBannerMesh);
    }
    const nick = store.state.profile.nickname;
    const days = store.getDaysUntilBirthday();
    const dateTime = store.getFormattedDateAndTime();

    this.birthdayBannerMesh = this.createCleanPillBadge(
      `🎂 ${days} Days to ${nick}’s B-Day! | ${dateTime}`,
      0.48,
      0.056,
      '#f472b6',
    );
    this.birthdayBannerMesh.position.set(0, 0.34, -0.05);
    this.rightGardenTable.add(this.birthdayBannerMesh);
  }

  private updateGardenCoachBanner(text: string): void {
    if (this.gardenCoachMesh) {
      this.rightGardenTable.remove(this.gardenCoachMesh);
    }
    this.gardenCoachMesh = this.createCleanPillBadge(
      text,
      0.46,
      0.052,
      '#10b981',
    );
    this.gardenCoachMesh.position.set(0, 0.26, -0.04);
    this.rightGardenTable.add(this.gardenCoachMesh);
  }

  private rebuildSeedPlate(): void {
    while (this.seedPlateGroup.children.length > 0) {
      this.seedPlateGroup.remove(this.seedPlateGroup.children[0]);
    }

    const dish = new Mesh(
      new CylinderGeometry(0.058, 0.048, 0.015, 20),
      new MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 }),
    );
    this.seedPlateGroup.add(dish);

    const seedCount = Math.max(1, Math.min(5, store.state.gardenSeeds));
    for (let i = 0; i < seedCount; i++) {
      const angle = (i / seedCount) * Math.PI * 2;
      const seed = new Mesh(
        new SphereGeometry(0.016, 12, 12),
        new MeshStandardMaterial({
          color: 0x84cc16,
          emissive: 0x65a30d,
          emissiveIntensity: 0.5,
        }),
      );
      seed.scale.set(1.0, 1.3, 1.0);
      seed.position.set(
        Math.cos(angle) * 0.022,
        0.018,
        Math.sin(angle) * 0.022,
      );
      this.seedPlateGroup.add(seed);
    }

    this.seedBadgeMesh = this.createCleanPillBadge(
      `🌱 Pick Seed (${store.state.gardenSeeds})`,
      0.18,
      0.046,
      '#84cc16',
    );
    this.seedBadgeMesh.position.set(0, 0.13, 0.02);
    this.seedBadgeMesh.renderOrder = 10;
    this.seedPlateGroup.add(this.seedBadgeMesh);

    const grabHit = new Mesh(
      new SphereGeometry(0.065, 10, 10),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    this.seedPlateGroup.add(grabHit);

    const pickSeedFn = () => this.startHoldingSeed();
    this.registerTarget('permanent_seed_plate', grabHit, pickSeedFn);
    this.registerTarget(
      'permanent_seed_badge',
      this.seedBadgeMesh,
      pickSeedFn,
    );
  }

  private buildGrabbableWateringCan(): void {
    this.wateringCanGroup.position.copy(this.wateringCanHomePos);

    const goldMat = new MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.5,
    });

    const body = new Mesh(
      new CylinderGeometry(0.036, 0.044, 0.075, 20),
      goldMat,
    );
    this.wateringCanGroup.add(body);

    const handle = new Mesh(
      new TorusGeometry(0.028, 0.006, 10, 20),
      goldMat,
    );
    handle.position.set(0.035, 0.005, 0);
    this.wateringCanGroup.add(handle);

    const spout = new Mesh(
      new CylinderGeometry(0.007, 0.014, 0.07, 12),
      goldMat,
    );
    spout.position.set(-0.042, 0.015, 0);
    spout.rotation.z = 0.75;
    this.wateringCanGroup.add(spout);

    this.waterDropsGroup.position.set(-0.072, 0.01, 0);
    for (let i = 0; i < 6; i++) {
      const drop = new Mesh(
        new ConeGeometry(0.008, 0.022, 8),
        new MeshBasicMaterial({ color: 0x00f0ff }),
      );
      drop.position.set(
        (Math.random() - 0.5) * 0.018,
        -i * 0.025,
        (Math.random() - 0.5) * 0.018,
      );
      drop.userData.dropIndex = i;
      this.waterDropsGroup.add(drop);
    }
    this.waterDropsGroup.visible = false;
    this.wateringCanGroup.add(this.waterDropsGroup);

    this.wateringCanBadgeMesh = this.createCleanPillBadge(
      '🚿 Grab Watering Can',
      0.19,
      0.046,
      '#fbbf24',
    );
    this.wateringCanBadgeMesh.position.set(0, 0.14, 0);
    this.wateringCanBadgeMesh.renderOrder = 10;
    this.wateringCanGroup.add(this.wateringCanBadgeMesh);

    const grabSphere = new Mesh(
      new SphereGeometry(0.07, 12, 12),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    this.wateringCanGroup.add(grabSphere);

    this.rightGardenTable.add(this.wateringCanGroup);

    const grabCanFn = () => this.startHoldingWateringCan();
    this.registerTarget('permanent_watering_can', grabSphere, grabCanFn);
    this.registerTarget(
      'permanent_watering_badge',
      this.wateringCanBadgeMesh,
      grabCanFn,
    );
  }

  private startHoldingSeed(): void {
    this.heldTool = 'SEED';
    this.heldSeedMesh.visible = true;
    this.heldSeedMesh.position.set(-0.04, -0.05, 0.12);
    this.playChime(523.25, 0.18);
    this.updateGardenCoachBanner(
      '🌱 Holding Seed in Hand! Touch any Empty Pot to plant!',
    );
    this.setSubtitle(
      '🌱 Seed grabbed in your hand! Move over any pot on the right table to plant it.',
    );
    this.speak('Picked up a seed! Touch any pot to plant it.');
  }

  private startHoldingWateringCan(): void {
    this.heldTool = 'WATERING_CAN';
    this.wateringCanGroup.position.set(0.0, 0.0, 0.02);
    this.wateringCanGroup.rotation.z = 0.55;
    this.waterDropsGroup.visible = true;
    this.playChime(587.33, 0.22);
    this.updateGardenCoachBanner(
      '🚿 Watering Can Locked to Hand! Sweep across pots to grow!',
    );
    this.setSubtitle(
      '🚿 Watering Can grabbed! Move your hand across your plants to watch them grow!',
    );
    this.speak('Pouring water! Move the watering can over your plants.');
  }

  private updateHeldGardenToolPosition(): void {
    let localX = Math.max(
      -0.22,
      Math.min(0.22, (this.mouseNDC.x - 0.25) * 0.45),
    );
    let localZ = Math.max(-0.15, Math.min(0.15, -this.mouseNDC.y * 0.3));

    const handObj = this.findRightHandObject();
    if (handObj && performance.now() < this.xrHandActiveUntil) {
      handObj.getWorldPosition(this.handWorldPos);
      if (this.handWorldPos.lengthSq() > 0.01) {
        this.tempVec.copy(this.handWorldPos);
        this.rightGardenTable.worldToLocal(this.tempVec);
        localX = Math.max(-0.24, Math.min(0.24, this.tempVec.x));
        localZ = Math.max(-0.18, Math.min(0.18, this.tempVec.z));
      }
    }

    if (this.heldTool === 'SEED') {
      this.heldSeedMesh.position.set(localX, -0.06, localZ);
      this.potLocalPositions.forEach((potPos, idx) => {
        const dx = localX - potPos.x;
        const dz = localZ - potPos.z;
        if (Math.hypot(dx, dz) < 0.075 && store.state.gardenPods[idx] === 0) {
          store.plantSeedInPod(idx);
          this.rebuildSeedPlate();
          this.rebuildTabletopGarden();
          this.playChime(659.25, 0.25);
          this.updateGardenCoachBanner(
            `🌱 Planted Pot #${idx + 1}! Now grab the Watering Can!`,
          );
          this.releaseHeldGardenTool();
        }
      });
    } else if (this.heldTool === 'WATERING_CAN') {
      this.wateringCanGroup.position.set(localX + 0.05, 0.0, localZ);
      const now = performance.now();
      this.potLocalPositions.forEach((potPos, idx) => {
        const dx = localX - potPos.x;
        const dz = localZ - potPos.z;
        if (
          Math.hypot(dx, dz) < 0.085 &&
          now - this.lastWateredPodTime[idx] > 900
        ) {
          this.lastWateredPodTime[idx] = now;
          this.waterSpecificGardenPod(idx);
        }
      });
    }
  }

  private releaseHeldGardenTool(): void {
    this.heldTool = 'NONE';
    this.heldSeedMesh.visible = false;
    this.waterDropsGroup.visible = false;
    this.wateringCanGroup.position.copy(this.wateringCanHomePos);
    this.wateringCanGroup.rotation.set(0, 0, 0);
  }

  private rebuildTabletopGarden(): void {
    while (this.gardenPotsGroup.children.length > 0) {
      this.gardenPotsGroup.remove(this.gardenPotsGroup.children[0]);
    }
    this.gardenPotTags = [];

    store.state.gardenPods.forEach((stage: number, idx: number) => {
      const podGroup = new Group();
      podGroup.position.copy(this.potLocalPositions[idx]);

      const pot = new Mesh(
        new CylinderGeometry(0.042, 0.032, 0.04, 16),
        new MeshStandardMaterial({
          color: 0xd97706,
          emissive: stage > 0 ? 0x10b981 : 0x000000,
          emissiveIntensity: 0.2,
        }),
      );
      podGroup.add(pot);

      if (stage === 1) {
        const sprout = new Mesh(
          new SphereGeometry(0.026, 12, 12),
          new MeshStandardMaterial({
            color: 0x4ade80,
            emissive: 0x22c55e,
            emissiveIntensity: 0.4,
          }),
        );
        sprout.scale.y = 1.7;
        sprout.position.y = 0.038;
        podGroup.add(sprout);
      } else if (stage === 2) {
        const stem = new Mesh(
          new CylinderGeometry(0.008, 0.012, 0.065, 8),
          new MeshStandardMaterial({ color: 0x78350f }),
        );
        stem.position.y = 0.038;
        const crown = new Mesh(
          new ConeGeometry(0.042, 0.09, 10),
          new MeshStandardMaterial({
            color: 0x22c55e,
            emissive: 0x16a34a,
            emissiveIntensity: 0.35,
          }),
        );
        crown.position.y = 0.08;
        podGroup.add(stem, crown);
      } else if (stage === 3) {
        const trunk = new Mesh(
          new CylinderGeometry(0.01, 0.016, 0.085, 10),
          new MeshStandardMaterial({ color: 0x78350f }),
        );
        trunk.position.y = 0.048;
        const foliage = new Mesh(
          new SphereGeometry(0.052, 16, 16),
          new MeshStandardMaterial({
            color: idx % 2 === 0 ? 0xf472b6 : 0x38bdf8,
            emissive: idx % 2 === 0 ? 0xdb2777 : 0x0284c7,
            emissiveIntensity: 0.45,
          }),
        );
        foliage.position.y = 0.105;
        podGroup.add(trunk, foliage);
      }

      const labelStr =
        stage === 0
          ? '🕳️ Empty'
          : stage === 1
            ? '🌱 Sprout'
            : stage === 2
              ? '🌿 Sapling'
              : '🌸 Tree!';
      const miniTag = this.createCleanPillBadge(
        labelStr,
        0.11,
        0.032,
        stage === 3 ? '#f472b6' : stage === 0 ? '#94a3b8' : '#10b981',
      );
      miniTag.position.set(0, stage === 3 ? 0.22 : 0.16, 0);
      miniTag.renderOrder = 10;
      podGroup.add(miniTag);
      this.gardenPotTags.push(miniTag);

      const touchSphere = new Mesh(
        new SphereGeometry(0.058, 10, 10),
        new MeshBasicMaterial({
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        }),
      );
      touchSphere.position.set(0, 0.06, 0);
      podGroup.add(touchSphere);

      this.gardenPotsGroup.add(podGroup);

      const interactPodFn = () => {
        if (this.heldTool === 'SEED' || store.state.gardenPods[idx] === 0) {
          store.plantSeedInPod(idx);
          this.rebuildSeedPlate();
          this.rebuildTabletopGarden();
          this.releaseHeldGardenTool();
          this.playChime(523.25, 0.25);
          this.updateGardenCoachBanner(
            `🌱 Planted Seed in Pot #${idx + 1}! Now grab the Watering Can!`,
          );
          this.speak(`Seed planted in pot ${idx + 1}!`);
        } else {
          this.animateWateringCanOverPot(idx);
        }
      };

      this.registerTarget(
        `permanent_garden_hit_${idx}`,
        touchSphere,
        interactPodFn,
      );
      this.registerTarget(
        `permanent_garden_tag_${idx}`,
        miniTag,
        interactPodFn,
      );
    });
  }

  private animateWateringCanOverPot(podIndex: number): void {
    const targetPos = this.potLocalPositions[podIndex];
    this.wateringCanGroup.position.set(
      targetPos.x + 0.06,
      0.04,
      targetPos.z,
    );
    this.wateringCanGroup.rotation.z = 0.6;
    this.waterDropsGroup.visible = true;

    this.waterSpecificGardenPod(podIndex);

    setTimeout(() => {
      if (this.heldTool === 'NONE') {
        this.waterDropsGroup.visible = false;
        this.wateringCanGroup.position.copy(this.wateringCanHomePos);
        this.wateringCanGroup.rotation.set(0, 0, 0);
      }
    }, 850);
  }

  private handleAutoPlantOrWater(): void {
    const emptyIdx = store.state.gardenPods.findIndex((p: number) => p === 0);
    const growIdx = store.state.gardenPods.findIndex(
      (p: number) => p > 0 && p < 3,
    );
    if (growIdx !== -1) {
      this.animateWateringCanOverPot(growIdx);
    } else if (emptyIdx !== -1) {
      store.plantSeedInPod(emptyIdx);
      this.rebuildSeedPlate();
      this.rebuildTabletopGarden();
      this.playChime(523.25, 0.25);
      this.updateGardenCoachBanner(
        `🌱 Planted Seed in Pot #${emptyIdx + 1}! Tap again to water!`,
      );
    } else {
      this.animateWateringCanOverPot(0);
    }
  }

  private waterSpecificGardenPod(podIndex: number): void {
    const newStage = store.advanceGardenPod(podIndex);
    this.rebuildTabletopGarden();
    this.playChime(659.25, 0.3);

    const stageNames = ['Soil', '🌱 Sprout', '🌿 Sapling', '🌸 Blooming Tree'];
    this.updateGardenCoachBanner(
      `🚿 Watered Pot #${podIndex + 1} ➔ ${stageNames[newStage]} (+12✨)!`,
    );
    this.setSubtitle(
      `🚿 Poured water on Pot #${podIndex + 1} ➔ Grew into a ${stageNames[newStage]} (+12✨ Sparks)!`,
    );
    this.speak(
      `Watered pot ${podIndex + 1}! It grew into a ${stageNames[newStage]}.`,
    );
  }

  private buildHydrationPitcherStation(): void {
    this.waterStation.position.set(-0.35, -0.15, 0.2);
    this.waterStation.rotation.y = 0.35;

    const glassShell = new Mesh(
      new CylinderGeometry(0.042, 0.034, 0.1, 24, 1, true),
      new MeshStandardMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.42,
        side: DoubleSide,
      }),
    );
    this.waterStation.add(glassShell);

    this.waterFillMesh = new Mesh(
      new CylinderGeometry(0.036, 0.03, 0.09, 20),
      new MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
      }),
    );
    this.waterStation.add(this.waterFillMesh);
    this.updateWaterPitcherVisual();

    this.waterLabelMesh = this.createCleanPillBadge(
      `💧 Water (${store.state.telemetry.waterCupsToday}/8)`,
      0.175,
      0.045,
      '#38bdf8',
    );
    this.waterLabelMesh.position.set(-0.03, 0.11, 0.02);
    this.waterStation.add(this.waterLabelMesh);

    this.deskRoot.add(this.waterStation);

    this.registerTarget('permanent_water_pitcher', glassShell, () =>
      this.handleDrinkWater(),
    );
    this.registerTarget('permanent_water_btn', this.waterLabelMesh, () =>
      this.handleDrinkWater(),
    );
  }

  private updateWaterPitcherVisual(): void {
    const cups = store.state.telemetry.waterCupsToday;
    const ratio = Math.max(0.06, cups / 8);
    this.waterFillMesh.scale.y = ratio;
    this.waterFillMesh.position.y = -0.045 + ratio * 0.045;

    if (this.waterLabelMesh && this.waterStation) {
      const pos = this.waterLabelMesh.position.clone();
      this.waterStation.remove(this.waterLabelMesh);
      this.waterLabelMesh = this.createCleanPillBadge(
        `💧 Water (${cups}/8)`,
        0.175,
        0.045,
        '#38bdf8',
      );
      this.waterLabelMesh.position.copy(pos);
      this.waterStation.add(this.waterLabelMesh);
      this.registerTarget('permanent_water_btn', this.waterLabelMesh, () =>
        this.handleDrinkWater(),
      );
    }
  }

  private resetWaterForNewMorning(): void {
    store.state.telemetry.waterCupsToday = 0;
    store.save();
    this.updateWaterPitcherVisual();
  }

  private showMidQuestHydrationAlert(): void {
    this.dismissHydrationAlert();
    this.hydrationAlertMesh = this.createCleanPillBadge(
      '💧 THIRST REMINDER: Tap Here to Drink 1 Cup (+15✨ Bonus)!',
      0.46,
      0.052,
      '#00f0ff',
    );
    this.hydrationAlertMesh.position.set(0, 0.28, 0.02);
    this.deskRoot.add(this.hydrationAlertMesh);

    this.registerTarget('hydration_alert_btn', this.hydrationAlertMesh, () => {
      store.addSparks(5);
      this.dismissHydrationAlert();
      this.handleDrinkWater();
    });
  }

  private dismissHydrationAlert(): void {
    if (this.hydrationAlertMesh) {
      this.deskRoot.remove(this.hydrationAlertMesh);
      this.hydrationAlertMesh = null;
      this.unregisterTarget('hydration_alert_btn');
    }
  }

  private handleDrinkWater(): void {
    this.dismissHydrationAlert();
    const cups = store.logWaterCup();
    this.updateWaterPitcherVisual();

    this.playChime(587.33, 0.25);
    this.setSubtitle(
      `💧 Drank 1 Cup of Water (${cups}/8 Cups)! +10✨ Sparks earned!`,
    );
    this.speak(`Great job drinking water! ${cups} out of 8 cups today.`);
  }

  private buildMealNourishStation(): void {
    this.mealPlateGroup.position.set(0.34, -0.18, 0.2);
    this.mealPlateGroup.rotation.y = -0.35;

    const plate = new Mesh(
      new CylinderGeometry(0.054, 0.044, 0.015, 24),
      new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
    );
    this.mealPlateGroup.add(plate);

    const apple = new Mesh(
      new SphereGeometry(0.018, 16, 16),
      new MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.3,
      }),
    );
    apple.position.set(-0.016, 0.018, 0);
    const sandwich = new Mesh(
      new BoxGeometry(0.026, 0.016, 0.026),
      new MeshStandardMaterial({ color: 0xf59e0b }),
    );
    sandwich.position.set(0.016, 0.016, 0.01);
    this.mealPlateGroup.add(apple, sandwich);

    this.mealLabelMesh = this.createCleanPillBadge(
      `🍎 Safe Meal (${store.state.telemetry.mealsLoggedToday})`,
      0.175,
      0.045,
      '#f43f5e',
    );
    this.mealLabelMesh.position.set(0.03, 0.11, 0.02);
    this.mealPlateGroup.add(this.mealLabelMesh);

    this.deskRoot.add(this.mealPlateGroup);

    this.registerTarget('permanent_meal_plate', plate, () =>
      this.handleLogMeal(),
    );
    this.registerTarget('permanent_meal_btn', this.mealLabelMesh, () =>
      this.handleLogMeal(),
    );
  }

  private handleLogMeal(): void {
    const meals = store.logHealthyMeal();
    this.rebuildSeedPlate();

    const pos = this.mealLabelMesh.position.clone();
    this.mealPlateGroup.remove(this.mealLabelMesh);
    this.mealLabelMesh = this.createCleanPillBadge(
      `🍎 Safe Meal (${meals})`,
      0.175,
      0.045,
      '#f43f5e',
    );
    this.mealLabelMesh.position.copy(pos);
    this.mealPlateGroup.add(this.mealLabelMesh);
    this.registerTarget('permanent_meal_btn', this.mealLabelMesh, () =>
      this.handleLogMeal(),
    );

    this.playChime(523.25, 0.25);
    this.setSubtitle(
      `🍎 Safe Meal Logged! +1🌱 New Seed added to the Seed Dish on your Right Garden Table!`,
    );
    this.speak(
      'Meal logged! Look at the right table—a new seed appeared on your seed plate!',
    );
  }

  private switchWorldTheme(theme: WorldThemeId): void {
    store.state.passthroughActive = false;
    this.worldGenerator.root.visible = true;

    // Restore the center table slab, sky birds, quests, and left theme orbs when entering a VR World!
    if (this.centerTableMesh) this.centerTableMesh.visible = true;
    if (this.questModule?.group) this.questModule.group.visible = true;
    if (this.sandboxModule?.group) this.sandboxModule.group.visible = true;
    this.skyBirds.forEach((b) => {
      b.group.visible = true;
    });
    this.targets.forEach((t) => {
      if (t.id.startsWith('permanent_world_')) {
        t.mesh.visible = true;
      }
    });

    store.state.worldTheme = theme;
    store.save();
    this.worldGenerator.applyTheme(theme);
    this.removeWhiteCrystalRingsFromSky();
    this.playChime(432, 0.25);
    this.setSubtitle(
      `🌍 360° Room morphed into ${theme.toUpperCase()} SANCTUARY!`,
    );
  }

  private jumpToTherapyStage(stage: TherapyStage): void {
    this.dismissHydrationAlert();
    this.sandboxModule.clearMeshes();
    store.state.appMode = 'QUEST';

    // Always ensure the quest shapes are visible when jumping to a stage!
    if (this.questModule?.group) {
      this.questModule.group.visible = !store.state.passthroughActive;
    }

    this.rebuildTimelineCards();
    this.questModule.startStage(stage);
  }

  private advanceActiveExperience(): void {
    if (store.state.appMode === 'QUEST') {
      this.questModule.advanceStep();
    } else {
      store.state.activeQuestIndex =
        (store.state.activeQuestIndex + 1) % CLINICAL_QUESTS.length;
      this.rebuildTimelineCards();
      this.jumpToTherapyStage('STAGE_1_MOTOR_POP');
    }
  }

  private buildSanctuaryTable(): void {
    const tableMesh = new Mesh(
      new CylinderGeometry(0.39, 0.43, 0.03, 48),
      new MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.3,
      }),
    );
    tableMesh.position.set(0, -0.22, 0);
    this.centerTableMesh = tableMesh;
    this.deskRoot.add(tableMesh);

    const rimMesh = new Mesh(
      new RingGeometry(0.38, 0.395, 48),
      new MeshBasicMaterial({ color: 0x38bdf8, side: DoubleSide }),
    );
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.set(0, -0.203, 0);
    this.deskRoot.add(rimMesh);
  }

  private buildLumaCompanionPet(): void {
    this.lumaGroup.position.set(0, 0.12, -0.06);

    this.lumaBodyMesh = new Mesh(
      new SphereGeometry(0.052, 32, 32),
      new MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.25,
      }),
    );
    this.lumaGroup.add(this.lumaBodyMesh);

    const eyeGeo = new SphereGeometry(0.009, 16, 16);
    const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new SphereGeometry(0.005, 12, 12);
    const pupilMat = new MeshBasicMaterial({ color: 0x090d16 });

    [-0.019, 0.019].forEach((xOffset) => {
      const eye = new Mesh(eyeGeo, eyeMat);
      eye.position.set(xOffset, 0.01, 0.045);
      const pupil = new Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, 0.006);
      eye.add(pupil);
      this.lumaGroup.add(eye);
    });

    this.lumaHaloMesh = new Mesh(
      new TorusGeometry(0.07, 0.006, 16, 48),
      new MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    this.lumaHaloMesh.rotation.x = Math.PI / 2;
    this.lumaHaloMesh.position.set(0, 0.062, 0);
    this.lumaGroup.add(this.lumaHaloMesh);

    this.deskRoot.add(this.lumaGroup);

    this.registerTarget('permanent_luma', this.lumaBodyMesh, () => {
      if (
        store.state.appMode === 'QUEST' &&
        store.state.currentStage === 'STAGE_2_BREATH_SYNC'
      ) {
        this.questModule.triggerBreathPulse();
      } else {
        this.playChime(587.33, 0.25);
        this.lumaGroup.scale.setScalar(1.25);
        setTimeout(() => this.lumaGroup.scale.setScalar(1.0), 240);

        const doing = (store.state.kanbanTasks || []).find(
          (t: KanbanTask) => t.status === 'doing',
        );
        const todo = (store.state.kanbanTasks || []).find(
          (t: KanbanTask) => t.status === 'todo',
        );
        if (doing) {
          this.startOrCycleFocusTimer(120);
          this.setSubtitle(
            `🎲 Luma's 1-Step Pick: Focus for 2 mins on "${doing.title}"! (Timer Started)`,
          );
          this.speak(
            `Feeling stuck? Let's just do one tiny thing: ${doing.title}!`,
          );
        } else if (todo) {
          this.advanceKanbanTask(todo);
        } else if (store.state.telemetry.waterCupsToday < 8) {
          this.setSubtitle(
            `🎲 Luma's 1-Step Pick: Tap your Water Glass on the left for +10✨ Sparks!`,
          );
          this.speak(`Let's take one sip of water first!`);
        } else {
          this.setSubtitle(
            `🌟 Luma says: You finished your To-Do list! Tap any shape or play the Xylophone!`,
          );
          this.speak(`You finished your tasks! Great job today!`);
        }
      }
    });
  }

  private spawn3DWeatherSensoryHologram(
    tempC: number,
    condition: 'SUNNY' | 'CLOUDY' | 'RAINY' | 'WINDY',
    headline: string,
    sensoryOutfitTip: string,
  ): void {
    while (this.weatherHoloGroup.children.length > 0) {
      this.weatherHoloGroup.remove(this.weatherHoloGroup.children[0]);
    }
    this.weatherHoloGroup.position.set(0, 0.18, 0.12);

    const sunColor = condition === 'RAINY' ? 0x38bdf8 : 0xfacc15;
    const sunOrb = new Mesh(
      new SphereGeometry(0.036, 20, 20),
      new MeshStandardMaterial({
        color: sunColor,
        emissive: sunColor,
        emissiveIntensity: 0.85,
      }),
    );
    sunOrb.position.set(-0.18, 0.06, 0);
    this.weatherHoloGroup.add(sunOrb);

    const rays = new Mesh(
      new TorusGeometry(0.05, 0.004, 10, 24),
      new MeshBasicMaterial({ color: 0xfde047 }),
    );
    rays.position.copy(sunOrb.position);
    this.weatherHoloGroup.add(rays);

    const card = this.createCleanPillBadge(
      `${headline} — ${sensoryOutfitTip}`,
      0.54,
      0.06,
      '#facc15',
    );
    card.position.set(0, 0.14, 0.02);
    this.weatherHoloGroup.add(card);

    this.playChime(587.33, 0.3);
    this.setSubtitle(`${headline} | ${sensoryOutfitTip}`);
    this.speak(`${headline}. ${sensoryOutfitTip}`);

    setTimeout(() => {
      while (this.weatherHoloGroup.children.length > 0) {
        this.weatherHoloGroup.remove(this.weatherHoloGroup.children[0]);
      }
    }, 9000);
  }

  private buildWorldThemeOrbsOnLeft(): void {
    this.deskRoot.add(this.worldOrbsGroup);

    const themes: Array<{
      id: WorldThemeId;
      label: string;
      color: number;
      border: string;
    }> = [
      { id: 'forest', label: '🌲 Forest', color: 0x22c55e, border: '#22c55e' },
      { id: 'ocean', label: '🌊 Ocean', color: 0x38bdf8, border: '#38bdf8' },
      { id: 'dino', label: '🦕 Dino', color: 0xf59e0b, border: '#f59e0b' },
      { id: 'space', label: '🪐 Space', color: 0x818cf8, border: '#818cf8' },
    ];

    themes.forEach((t, idx) => {
      const yPos = 0.22 - idx * 0.055;

      const orb = new Mesh(
        new SphereGeometry(0.02, 20, 20),
        new MeshStandardMaterial({
          color: t.color,
          emissive: t.color,
          emissiveIntensity: 0.4,
        }),
      );
      orb.position.set(-0.33, yPos, -0.02);
      this.worldOrbsGroup.add(orb);

      const tag = this.createCleanPillBadge(t.label, 0.125, 0.032, t.border);
      tag.position.set(-0.435, yPos, -0.02);
      this.worldOrbsGroup.add(tag);

      const switchFn = () => this.switchWorldTheme(t.id);
      this.registerTarget(`permanent_world_${t.id}`, orb, switchFn);
      this.registerTarget(`permanent_world_tag_${t.id}`, tag, switchFn);
    });

    // 5th Item: 3D Mini House Icon + Left-Side "🏠 Real Room (MR)" Badge for VR/MR Switch
    const mrY = 0.22 - 4 * 0.055;
    const mrHouseGroup = new Group();
    mrHouseGroup.position.set(-0.33, mrY, -0.02);

    const walls = new Mesh(
      new BoxGeometry(0.028, 0.022, 0.026),
      new MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.2,
      }),
    );
    walls.position.y = -0.004;
    mrHouseGroup.add(walls);

    const roof = new Mesh(
      new ConeGeometry(0.025, 0.018, 4),
      new MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.5,
      }),
    );
    roof.position.y = 0.015;
    roof.rotation.y = Math.PI / 4;
    mrHouseGroup.add(roof);

    const door = new Mesh(
      new BoxGeometry(0.008, 0.012, 0.004),
      new MeshBasicMaterial({ color: 0xfacc15 }),
    );
    door.position.set(0, -0.008, 0.013);
    mrHouseGroup.add(door);

    const mrHit = new Mesh(
      new SphereGeometry(0.032, 12, 12),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    mrHouseGroup.add(mrHit);
    this.worldOrbsGroup.add(mrHouseGroup);

    const mrLabelBadge = this.createCleanPillBadge(
      '🏠 Real Room (MR)',
      0.185,
      0.036,
      '#00f0ff',
    );
    mrLabelBadge.position.set(-0.465, mrY, -0.02);
    this.worldOrbsGroup.add(mrLabelBadge);

    const toggleMRFn = () => this.toggleMixedRealityPassthrough();
    this.registerTarget('permanent_world_mr', mrHit, toggleMRFn);
    this.registerTarget('permanent_world_mr_label', mrLabelBadge, toggleMRFn);
  }

  private setLumaMood(mood: 'stressed' | 'calm' | 'happy'): void {
    const bodyMat = this.lumaBodyMesh.material as MeshStandardMaterial;
    const haloMat = this.lumaHaloMesh.material as MeshBasicMaterial;
    if (mood === 'stressed') {
      bodyMat.color.setHex(0xf43f5e);
      bodyMat.emissive.setHex(0xbe123c);
      haloMat.color.setHex(0xf43f5e);
    } else if (mood === 'calm') {
      bodyMat.color.setHex(0x38bdf8);
      bodyMat.emissive.setHex(0x0284c7);
      haloMat.color.setHex(0x00f0ff);
    } else {
      bodyMat.color.setHex(0x10b981);
      bodyMat.emissive.setHex(0x059669);
      haloMat.color.setHex(0xfbbf24);
    }
  }

  private setSubtitle(text: string): void {
    if (this.subtitleMesh) {
      this.deskRoot.remove(this.subtitleMesh);
    }
    this.subtitleMesh = this.createCleanPillBadge(
      text,
      0.56,
      0.065,
      '#00f0ff',
    );
    this.subtitleMesh.position.set(0, 0.32, -0.08);
    this.deskRoot.add(this.subtitleMesh);

    const hudHeader = document.getElementById('lumadesk-coach-text');
    if (hudHeader) {
      hudHeader.textContent = text;
    }
  }

  private checkActiveXRHandMovement(): void {
    const origin = (this.world as any).input?.xr?.xrOrigin;
    if (!origin?.raySpaces) return;

    const rRight = origin.raySpaces.right;
    if (rRight) {
      rRight.updateWorldMatrix(true, false);
      this.tempVec.setFromMatrixPosition(rRight.matrixWorld);
      if (this.tempVec.distanceToSquared(this.lastRightRayPos) > 0.000025) {
        this.lastRightRayPos.copy(this.tempVec);
        this.activeXRHandSide = 'right';
        this.xrHandActiveUntil = performance.now() + 1800;
      }
    }

    const rLeft = origin.raySpaces.left;
    if (rLeft) {
      rLeft.updateWorldMatrix(true, false);
      this.tempVec.setFromMatrixPosition(rLeft.matrixWorld);
      if (this.tempVec.distanceToSquared(this.lastLeftRayPos) > 0.000025) {
        this.lastLeftRayPos.copy(this.tempVec);
        this.activeXRHandSide = 'left';
        this.xrHandActiveUntil = performance.now() + 1800;
      }
    }
  }

  update(delta: number, time: number): void {
    if (!this.deskPositioned && this.player?.head) {
      this.player.head.updateWorldMatrix(true, false);
      this.tempVec.setFromMatrixPosition(this.player.head.matrixWorld);
      if (this.tempVec.y > 0.5) {
        this.deskRoot.position.set(
          this.tempVec.x,
          this.tempVec.y - 0.18,
          this.tempVec.z - 0.62,
        );
        this.deskRoot.rotation.set(0, 0, 0);
        this.deskPositioned = true;
      }
    }

    this.attachOfficialXRRayLinesIfReady();
    this.checkActiveXRHandMovement();
    this.updateProgressiveFocusVisibility();
    this.updateFocusTimer(delta);

    const hit = this.findHitTarget();
    if (this.hoveredTarget && this.hoveredTarget !== hit) {
      this.setTargetVisualHover(this.hoveredTarget, false);
    }
    this.hoveredTarget = hit;
    if (hit) {
      this.setTargetVisualHover(hit, true);
    }

    if (this.heldTool !== 'NONE') {
      this.updateHeldGardenToolPosition();
    }

    if (this.waterDropsGroup.visible) {
      this.waterDropsGroup.children.forEach((drop, idx) => {
        drop.position.y = -((time * 0.45 + idx * 0.03) % 0.16);
      });
    }

    const nowSec = performance.now() * 0.001;

    this.lumaGroup.position.y = 0.12 + Math.sin(nowSec * 2.2) * 0.009;
    this.lumaHaloMesh.rotation.z = nowSec * 1.2;

    if (this.witPlasmaOrbGroup) {
      const isListeningPulse = performance.now() < this.plasmaPulseActiveUntil;
      const speedMult = isListeningPulse ? 3.2 : 1.0;

      this.witPlasmaOrbGroup.position.y =
        0.11 + Math.sin(nowSec * 2.4) * 0.007;

      if (this.plasmaCyanShell && this.plasmaPinkShell) {
        this.plasmaCyanShell.rotation.y = nowSec * 0.55 * speedMult;
        this.plasmaCyanShell.rotation.z = Math.sin(nowSec * 1.1) * 0.25;
        this.plasmaPinkShell.rotation.y = -nowSec * 0.75 * speedMult;
        this.plasmaPinkShell.rotation.x = Math.cos(nowSec * 1.2) * 0.3;
      }

      if (this.plasmaWaveRing1 && this.plasmaWaveRing2) {
        this.plasmaWaveRing1.rotation.z = Math.sin(nowSec * 0.8) * 0.18;
        this.plasmaWaveRing2.rotation.z = -nowSec * 0.45 * speedMult;
        const pulseScale =
          1.0 + Math.sin(nowSec * (isListeningPulse ? 9.0 : 2.8)) * 0.06;
        this.plasmaWaveRing2.scale.setScalar(pulseScale);
      }
    }

    this.skyBirds.forEach((b) => {
      const t = nowSec * b.speed + b.phaseOffset;
      const targetX = Math.sin(t) * b.radiusX;
      const targetY = b.baseY + Math.sin(t * 2.0) * 0.055;
      const targetZ = b.baseZ + Math.cos(t) * 0.15;

      const vx = Math.cos(t) * b.radiusX;
      const vz = -Math.sin(t) * 0.15;

      b.group.position.set(targetX, targetY, targetZ);
      b.group.rotation.y = Math.atan2(vx, Math.abs(vz) + 0.45) * 0.65;
      b.group.rotation.z = -vx * 0.22;

      const flapAngle = Math.sin(nowSec * 8.5 + b.phaseOffset) * 0.62;
      b.leftWing.rotation.z = -flapAngle;
      b.rightWing.rotation.z = flapAngle;
    });

    this.worldGenerator.update(delta, nowSec);
    if (store.state.appMode === 'QUEST') {
      this.questModule.update(delta, nowSec);
    } else {
      if (
        this.sandboxModule.isHoldingBrush &&
        this.sandboxModule.airCanvasPlane
      ) {
        const hits = this.raycaster.intersectObject(
          this.sandboxModule.airCanvasPlane,
          false,
        );
        if (hits.length > 0) {
          this.brushLocalPos.copy(hits[0].point);
          this.sandboxModule.group.worldToLocal(this.brushLocalPos);
          this.sandboxModule.moveBrushAndPaint(this.brushLocalPos);
        }
      }
      this.sandboxModule.update(delta, nowSec);
    }
  }

  private setTargetVisualHover(
    target: InteractiveTarget,
    isHovered: boolean,
  ): void {
    const scaleMult = isHovered ? 1.14 : 1.0;

    const mat = (target.mesh as Mesh).material as
      | MeshBasicMaterial
      | undefined;
    if (
      mat &&
      mat.transparent &&
      mat.opacity === 0 &&
      target.mesh.parent &&
      target.mesh.parent !== this.deskRoot
    ) {
      target.mesh.parent.scale.setScalar(scaleMult);
    } else {
      target.mesh.scale.setScalar(target.baseScale * scaleMult);
    }
  }

  private registerTarget(
    id: string,
    mesh: Mesh | Group,
    onTrigger: () => void,
  ): void {
    this.unregisterTarget(id);
    this.targets.push({ id, mesh, baseScale: mesh.scale.x || 1, onTrigger });
  }

  private unregisterTarget(id: string): void {
    this.targets = this.targets.filter((t) => t.id !== id);
  }

  private clearDynamicTargets(): void {
    this.targets = this.targets.filter((t) => t.id.startsWith('permanent_'));
  }

  private triggerWithCooldown(fn: () => void): void {
    const now = performance.now();
    if (now - this.lastTriggerTime < 220) return;
    this.lastTriggerTime = now;
    fn();
  }

  private findHitTarget(): InteractiveTarget | null {
    if (this.activeHitCursorDot) {
      this.activeHitCursorDot.visible = false;
    }

    const active = this.targets.filter((t) => {
      if (!t.mesh.parent) return false;
      let p: any = t.mesh;
      while (p) {
        if (p.visible === false) return false;
        p = p.parent;
      }
      return true;
    });
    const meshes = active.map((t) => t.mesh);
    const worldPos = new Vector3();
    const projectedPoint = new Vector3();

    const castRayAndMeasure = (
      rayOrigin: Vector3,
    ): { target: InteractiveTarget | null; distance: number } => {
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        for (const h of hits) {
          let obj: any = h.object;
          while (obj) {
            const found = active.find((t) => t.mesh === obj);
            if (found) {
              return { target: found, distance: h.distance };
            }
            obj = obj.parent;
          }
        }
      }

      let closestTarget: InteractiveTarget | null = null;
      let bestDistSq = 0.026 * 0.026;
      let bestRayDistance = 0.55;

      for (const t of active) {
        t.mesh.getWorldPosition(worldPos);
        const distSq = this.raycaster.ray.distanceSqToPoint(worldPos);
        if (distSq < bestDistSq) {
          this.raycaster.ray.closestPointToPoint(worldPos, projectedPoint);
          const dAlongRay = rayOrigin.distanceTo(projectedPoint);
          if (dAlongRay > 0.05 && dAlongRay < 1.6) {
            bestDistSq = distSq;
            closestTarget = t;
            bestRayDistance = dAlongRay;
          }
        }
      }

      return { target: closestTarget, distance: bestRayDistance };
    };

    const xrOrigin = (this.world as any).input?.xr?.xrOrigin;
    const rightSpace = xrOrigin?.raySpaces?.right;
    const leftSpace = xrOrigin?.raySpaces?.left;

    if (rightSpace || leftSpace) {
      const orderedSides: Array<'right' | 'left'> =
        this.activeXRHandSide === 'left'
          ? ['left', 'right']
          : ['right', 'left'];

      let winningTarget: InteractiveTarget | null = null;

      for (const side of orderedSides) {
        const rSpace = xrOrigin?.raySpaces?.[side];
        if (!rSpace) continue;

        rSpace.updateWorldMatrix(true, false);
        const rayOrigin = new Vector3().setFromMatrixPosition(
          rSpace.matrixWorld,
        );
        if (rayOrigin.lengthSq() < 0.001) continue;

        const rayDir = new Vector3(0, 0, -1)
          .applyMatrix4(rSpace.matrixWorld)
          .sub(rayOrigin)
          .normalize();
        this.raycaster.set(rayOrigin, rayDir);

        const res = castRayAndMeasure(rayOrigin);
        const rayGroup = rSpace.getObjectByName?.(`luma_xr_ray_${side}`);
        const beam = rayGroup?.getObjectByName?.('ray_beam') as
          | Mesh
          | undefined;
        const tip = rayGroup?.getObjectByName?.('ray_tip') as Mesh | undefined;

        if (beam && tip) {
          const d = res.target
            ? Math.max(0.08, Math.min(1.4, res.distance))
            : 0.52;
          beam.scale.set(1, 1, d);
          tip.position.set(0, 0, -d);

          const isHit = res.target != null && !winningTarget;
          (beam.material as MeshBasicMaterial).color.setHex(
            isHit ? 0x00f0ff : 0xffffff,
          );
          (tip.material as MeshBasicMaterial).color.setHex(
            isHit ? 0xfacc15 : 0x00f0ff,
          );
          tip.scale.setScalar(isHit ? 1.45 : 1.0);
        }

        if (res.target && !winningTarget) {
          winningTarget = res.target;
        }
      }

      if (winningTarget) {
        return winningTarget;
      }
    }

    this.raycaster.setFromCamera(this.mouseNDC, this.world.camera);
    const camOrigin = new Vector3().setFromMatrixPosition(
      this.world.camera.matrixWorld,
    );
    const mouseRes = castRayAndMeasure(camOrigin);
    return mouseRes.target;
  }

  private createCleanPillBadge(
    text: string,
    width: number,
    height: number,
    borderHex: string,
  ): Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 250;
    const ctx = canvas.getContext('2d')!;

    const r = 56;
    const w = canvas.width - 20;
    const h = canvas.height - 20;
    const x = 10;
    const y = 10;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    const glassGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    glassGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    glassGrad.addColorStop(1, 'rgba(6, 10, 22, 0.98)');
    ctx.fillStyle = glassGrad;
    ctx.fill();

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = 56;
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    while (ctx.measureText(text).width > canvas.width - 96 && fontSize > 28) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    }
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 8;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    const mat = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
    });
    const mesh = new Mesh(new PlaneGeometry(width, height), mat);
    mesh.rotation.x = -0.12;
    return mesh;
  }

  private speak(text: string): void {
    if (!store.state.voiceEnabled || typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.96;
        u.pitch = 1.08;
        window.speechSynthesis.speak(u);
      }
    } catch {
      // Ignore speech errors
    }
  }

  private playChime(freq: number, duration: number): void {
    if (store.state.sanctuaryPaused) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new window.AudioContext();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.09, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + duration,
      );
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Ignore audio block
    }
  }
}