export type WorldThemeId = 'forest' | 'ocean' | 'dino' | 'space';
export type SensoryProfileId = 'calm' | 'focus' | 'energize';
export type AppMode = 'QUEST' | 'SANDBOX';

export type TherapyStage =
  | 'STAGE_1_MOTOR_POP'
  | 'STAGE_2_BREATH_SYNC'
  | 'STAGE_3_TOTEM_SEQUENCE'
  | 'STAGE_4_SOCIAL_DECODER';

export type KanbanStatus = 'todo' | 'doing' | 'done';

export interface KanbanTask {
  id: string;
  title: string;
  status: KanbanStatus;
}

export interface ChildProfile {
  onboarded: boolean;
  nickname: string;
  birthdayISO: string;
  therapyFocus: string;
  sensoryNotes: string;
  parentPin: string;
  witClientToken?: string;
  lastActiveDate: string;
  streakDays: number;
}

export interface DailyProgressSnapshot {
  date: string;
  waterCups: number;
  mealsLogged: number;
  questsCompleted: number;
  treesBloomed: number;
  avgReactionMs: number;
}

export interface ClinicalTelemetry {
  chaosOrbsPopped: number;
  avgMotorReactionMs: number;
  xylophoneNotesPlayed: number;
  breathPulsesSynced: number;
  stressRestBattery: number;
  selfCareBridgesBuilt: number;
  socialMessagesDecoded: number;
  ruminationsParked: number;
  waterCupsToday: number;
  mealsLoggedToday: number;
  gardenTreesBloomed: number;
  witVoiceCommands?: number;
}

export interface LumaStoreState {
  profile: ChildProfile;
  worldTheme: WorldThemeId;
  sensoryProfile: SensoryProfileId;
  appMode: AppMode;
  currentStage: TherapyStage;
  activeQuestIndex: number;
  completedContexts: boolean[];
  stickyNotes: string[];
  kanbanTasks: KanbanTask[];
  passthroughActive: boolean;
  lumaSparks: number;
  waterDrops: number;
  gardenSeeds: number;
  gardenPods: number[];
  voiceEnabled: boolean;
  sanctuaryPaused: boolean;
  unlockedProps: string[];
  telemetry: ClinicalTelemetry;
  dailyHistory: DailyProgressSnapshot[];
}

const STORAGE_KEY = 'lumadesk_clinical_store_v5';
const DEFAULT_PROPS: string[] = [];

class LumaStateStore {
  public state: LumaStoreState;
  private listeners: Array<() => void> = [];

  constructor() {
    this.state = this.load();
    this.checkAndRollOverDailyProgress();
  }

  private getTodayISO(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private getDefaultState(): LumaStoreState {
    return {
      profile: {
        onboarded: false,
        nickname: 'Aarav',
        birthdayISO: '2016-12-18',
        therapyFocus: 'Occupational & Sensory-Motor Integration',
        sensoryNotes: 'Loves Space & Dinosaurs; sensitive to loud sudden sounds',
        parentPin: '1234',
        witClientToken: '',
        lastActiveDate: this.getTodayISO(),
        streakDays: 3,
      },
      worldTheme: 'forest',
      sensoryProfile: 'calm',
      appMode: 'QUEST',
      currentStage: 'STAGE_1_MOTOR_POP',
      activeQuestIndex: 0,
      completedContexts: [false, false, false, false],
      stickyNotes: ['📌 Pack drawing pad', '📌 Feed pet fish'],
      kanbanTasks: [
        { id: 'k1', title: 'Pack drawing pad', status: 'todo' },
        { id: 'k2', title: 'Read 3 lines of book', status: 'doing' },
        { id: 'k3', title: 'Drink morning water', status: 'done' },
      ],
      passthroughActive: false,
      lumaSparks: 50,
      waterDrops: 3,
      gardenSeeds: 3,
      gardenPods: [1, 2, 0, 0, 0, 0],
      voiceEnabled: true,
      sanctuaryPaused: false,
      unlockedProps: [...DEFAULT_PROPS],
      telemetry: {
        chaosOrbsPopped: 0,
        avgMotorReactionMs: 640,
        xylophoneNotesPlayed: 0,
        breathPulsesSynced: 0,
        stressRestBattery: 80,
        selfCareBridgesBuilt: 0,
        socialMessagesDecoded: 0,
        ruminationsParked: 0,
        waterCupsToday: 2,
        mealsLoggedToday: 1,
        gardenTreesBloomed: 1,
        witVoiceCommands: 0,
      },
      dailyHistory: [
        {
          date: '2026-11-11',
          waterCups: 7,
          mealsLogged: 3,
          questsCompleted: 3,
          treesBloomed: 2,
          avgReactionMs: 710,
        },
        {
          date: '2026-11-12',
          waterCups: 8,
          mealsLogged: 3,
          questsCompleted: 4,
          treesBloomed: 3,
          avgReactionMs: 655,
        },
      ],
    };
  }

  private load(): LumaStoreState {
    const fallback = this.getDefaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<LumaStoreState>;
      const unlocked = Array.from(
        new Set([...DEFAULT_PROPS, ...(parsed.unlockedProps || [])]),
      ).filter((id) => id !== 'crystal_tree');
      return {
        ...fallback,
        ...parsed,
        profile: { ...fallback.profile, ...(parsed.profile || {}) },
        completedContexts:
          Array.isArray(parsed.completedContexts) &&
          parsed.completedContexts.length === 4
            ? parsed.completedContexts
            : fallback.completedContexts,
        stickyNotes: Array.isArray(parsed.stickyNotes)
          ? parsed.stickyNotes
          : fallback.stickyNotes,
        kanbanTasks:
          Array.isArray(parsed.kanbanTasks) && parsed.kanbanTasks.length > 0
            ? parsed.kanbanTasks
            : fallback.kanbanTasks,
        passthroughActive: Boolean(parsed.passthroughActive),
        gardenPods:
          Array.isArray(parsed.gardenPods) && parsed.gardenPods.length === 6
            ? parsed.gardenPods
            : fallback.gardenPods,
        unlockedProps: unlocked,
        telemetry: { ...fallback.telemetry, ...(parsed.telemetry || {}) },
        dailyHistory: Array.isArray(parsed.dailyHistory)
          ? parsed.dailyHistory
          : fallback.dailyHistory,
      };
    } catch {
      return fallback;
    }
  }

  private checkAndRollOverDailyProgress(): void {
    const today = this.getTodayISO();
    const lastDate = this.state.profile.lastActiveDate;
    if (lastDate && lastDate !== today) {
      const bloomed = this.state.gardenPods.filter((p) => p === 3).length;
      this.state.dailyHistory.push({
        date: lastDate,
        waterCups: this.state.telemetry.waterCupsToday,
        mealsLogged: this.state.telemetry.mealsLoggedToday,
        questsCompleted: this.state.telemetry.selfCareBridgesBuilt,
        treesBloomed: bloomed,
        avgReactionMs: this.state.telemetry.avgMotorReactionMs,
      });
      if (this.state.dailyHistory.length > 7) {
        this.state.dailyHistory.shift();
      }
      this.state.telemetry.waterCupsToday = 0;
      this.state.telemetry.mealsLoggedToday = 0;
      this.state.completedContexts = [false, false, false, false];
      this.state.profile.lastActiveDate = today;
      this.state.profile.streakDays += 1;
      this.save();
    }
  }

  public getDaysUntilBirthday(): number {
    try {
      const parts = this.state.profile.birthdayISO.split('-');
      if (parts.length < 3) return 30;
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const now = new Date();
      let nextBday = new Date(now.getFullYear(), month, day);
      if (nextBday.getTime() < now.getTime() - 86400000) {
        nextBday = new Date(now.getFullYear() + 1, month, day);
      }
      const diffMs = nextBday.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    } catch {
      return 30;
    }
  }

  public getFormattedDateAndTime(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${dateStr} • ${timeStr}`;
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
    this.notify();
  }

  public subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public addSparks(amount: number): void {
    this.state.lumaSparks += amount;
    this.save();
  }

  public recordMotorPop(reactionMs: number): void {
    const t = this.state.telemetry;
    t.chaosOrbsPopped += 1;
    t.avgMotorReactionMs = Math.round(
      (t.avgMotorReactionMs * (t.chaosOrbsPopped - 1) + reactionMs) /
        t.chaosOrbsPopped,
    );
    this.addSparks(5);
  }

  public logWaterCup(): number {
    this.state.telemetry.waterCupsToday = Math.min(
      8,
      this.state.telemetry.waterCupsToday + 1,
    );
    this.state.waterDrops += 1;
    this.state.telemetry.stressRestBattery = Math.min(
      100,
      this.state.telemetry.stressRestBattery + 5,
    );
    this.addSparks(10);
    return this.state.telemetry.waterCupsToday;
  }

  public logHealthyMeal(): number {
    this.state.telemetry.mealsLoggedToday += 1;
    this.state.gardenSeeds += 1;
    this.addSparks(15);
    return this.state.telemetry.mealsLoggedToday;
  }

  public plantSeedInPod(podIndex: number): boolean {
    if (podIndex < 0 || podIndex >= 6) return false;
    if (this.state.gardenPods[podIndex] === 0) {
      if (this.state.gardenSeeds > 0) {
        this.state.gardenSeeds -= 1;
      }
      this.state.gardenPods[podIndex] = 1;
      this.addSparks(10);
      return true;
    }
    return false;
  }

  public advanceGardenPod(podIndex: number): number {
    if (podIndex < 0 || podIndex >= 6) return 0;
    const current = this.state.gardenPods[podIndex];
    if (current < 3) {
      this.state.gardenPods[podIndex] = current + 1;
      if (this.state.gardenPods[podIndex] === 3) {
        this.state.telemetry.gardenTreesBloomed += 1;
      }
    }
    this.addSparks(12);
    return this.state.gardenPods[podIndex];
  }
}

export const store = new LumaStateStore();