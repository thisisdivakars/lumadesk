import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { store, TherapyStage } from '../state/store.js';

export type TotemModelType =
  | 'water_cup'
  | 'toothbrush'
  | 'backpack'
  | 'headphones_shield'
  | 'transit_pass'
  | 'seat_anchor'
  | 'desk_organizer'
  | 'book_open_close'
  | 'pencil_write'
  | 'night_lamp'
  | 'phone_sleep'
  | 'moon_pillow';

export interface QuestDefinition {
  questNumber: string;
  contextTag: 'MORNING' | 'COMMUTE' | 'STUDY' | 'WINDDOWN';
  title: string;
  voiceIntro: string;
  chaosShape: 'spiky_orb' | 'noise_ring' | 'spinning_cube' | 'worry_diamond';
  chaosColor: number;
  chaosLabel: string;
  totems: [
    { label: string; color: number; model: TotemModelType },
    { label: string; color: number; model: TotemModelType },
    { label: string; color: number; model: TotemModelType },
  ];
  socialPrompt: string;
  overthinkingTrap: string;
  calmTruth: string;
  draftedReply: string;
}

export const CLINICAL_QUESTS: QuestDefinition[] = [
  {
    questNumber: 'CONTEXT 1 OF 4',
    contextTag: 'MORNING',
    title: '☀️ Morning Self-Care & School Pack',
    voiceIntro:
      'Good morning! Your water pitcher is reset for a new day. Pop the 4 red morning rush orbs!',
    chaosShape: 'spiky_orb',
    chaosColor: 0xf43f5e,
    chaosLabel: 'Morning Rush Static',
    totems: [
      { label: '1. Morning Water', color: 0x38bdf8, model: 'water_cup' },
      { label: '2. Brush Teeth', color: 0x10b981, model: 'toothbrush' },
      { label: '3. Pack School Bag', color: 0xa855f7, model: 'backpack' },
    ],
    socialPrompt: 'Friend texts: "Are you coming? You are running late!"',
    overthinkingTrap: 'Rumination: "Everyone is angry at me!"',
    calmTruth: 'Core Truth: They just want my arrival time.',
    draftedReply: '"On my way! Packed my bag, see you in 15 mins."',
  },
  {
    questNumber: 'CONTEXT 2 OF 4',
    contextTag: 'COMMUTE',
    title: '🚌 Commute & Transit Sensory Shield',
    voiceIntro:
      'Context 2: Commute Shield! Pop the 4 cyan transit noise rings before boarding the bus.',
    chaosShape: 'noise_ring',
    chaosColor: 0x06b6d4,
    chaosLabel: 'Transit Crowd & Siren Noise',
    totems: [
      {
        label: '1. Noise Headphones',
        color: 0x38bdf8,
        model: 'headphones_shield',
      },
      { label: '2. Check Bus Pass', color: 0x10b981, model: 'transit_pass' },
      { label: '3. Calm Seat Fidget', color: 0xa855f7, model: 'seat_anchor' },
    ],
    socialPrompt: 'Bus is crowded and someone bumps your backpack.',
    overthinkingTrap: 'Rumination: "I am trapped and they did it on purpose!"',
    calmTruth: 'Core Truth: Crowded buses bump everyone—my headphones keep me safe.',
    draftedReply: '"Put my headphones on and found my spot—arriving soon!"',
  },
  {
    questNumber: 'CONTEXT 3 OF 4',
    contextTag: 'STUDY',
    title: '📚 Study & Open Book Focus',
    voiceIntro:
      'Context 3: Study Focus! Smash the 4 purple distraction cubes so we can open our book.',
    chaosShape: 'spinning_cube',
    chaosColor: 0xc026d3,
    chaosLabel: 'Video & Tab Distraction',
    totems: [
      { label: '1. Organize Desk', color: 0xf59e0b, model: 'desk_organizer' },
      { label: '2. Open Study Book', color: 0x06b6d4, model: 'book_open_close' },
      { label: '3. Write 1st Answer', color: 0xec4899, model: 'pencil_write' },
    ],
    socialPrompt: 'Homework instructions look huge and confusing.',
    overthinkingTrap: 'Rumination: "Asking for help makes me look weak."',
    calmTruth: 'Core Truth: Asking 1 clear question builds autonomy.',
    draftedReply:
      '"Hi Teacher, should Part 1 focus on the chart or summary? Starting now!"',
  },
  {
    questNumber: 'CONTEXT 4 OF 4',
    contextTag: 'WINDDOWN',
    title: '🌙 Evening Dim Lights & Wind-Down',
    voiceIntro:
      'Context 4: Evening Wind-Down! Clear the 4 amber worry diamonds before bedtime.',
    chaosShape: 'worry_diamond',
    chaosColor: 0xf97316,
    chaosLabel: 'Late-Night Worry Loop',
    totems: [
      { label: '1. Dim Room Lamp', color: 0xfbbf24, model: 'night_lamp' },
      { label: '2. Park Phone Away', color: 0x14b8a6, model: 'phone_sleep' },
      { label: '3. Rest on Pillow', color: 0x818cf8, model: 'moon_pillow' },
    ],
    socialPrompt: 'Friend sends long venting messages at bedtime.',
    overthinkingTrap: 'Rumination: "I must solve their problem tonight!"',
    calmTruth: 'Core Truth: I can care about friends AND protect my sleep.',
    draftedReply:
      '"So sorry today was rough! Heading to sleep now, let’s talk tomorrow."',
  },
];

export const PENTATONIC_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

export interface StageCallbacks {
  registerTarget: (id: string, mesh: Mesh | Group, fn: () => void) => void;
  unregisterTarget: (id: string) => void;
  clearStageTargets: () => void;
  setSubtitle: (text: string) => void;
  speak: (text: string) => void;
  playChime: (freq: number, dur?: number) => void;
  createPillBadge: (
    text: string,
    w: number,
    h: number,
    borderHex: string,
  ) => Mesh;
  setLumaMood: (mood: 'stressed' | 'calm' | 'happy') => void;
  onEveningDimChanged: (dimmed: boolean) => void;
  onMorningWaterReset: () => void;
  onTriggerHydrationAlert: () => void;
  onQuestCompleted: () => void;
}

export class TherapyQuestModule {
  public group = new Group();
  private cb: StageCallbacks;

  private chaosOrbs: Mesh[] = [];
  private chaosRemaining = 0;
  private spawnTimestamp = 0;

  private breathTargetRing!: Mesh;
  private breathExpandingRing!: Mesh;
  private breathCount = 0;

  private totemGroups: Group[] = [];
  private bridgeSlots: Mesh[] = [];
  private totemStep = 0;

  private overthinkingOrb: Mesh | null = null;

  constructor(callbacks: StageCallbacks) {
    this.cb = callbacks;
  }

  public startStage(stage: TherapyStage): void {
    this.clearMeshes();
    store.state.currentStage = stage;
    store.save();

    const quest = CLINICAL_QUESTS[store.state.activeQuestIndex];

    if (
      quest.contextTag === 'MORNING' &&
      stage === 'STAGE_1_MOTOR_POP'
    ) {
      this.cb.onEveningDimChanged(false);
      this.cb.onMorningWaterReset();
    } else if (quest.contextTag !== 'WINDDOWN') {
      this.cb.onEveningDimChanged(false);
    }

    const questHeader = this.cb.createPillBadge(
      `${quest.questNumber}: ${quest.title}`,
      0.48,
      0.052,
      '#fbbf24',
    );
    questHeader.position.set(0, 0.23, -0.06);
    this.group.add(questHeader);

    if (stage === 'STAGE_1_MOTOR_POP') {
      this.buildStage1MotorPop();
    } else if (stage === 'STAGE_2_BREATH_SYNC') {
      this.buildStage2BreathSync();
    } else if (stage === 'STAGE_3_TOTEM_SEQUENCE') {
      this.buildStage3TotemSequence();
    } else if (stage === 'STAGE_4_SOCIAL_DECODER') {
      this.buildStage4SocialDecoder();
    }
  }

  private buildStage1MotorPop(): void {
    const quest = CLINICAL_QUESTS[store.state.activeQuestIndex];
    this.cb.setLumaMood('stressed');
    this.chaosOrbs = [];
    this.spawnTimestamp = performance.now();

    const positions = [
      new Vector3(-0.18, 0.14, 0.08),
      new Vector3(0.18, 0.15, 0.08),
      new Vector3(-0.14, 0.01, 0.13),
      new Vector3(0.15, 0.02, 0.13),
    ];
    this.chaosRemaining = positions.length;

    positions.forEach((pos, idx) => {
      let geo;
      if (quest.chaosShape === 'spiky_orb') {
        geo = new IcosahedronGeometry(0.042, 0);
      } else if (quest.chaosShape === 'noise_ring') {
        geo = new TorusGeometry(0.036, 0.012, 12, 24);
      } else if (quest.chaosShape === 'spinning_cube') {
        geo = new BoxGeometry(0.062, 0.062, 0.062);
      } else {
        geo = new OctahedronGeometry(0.048, 0);
      }

      const orb = new Mesh(
        geo,
        new MeshStandardMaterial({
          color: quest.chaosColor,
          emissive: quest.chaosColor,
          emissiveIntensity: 0.45,
          roughness: 0.25,
        }),
      );
      orb.position.copy(pos);
      orb.userData.baseY = pos.y;
      orb.userData.idx = idx;
      this.group.add(orb);
      this.chaosOrbs.push(orb);

      const id = `chaos_${idx}`;
      this.cb.registerTarget(id, orb, () => this.popChaosOrb(id, orb));
    });

    this.cb.setSubtitle(
      `${quest.questNumber} — Stage 1: Pop the 4 ${quest.chaosLabel} shapes!`,
    );
    this.cb.speak(quest.voiceIntro);
  }

  private popChaosOrb(id: string, orb: Mesh): void {
    if (!orb.visible) return;
    this.cb.unregisterTarget(id);
    orb.visible = false;
    this.chaosRemaining--;

    const reaction = Math.min(2500, performance.now() - this.spawnTimestamp);
    this.spawnTimestamp = performance.now();
    store.recordMotorPop(reaction);

    this.cb.playChime(PENTATONIC_NOTES[4 - this.chaosRemaining] || 523.25, 0.2);

    if (this.chaosRemaining > 0) {
      this.cb.setSubtitle(
        `Nice motor aim! ${this.chaosRemaining} shapes left to clear.`,
      );
    } else {
      setTimeout(() => this.startStage('STAGE_2_BREATH_SYNC'), 350);
    }
  }

  private buildStage2BreathSync(): void {
    this.cb.setLumaMood('calm');
    this.breathCount = 0;

    if (store.state.telemetry.waterCupsToday < 4) {
      this.cb.onTriggerHydrationAlert();
    }

    this.breathTargetRing = new Mesh(
      new RingGeometry(0.125, 0.14, 48),
      new MeshBasicMaterial({ color: 0xfbbf24, side: DoubleSide }),
    );
    this.breathTargetRing.position.set(0, 0.11, -0.05);
    this.group.add(this.breathTargetRing);

    this.breathExpandingRing = new Mesh(
      new RingGeometry(0.06, 0.075, 48),
      new MeshBasicMaterial({ color: 0x00f0ff, side: DoubleSide }),
    );
    this.breathExpandingRing.position.set(0, 0.11, -0.045);
    this.group.add(this.breathExpandingRing);

    this.cb.registerTarget('breath_ring', this.breathTargetRing, () =>
      this.triggerBreathPulse(),
    );

    this.cb.setSubtitle(
      'Stage 2 (Calm Breath): Tap Luma or SPACE 3 times with the breathing ring!',
    );
    this.cb.speak('Stage 2: Tap three times as the blue ring expands.');
  }

  public triggerBreathPulse(): void {
    if (store.state.currentStage !== 'STAGE_2_BREATH_SYNC') return;
    this.breathCount++;
    store.state.telemetry.breathPulsesSynced++;
    store.addSparks(5);
    this.cb.playChime(PENTATONIC_NOTES[this.breathCount + 1], 0.35);

    (this.breathTargetRing.material as MeshBasicMaterial).color.setHex(0x10b981);
    setTimeout(() => {
      if (this.breathTargetRing?.material) {
        (this.breathTargetRing.material as MeshBasicMaterial).color.setHex(
          0xfbbf24,
        );
      }
    }, 250);

    if (this.breathCount < 3) {
      this.cb.setSubtitle(
        `✨ Breath ${this.breathCount}/3 synced! Calm Battery: ${store.state.telemetry.stressRestBattery}%`,
      );
    } else {
      setTimeout(() => this.startStage('STAGE_3_TOTEM_SEQUENCE'), 380);
    }
  }

  private createDedicated3DTotemModel(
    modelType: TotemModelType,
    colorHex: number,
  ): Group {
    const itemGroup = new Group();
    const mainMat = new MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.3,
      roughness: 0.25,
    });
    const whiteMat = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
    });

    if (modelType === 'headphones_shield') {
      // 3D Over-Ear Noise-Canceling Headphones
      const headband = new Mesh(
        new TorusGeometry(0.032, 0.005, 10, 24, Math.PI),
        mainMat,
      );
      const leftCup = new Mesh(
        new CylinderGeometry(0.016, 0.016, 0.014, 16),
        mainMat,
      );
      leftCup.rotation.z = Math.PI / 2;
      leftCup.position.set(-0.032, -0.005, 0);
      const rightCup = new Mesh(
        new CylinderGeometry(0.016, 0.016, 0.014, 16),
        mainMat,
      );
      rightCup.rotation.z = Math.PI / 2;
      rightCup.position.set(0.032, -0.005, 0);
      itemGroup.add(headband, leftCup, rightCup);
    } else if (modelType === 'transit_pass') {
      // 3D Bus Pass Card & Lanyard Ring
      const card = new Mesh(new BoxGeometry(0.052, 0.072, 0.006), mainMat);
      const stripe = new Mesh(new BoxGeometry(0.044, 0.014, 0.008), whiteMat);
      stripe.position.set(0, 0.012, 0);
      const clip = new Mesh(
        new TorusGeometry(0.01, 0.003, 8, 16),
        new MeshBasicMaterial({ color: 0xfbbf24 }),
      );
      clip.position.set(0, 0.044, 0);
      itemGroup.add(card, stripe, clip);
    } else if (modelType === 'seat_anchor') {
      // 3D Tactile Gyro Fidget Stone for Bus Ride
      const core = new Mesh(new OctahedronGeometry(0.026, 0), mainMat);
      const ring = new Mesh(
        new TorusGeometry(0.036, 0.005, 10, 24),
        new MeshBasicMaterial({ color: 0xfbbf24 }),
      );
      itemGroup.add(core, ring);
    } else if (modelType === 'book_open_close') {
      const leftHalf = new Group();
      const leftCover = new Mesh(new BoxGeometry(0.045, 0.068, 0.006), mainMat);
      leftCover.position.set(-0.022, 0, 0);
      const leftPages = new Mesh(
        new BoxGeometry(0.04, 0.062, 0.01),
        whiteMat,
      );
      leftPages.position.set(-0.02, 0, 0.005);
      leftHalf.add(leftCover, leftPages);

      const rightHalf = new Group();
      const rightCover = new Mesh(
        new BoxGeometry(0.045, 0.068, 0.006),
        mainMat,
      );
      rightCover.position.set(0.022, 0, 0);
      const rightPages = new Mesh(
        new BoxGeometry(0.04, 0.062, 0.01),
        whiteMat,
      );
      rightPages.position.set(0.02, 0, 0.005);
      rightHalf.add(rightCover, rightPages);

      leftHalf.rotation.y = 0.65;
      rightHalf.rotation.y = -0.65;
      itemGroup.userData.leftWing = leftHalf;
      itemGroup.userData.rightWing = rightHalf;
      itemGroup.add(leftHalf, rightHalf);
    } else if (modelType === 'backpack') {
      const packBody = new Mesh(new BoxGeometry(0.062, 0.075, 0.038), mainMat);
      const pocket = new Mesh(
        new BoxGeometry(0.046, 0.036, 0.016),
        new MeshStandardMaterial({ color: 0xfbbf24 }),
      );
      pocket.position.set(0, -0.012, 0.022);
      const handle = new Mesh(
        new TorusGeometry(0.014, 0.004, 8, 16),
        new MeshBasicMaterial({ color: 0xfbbf24 }),
      );
      handle.position.set(0, 0.042, 0);
      itemGroup.add(packBody, pocket, handle);
    } else if (modelType === 'toothbrush') {
      const handle = new Mesh(
        new CylinderGeometry(0.006, 0.007, 0.085, 12),
        mainMat,
      );
      handle.rotation.z = 0.35;
      const bristles = new Mesh(
        new BoxGeometry(0.014, 0.022, 0.012),
        whiteMat,
      );
      bristles.position.set(-0.018, 0.03, 0);
      bristles.rotation.z = 0.35;
      const paste = new Mesh(
        new SphereGeometry(0.008, 10, 10),
        new MeshBasicMaterial({ color: 0x38bdf8 }),
      );
      paste.position.set(-0.024, 0.034, 0);
      itemGroup.add(handle, bristles, paste);
    } else if (modelType === 'water_cup') {
      const cup = new Mesh(
        new CylinderGeometry(0.028, 0.022, 0.07, 20),
        mainMat,
      );
      const straw = new Mesh(
        new CylinderGeometry(0.004, 0.004, 0.045, 8),
        whiteMat,
      );
      straw.position.set(0.01, 0.04, 0);
      straw.rotation.z = -0.25;
      itemGroup.add(cup, straw);
    } else if (modelType === 'pencil_write') {
      const shaft = new Mesh(
        new CylinderGeometry(0.009, 0.009, 0.075, 12),
        new MeshStandardMaterial({ color: 0xfacc15 }),
      );
      const tip = new Mesh(new ConeGeometry(0.009, 0.022, 12), whiteMat);
      tip.rotation.x = Math.PI;
      tip.position.y = -0.048;
      const eraser = new Mesh(
        new CylinderGeometry(0.009, 0.009, 0.016, 12),
        new MeshStandardMaterial({ color: 0xf472b6 }),
      );
      eraser.position.y = 0.044;
      itemGroup.add(shaft, tip, eraser);
      itemGroup.rotation.z = -0.35;
    } else if (modelType === 'night_lamp') {
      const base = new Mesh(
        new CylinderGeometry(0.018, 0.025, 0.015, 16),
        whiteMat,
      );
      base.position.y = -0.032;
      const stem = new Mesh(
        new CylinderGeometry(0.005, 0.005, 0.045, 10),
        whiteMat,
      );
      stem.position.y = -0.01;
      const shade = new Mesh(
        new ConeGeometry(0.036, 0.045, 20, 1, true),
        mainMat,
      );
      shade.position.y = 0.022;
      itemGroup.add(base, stem, shade);
    } else if (modelType === 'phone_sleep') {
      const body = new Mesh(
        new BoxGeometry(0.042, 0.078, 0.008),
        new MeshStandardMaterial({ color: 0x1e293b }),
      );
      const screen = new Mesh(new BoxGeometry(0.036, 0.066, 0.002), mainMat);
      screen.position.z = 0.005;
      itemGroup.add(body, screen);
    } else if (modelType === 'moon_pillow') {
      const pillow = new Mesh(new BoxGeometry(0.068, 0.045, 0.024), mainMat);
      const moon = new Mesh(
        new TorusGeometry(0.02, 0.006, 10, 24, Math.PI * 1.3),
        new MeshBasicMaterial({ color: 0xfde047 }),
      );
      moon.position.set(0, 0.042, 0);
      itemGroup.add(pillow, moon);
    } else {
      const caddy = new Mesh(new BoxGeometry(0.06, 0.05, 0.04), mainMat);
      const pen1 = new Mesh(
        new CylinderGeometry(0.005, 0.005, 0.04, 8),
        whiteMat,
      );
      pen1.position.set(-0.012, 0.03, 0);
      const pen2 = new Mesh(
        new CylinderGeometry(0.005, 0.005, 0.04, 8),
        new MeshBasicMaterial({ color: 0x38bdf8 }),
      );
      pen2.position.set(0.012, 0.03, 0);
      itemGroup.add(caddy, pen1, pen2);
    }

    return itemGroup;
  }

  private buildStage3TotemSequence(): void {
    const quest = CLINICAL_QUESTS[store.state.activeQuestIndex];
    this.totemStep = 0;
    this.totemGroups = [];
    this.bridgeSlots = [];
    const xPos = [-0.17, 0, 0.17];

    xPos.forEach((x, idx) => {
      const slot = new Mesh(
        new CylinderGeometry(0.042, 0.042, 0.012, 24),
        new MeshStandardMaterial({
          color: 0x1e293b,
          emissive: idx === 0 ? 0x00f0ff : 0x000000,
          emissiveIntensity: 0.6,
        }),
      );
      slot.position.set(x, -0.16, 0.14);
      this.group.add(slot);
      this.bridgeSlots.push(slot);
    });

    quest.totems.forEach((t, idx) => {
      const g = new Group();
      g.position.set(xPos[idx], 0.02, 0.1);

      const modelGroup = this.createDedicated3DTotemModel(t.model, t.color);
      g.add(modelGroup);

      const hitProxy = new Mesh(
        new SphereGeometry(0.055, 12, 12),
        new MeshBasicMaterial({ transparent: true, opacity: 0.0 }),
      );
      g.add(hitProxy);

      const badge = this.cb.createPillBadge(
        t.label,
        0.165,
        0.046,
        idx === 0 ? '#00f0ff' : '#64748b',
      );
      badge.position.set(0, -0.068, 0.02);
      g.add(badge);

      g.userData.modelType = t.model;
      g.userData.modelGroup = modelGroup;

      this.group.add(g);
      this.totemGroups.push(g);

      const triggerFn = () => {
        if (idx === this.totemStep) {
          this.lockNextTotem();
        } else {
          this.cb.playChime(220, 0.14);
          this.cb.setSubtitle(
            `Follow 1-2-3 order! Tap glowing #${this.totemStep + 1} (${quest.totems[this.totemStep].label}) first.`,
          );
        }
      };

      this.cb.registerTarget(`totem_${idx}`, hitProxy, triggerFn);
      this.cb.registerTarget(`totem_badge_${idx}`, badge, triggerFn);
    });

    this.cb.setSubtitle(
      `Stage 3 (${quest.title}): Tap the 3D Objects in order (1 ➔ 2 ➔ 3)!`,
    );
    this.cb.speak(`Tap your 3 ${quest.title} items in order.`);
  }

  private lockNextTotem(): void {
    const idx = this.totemStep;
    const g = this.totemGroups[idx];
    const slot = this.bridgeSlots[idx];
    if (!g || !slot) return;

    this.cb.unregisterTarget(`totem_${idx}`);
    this.cb.unregisterTarget(`totem_badge_${idx}`);
    this.cb.playChime(PENTATONIC_NOTES[idx + 2], 0.25);

    const modelType = g.userData.modelType as TotemModelType;
    const modelGroup = g.userData.modelGroup as Group;

    if (modelType === 'book_open_close' && modelGroup) {
      if (modelGroup.userData.leftWing)
        modelGroup.userData.leftWing.rotation.y = 0.12;
      if (modelGroup.userData.rightWing)
        modelGroup.userData.rightWing.rotation.y = -0.12;
    } else if (modelType === 'night_lamp') {
      this.cb.onEveningDimChanged(true);
    } else if (modelType === 'phone_sleep' && modelGroup) {
      modelGroup.rotation.x = Math.PI / 2;
    }

    g.position.set(slot.position.x, -0.11, slot.position.z);
    (slot.material as MeshStandardMaterial).color.setHex(0x10b981);
    (slot.material as MeshStandardMaterial).emissive.setHex(0x10b981);

    this.totemStep++;
    store.addSparks(5);

    if (this.totemStep < 3) {
      (
        this.bridgeSlots[this.totemStep].material as MeshStandardMaterial
      ).emissive.setHex(0x00f0ff);
      const nextLabel =
        CLINICAL_QUESTS[store.state.activeQuestIndex].totems[this.totemStep]
          .label;
      this.cb.setSubtitle(
        `Step ${this.totemStep}/3 done! Now tap #${this.totemStep + 1}: ${nextLabel}`,
      );
    } else {
      store.state.telemetry.selfCareBridgesBuilt++;
      store.state.gardenSeeds++;
      store.save();
      setTimeout(() => this.startStage('STAGE_4_SOCIAL_DECODER'), 450);
    }
  }

  private buildStage4SocialDecoder(): void {
    const quest = CLINICAL_QUESTS[store.state.activeQuestIndex];

    const truthCard = this.cb.createPillBadge(
      `${quest.calmTruth}`,
      0.48,
      0.06,
      '#10b981',
    );
    truthCard.position.set(0, 0.02, 0.08);
    this.group.add(truthCard);

    const orb = new Mesh(
      new SphereGeometry(0.042, 24, 24),
      new MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.6,
      }),
    );
    orb.position.set(0, -0.08, 0.14);

    const orbTag = this.cb.createPillBadge(
      `Pop ${quest.overthinkingTrap}`,
      0.42,
      0.052,
      '#f43f5e',
    );
    orbTag.position.set(0, -0.07, 0.02);
    orb.add(orbTag);

    this.group.add(orb);
    this.overthinkingOrb = orb;

    this.cb.registerTarget('decode_orb', orb, () =>
      this.completeSocialDecoder(),
    );

    this.cb.setSubtitle(
      `Stage 4: Pop the Red Orb to earn +15✨ Sparks & +1🌱 Garden Seed!`,
    );
    this.cb.speak(
      'Final Stage: Pop the red worry orb to unlock your calm reply and earn a garden seed!',
    );
  }

  private completeSocialDecoder(): void {
    const quest = CLINICAL_QUESTS[store.state.activeQuestIndex];
    this.cb.unregisterTarget('decode_orb');
    this.clearMeshes();

    store.state.telemetry.socialMessagesDecoded++;
    store.state.telemetry.ruminationsParked++;
    store.state.gardenSeeds++;
    store.addSparks(15);
    this.cb.setLumaMood('happy');
    this.cb.playChime(783.99, 0.4);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(quest.draftedReply).catch(() => {});
    }

    this.cb.setSubtitle(
      `🎉 ${quest.title} Done (+15✨ & +1🌱 Seed)! Pick a Seed on the Right Table!`,
    );
    this.cb.speak(
      'Routine complete! Look at your right garden table to plant your new seed!',
    );

    setTimeout(() => this.cb.onQuestCompleted(), 900);
  }

  public advanceStep(): void {
    const s = store.state.currentStage;
    if (s === 'STAGE_1_MOTOR_POP') {
      const next = this.chaosOrbs.find((o) => o.visible);
      if (next) this.popChaosOrb(`chaos_${next.userData.idx}`, next);
    } else if (s === 'STAGE_2_BREATH_SYNC') {
      this.triggerBreathPulse();
    } else if (s === 'STAGE_3_TOTEM_SEQUENCE') {
      this.lockNextTotem();
    } else if (s === 'STAGE_4_SOCIAL_DECODER') {
      this.completeSocialDecoder();
    }
  }

  public clearMeshes(): void {
    this.cb.clearStageTargets();
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.overthinkingOrb = null;
  }

  public update(delta: number, time: number): void {
    const s = store.state.currentStage;
    if (s === 'STAGE_1_MOTOR_POP') {
      this.chaosOrbs.forEach((orb, i) => {
        if (orb.visible) {
          orb.rotation.x += delta * 2;
          orb.rotation.y += delta * 2.4;
          orb.position.y =
            orb.userData.baseY + Math.sin(time * 3 + i * 1.4) * 0.022;
        }
      });
    } else if (s === 'STAGE_2_BREATH_SYNC' && this.breathExpandingRing) {
      const cycle = (Math.sin(time * 1.8) + 1) * 0.5;
      this.breathExpandingRing.scale.setScalar(0.8 + cycle * 1.15);
    } else if (s === 'STAGE_3_TOTEM_SEQUENCE') {
      this.totemGroups.forEach((g, idx) => {
        if (idx >= this.totemStep && g.userData.modelGroup) {
          g.userData.modelGroup.rotation.y += delta * 1.2;
        }
      });
    } else if (s === 'STAGE_4_SOCIAL_DECODER' && this.overthinkingOrb) {
      this.overthinkingOrb.position.x = Math.sin(time * 2.8) * 0.06;
    }
  }
}