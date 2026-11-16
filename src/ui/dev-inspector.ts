import { store, TherapyStage, WorldThemeId } from '../state/store.js';
import { UNLOCKABLE_CATALOG } from '../worlds/world-generator.js';

export interface InspectorActions {
  onSelectWorld: (theme: WorldThemeId) => void;
  onTogglePassthrough: () => void;
  onJumpToStage: (stage: TherapyStage) => void;
  onOpenSandbox: () => void;
  onAdvanceStep: () => void;
  onDrinkWater: () => void;
  onLogMeal: () => void;
  onGrowGarden: () => void;
  onClearRoom: () => void;
  onNextQuest: () => void;
  onProfileSaved: () => void;
  onTriggerWitVoice: (customUtterance?: string) => void;
}

export class DevInspectorUI {
  private actions: InspectorActions;
  private reportModal: HTMLDivElement | null = null;
  private signupModal: HTMLDivElement | null = null;
  private scoreBadge: HTMLDivElement | null = null;
  private witTelemetryBar: HTMLDivElement | null = null;
  private qaDrawer: HTMLDivElement | null = null;
  private qaExpanded = false;

  constructor(actions: InspectorActions) {
    this.actions = actions;
    this.mountHUD();
    store.subscribe(() => this.updateStatusLine());

    setInterval(() => this.updateScoreBadgeText(), 20000);

    if (!store.state.profile.onboarded) {
      this.openParentSignupModal();
    }
  }

  public showWitTelemetry(text: string): void {
    if (!this.witTelemetryBar) return;
    this.witTelemetryBar.style.display = 'block';
    this.witTelemetryBar.textContent = text;
  }

  private mountHUD(): void {
    const existing = document.getElementById('lumadesk-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.id = 'lumadesk-hud';
    hud.style.cssText = `
      position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(16px);
      border: 1.5px solid rgba(56, 189, 248, 0.7);
      border-radius: 18px; padding: 10px 16px; z-index: 99999;
      font-family: system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      max-width: 96vw;
    `;

    this.scoreBadge = document.createElement('div');
    this.scoreBadge.style.cssText = `
      background: rgba(30, 27, 75, 0.9);
      border: 1px solid #fbbf24; border-radius: 999px; padding: 4px 16px;
      color: #fde047; font-size: 12.5px; font-weight: 800; letter-spacing: 0.3px;
    `;
    hud.appendChild(this.scoreBadge);
    this.updateScoreBadgeText();

    this.witTelemetryBar = document.createElement('div');
    this.witTelemetryBar.style.cssText = `
      display: none; background: rgba(6, 78, 59, 0.92); border: 1px solid #10b981;
      border-radius: 8px; padding: 3px 12px; color: #a7f3d0; font-size: 11.5px;
      font-family: monospace; font-weight: 700; text-align: center;
    `;
    hud.appendChild(this.witTelemetryBar);

    const header = document.createElement('div');
    header.id = 'lumadesk-coach-text';
    header.style.cssText =
      'color: #38bdf8; font-size: 13.5px; font-weight: 800; text-align: center;';
    header.textContent = `👉 Hi ${store.state.profile.nickname}! Tap the glowing object or speak to Luma.`;
    hud.appendChild(header);

    const kidRow = document.createElement('div');
    kidRow.style.cssText =
      'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center;';

    const btnVoice = this.makeBigKidBtn(
      '🎙️ Speak to Luma (Wit.ai)',
      '#a855f7',
      () => this.actions.onTriggerWitVoice(),
    );
    const btnAction = this.makeBigKidBtn(
      '⚡ Do Next Step (Space)',
      '#00f0ff',
      () => this.actions.onAdvanceStep(),
    );
    const btnSandbox = this.makeBigKidBtn(
      '🎨 3D Brush & Xylophone',
      '#fbbf24',
      () => this.actions.onOpenSandbox(),
    );
    const btnPassthrough = this.makeBigKidBtn(
      '🏠 Real Room (MR)',
      '#38bdf8',
      () => this.actions.onTogglePassthrough(),
    );
    const btnNextQuest = this.makeBigKidBtn(
      '🎯 Next Routine ➔',
      '#10b981',
      () => this.actions.onNextQuest(),
    );
    const btnToggleQA = this.makeBigKidBtn(
      '👨‍👩‍👧 Parent & Judge Menu ▾',
      '#f472b6',
      () => {
        this.qaExpanded = !this.qaExpanded;
        if (this.qaDrawer) {
          this.qaDrawer.style.display = this.qaExpanded ? 'flex' : 'none';
        }
        btnToggleQA.textContent = this.qaExpanded
          ? '👨‍👩‍👧 Hide Parent Menu ▴'
          : '👨‍👩‍👧 Parent & Judge Menu ▾';
      },
    );

    kidRow.append(
      btnVoice,
      btnAction,
      btnSandbox,
      btnPassthrough,
      btnNextQuest,
      btnToggleQA,
    );
    hud.appendChild(kidRow);

    this.qaDrawer = document.createElement('div');
    this.qaDrawer.style.cssText = `
      display: none; flex-direction: column; gap: 6px; padding-top: 6px;
      border-top: 1px solid rgba(148, 163, 184, 0.25); width: 100%; align-items: center;
    `;

    const witRow = document.createElement('div');
    witRow.style.cssText =
      'display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;';

    const witInput = document.createElement('input');
    witInput.type = 'text';
    witInput.placeholder =
      '🤖 Test Wit.ai NLU (e.g. "Remind me to pack science book" or "What is the weather?")';
    witInput.style.cssText = `
      background: #0f172a; color: #fff; border: 1px solid #a855f7;
      border-radius: 7px; padding: 4px 10px; font-size: 11.5px; width: 360px; max-width: 70vw;
    `;
    const witSendBtn = this.makeSmallBtn(
      '🚀 Send to Wit.ai',
      '#a855f7',
      () => {
        if (witInput.value.trim()) {
          this.actions.onTriggerWitVoice(witInput.value.trim());
          witInput.value = '';
        } else {
          this.actions.onTriggerWitVoice();
        }
      },
    );
    witRow.append(witInput, witSendBtn);

    const row1 = document.createElement('div');
    row1.style.cssText =
      'display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;';
    const row1Buttons = [
      {
        label: '💧 Drink Water (+10✨)',
        color: '#38bdf8',
        fn: () => this.actions.onDrinkWater(),
      },
      {
        label: '🍎 Eat Meal (+1🌱)',
        color: '#f43f5e',
        fn: () => this.actions.onLogMeal(),
      },
      {
        label: '🚿 Water Garden',
        color: '#10b981',
        fn: () => this.actions.onGrowGarden(),
      },
      {
        label: '🌲 Forest',
        color: '#22c55e',
        fn: () => this.actions.onSelectWorld('forest'),
      },
      {
        label: '🌊 Ocean',
        color: '#38bdf8',
        fn: () => this.actions.onSelectWorld('ocean'),
      },
      {
        label: '🦕 Dino',
        color: '#f59e0b',
        fn: () => this.actions.onSelectWorld('dino'),
      },
      {
        label: '🪐 Space',
        color: '#818cf8',
        fn: () => this.actions.onSelectWorld('space'),
      },
      {
        label: '👨‍👩‍👧 Parent & Wit.ai Setup',
        color: '#f472b6',
        fn: () => this.openParentSignupModal(),
      },
      {
        label: '📊 Daily Report',
        color: '#10b981',
        fn: () => this.toggleClinicalReportModal(),
      },
    ];
    row1Buttons.forEach((b) =>
      row1.appendChild(this.makeSmallBtn(b.label, b.color, b.fn)),
    );

    const row2 = document.createElement('div');
    row2.style.cssText =
      'display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;';
    const row2Buttons = [
      {
        label: '1️⃣ Stage 1: Pop Chaos',
        color: '#f43f5e',
        fn: () => this.actions.onJumpToStage('STAGE_1_MOTOR_POP'),
      },
      {
        label: '2️⃣ Stage 2: Breath Sync',
        color: '#fbbf24',
        fn: () => this.actions.onJumpToStage('STAGE_2_BREATH_SYNC'),
      },
      {
        label: '3️⃣ Stage 3: 3D Objects',
        color: '#38bdf8',
        fn: () => this.actions.onJumpToStage('STAGE_3_TOTEM_SEQUENCE'),
      },
      {
        label: '4️⃣ Stage 4: Social Decoder',
        color: '#10b981',
        fn: () => this.actions.onJumpToStage('STAGE_4_SOCIAL_DECODER'),
      },
      {
        label: '🧹 Clear Sky Toys',
        color: '#ef4444',
        fn: () => this.actions.onClearRoom(),
      },
    ];
    row2Buttons.forEach((b) =>
      row2.appendChild(this.makeSmallBtn(b.label, b.color, b.fn)),
    );

    this.qaDrawer.append(witRow, row1, row2);
    hud.appendChild(this.qaDrawer);

    document.body.appendChild(hud);
  }

  private updateScoreBadgeText(): void {
    if (!this.scoreBadge) return;
    const p = store.state.profile;
    const t = store.state.telemetry;
    const bdayDays = store.getDaysUntilBirthday();
    const bloomed = store.state.gardenPods.filter((pod) => pod > 0).length;
    const doneCount = (store.state.kanbanTasks || []).filter(
      (k) => k.status === 'done',
    ).length;
    const rpgLevel = Math.max(1, Math.floor(store.state.lumaSparks / 100) + 1);
    this.scoreBadge.textContent = `🧙 Lv.${rpgLevel} ${p.nickname} (🎂 ${bdayDays}d)  |  ✨ ${store.state.lumaSparks} SPARKS  |  ✅ ${doneCount} Done  |  💧 ${t.waterCupsToday}/8 Cups  |  🌸 ${bloomed}/6 Garden`;
  }

  private makeBigKidBtn(
    label: string,
    borderColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = this.createStyledButton(
      label,
      `
      background: rgba(15, 23, 42, 0.95); color: #ffffff; border: 2px solid ${borderColor};
      border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 800;
      cursor: pointer; transition: transform 0.12s, background 0.15s;
    `,
      onClick,
    );
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(51, 65, 85, 0.98)';
      btn.style.transform = 'scale(1.04)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(15, 23, 42, 0.95)';
      btn.style.transform = 'scale(1.0)';
    };
    return btn;
  }

  private makeSmallBtn(
    label: string,
    borderColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    return this.createStyledButton(
      label,
      `
      background: rgba(15, 23, 42, 0.85); color: #f8fafc; border: 1px solid ${borderColor};
      border-radius: 7px; padding: 4px 8px; font-size: 11px; font-weight: 600;
      cursor: pointer;
    `,
      onClick,
    );
  }

  private createStyledButton(
    label: string,
    css: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = css;
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  }

  private updateStatusLine(): void {
    this.updateScoreBadgeText();
    if (this.reportModal && this.reportModal.style.display === 'flex') {
      this.renderReportContent();
    }
  }

  public openParentSignupModal(): void {
    if (!this.signupModal) {
      this.signupModal = document.createElement('div');
      this.signupModal.id = 'parent-signup-modal';
      this.signupModal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 490px; max-width: 92vw; background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(18px); border: 2px solid #f472b6;
        border-radius: 20px; padding: 22px; color: #f8fafc;
        font-family: system-ui, sans-serif; z-index: 100001;
        display: flex; flex-direction: column; gap: 11px;
        box-shadow: 0 16px 56px rgba(0, 0, 0, 0.88);
      `;
      document.body.appendChild(this.signupModal);
    }

    const p = store.state.profile;
    this.signupModal.style.display = 'flex';
    this.signupModal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
        <div>
          <h3 style="margin:0; color:#f472b6; font-size:18px;">👨‍👩‍👧 Parent Sign-Up & Meta Wit.ai Config</h3>
          <div style="font-size:11.5px; color:#94a3b8;">Personalizes Luma’s voice coach, birthday countdown & Wit.ai NLU</div>
        </div>
      </div>

      <div style="display:grid; gap:9px; font-size:12.5px;">
        <label style="display:grid; gap:4px;">
          <span style="color:#cbd5e1; font-weight:600;">Child’s Name or Nickname:</span>
          <input id="inp-nickname" type="text" value="${p.nickname}" style="background:#0f172a; border:1px solid #475569; color:#fff; padding:6px 10px; border-radius:8px; font-size:13px;" />
        </label>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <label style="display:grid; gap:4px;">
            <span style="color:#cbd5e1; font-weight:600;">🎂 Child’s Birthday:</span>
            <input id="inp-bday" type="date" value="${p.birthdayISO}" style="background:#0f172a; border:1px solid #475569; color:#fff; padding:6px 10px; border-radius:8px; font-size:13px;" />
          </label>
          <label style="display:grid; gap:4px;">
            <span style="color:#cbd5e1; font-weight:600;">🔒 Parent Password / PIN:</span>
            <input id="inp-pin" type="password" value="${p.parentPin}" style="background:#0f172a; border:1px solid #475569; color:#fff; padding:6px 10px; border-radius:8px; font-size:13px;" />
          </label>
        </div>

        <label style="display:grid; gap:4px;">
          <span style="color:#cbd5e1; font-weight:600;">🏥 Current Therapy & Diagnosis Focus:</span>
          <select id="inp-therapy" style="background:#0f172a; border:1px solid #475569; color:#fff; padding:6px 10px; border-radius:8px; font-size:13px;">
            <option value="Occupational & Sensory-Motor Integration">Occupational & Sensory-Motor Integration (ASD + ADHD)</option>
            <option value="Executive Function & Self-Care Autonomy">Executive Function & Self-Care Autonomy (ADHD)</option>
            <option value="Speech, Receptive & Expressive Communication">Speech, Receptive & Expressive Communication (ASD)</option>
          </select>
        </label>

        <label style="display:grid; gap:4px;">
          <span style="color:#a855f7; font-weight:700;">🤖 Meta Wit.ai Client/Server Token (Optional — Hybrid NLU active by default):</span>
          <input id="inp-wit-token" type="password" placeholder="Paste Bearer Token from Wit.ai Settings (or leave blank for Hybrid NLU)" value="${p.witClientToken || ''}" style="background:#0f172a; border:1px solid #a855f7; color:#fff; padding:6px 10px; border-radius:8px; font-size:12.5px;" />
        </label>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:6px;">
        <button id="btn-quick-demo" style="background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; border-radius:8px; padding:8px 12px; font-weight:700; cursor:pointer; font-size:12px;">
          ⚡ Quick Demo Login
        </button>
        <button id="btn-save-profile" style="background:#ec4899; color:#fff; border:none; border-radius:8px; padding:8px 16px; font-weight:800; cursor:pointer; font-size:12.5px;">
          ✅ Save Profile & Enter Sanctuary
        </button>
      </div>
    `;

    const saveFn = () => {
      const nick =
        (
          this.signupModal?.querySelector('#inp-nickname') as HTMLInputElement
        )?.value.trim() || 'Aarav';
      const bday =
        (this.signupModal?.querySelector('#inp-bday') as HTMLInputElement)
          ?.value || '2016-12-18';
      const pin =
        (this.signupModal?.querySelector('#inp-pin') as HTMLInputElement)
          ?.value || '1234';
      const therapy =
        (this.signupModal?.querySelector('#inp-therapy') as HTMLSelectElement)
          ?.value || 'Occupational & Sensory-Motor Integration';
      const witToken =
        (
          this.signupModal?.querySelector('#inp-wit-token') as HTMLInputElement
        )?.value.trim() || '';

      store.state.profile.nickname = nick;
      store.state.profile.birthdayISO = bday;
      store.state.profile.parentPin = pin;
      store.state.profile.therapyFocus = therapy;
      store.state.profile.witClientToken = witToken;
      store.state.profile.onboarded = true;
      store.save();

      if (this.signupModal) this.signupModal.style.display = 'none';
      this.actions.onProfileSaved();
    };

    const btnSave = this.signupModal.querySelector('#btn-save-profile');
    if (btnSave) (btnSave as HTMLButtonElement).onclick = saveFn;

    const btnDemo = this.signupModal.querySelector('#btn-quick-demo');
    if (btnDemo) (btnDemo as HTMLButtonElement).onclick = saveFn;
  }

  private toggleClinicalReportModal(): void {
    if (!this.reportModal) {
      this.reportModal = document.createElement('div');
      this.reportModal.id = 'close-clinical-modal-container';
      this.reportModal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 580px; max-width: 94vw; background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(18px); border: 2px solid #38bdf8;
        border-radius: 18px; padding: 20px; color: #f8fafc;
        font-family: system-ui, sans-serif; z-index: 100000;
        display: none; flex-direction: column; gap: 12px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.85);
      `;
      document.body.appendChild(this.reportModal);
    }

    const isVisible = this.reportModal.style.display === 'flex';
    this.reportModal.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      this.renderReportContent();
    }
  }

  private renderReportContent(): void {
    if (!this.reportModal) return;
    const p = store.state.profile;
    const t = store.state.telemetry;
    const bloomed = store.state.gardenPods.filter((pod) => pod === 3).length;

    const historyRows = store.state.dailyHistory
      .slice(-3)
      .map(
        (h) =>
          `<div style="display:flex; justify-content:space-between; font-size:11.5px; padding:4px 0; border-bottom:1px solid #1e293b;">
            <span>📅 ${h.date}</span>
            <span>💧 ${h.waterCups}/8 Cups</span>
            <span>🍎 ${h.mealsLogged} Meals</span>
            <span>✅ ${h.questsCompleted} Routines</span>
            <span>⚡ ${h.avgReactionMs}ms</span>
          </div>`,
      )
      .join('');

    this.reportModal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
        <div>
          <h3 style="margin:0; color:#38bdf8; font-size:17px;">📊 Daily Parent & Therapist Report — ${p.nickname}</h3>
          <div style="font-size:11.5px; color:#94a3b8;">Focus: ${p.therapyFocus}  |  🎂 Birthday in ${store.getDaysUntilBirthday()} days</div>
        </div>
        <button id="close-clinical-modal" style="background:#ef4444; color:#fff; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:700;">✕ Close</button>
      </div>
      <div style="font-size:12.5px; line-height:1.45; color:#e2e8f0; display:grid; gap:9px;">
        <div style="background:rgba(30,41,59,0.75); padding:9px; border-radius:8px; border-left:4px solid #f43f5e;">
          <strong style="color:#fff;">1. Sensorimotor & Upper-Limb Coordination (Mattard-Labrecque et al., 2013)</strong><br/>
          • Chaos Shapes Popped: <strong>${t.chaosOrbsPopped}</strong> &nbsp;|&nbsp; Avg Motor Speed: <strong>${t.avgMotorReactionMs} ms</strong><br/>
          • Bilateral Xylophone Notes: <strong>${t.xylophoneNotesPlayed}</strong> &nbsp;|&nbsp; Garden Trees Bloomed: <strong>${bloomed}/6</strong>
        </div>
        <div style="background:rgba(30,41,59,0.75); padding:9px; border-radius:8px; border-left:4px solid #38bdf8;">
          <strong style="color:#fff;">2. Self-Care Autonomy, Hydration & Nutrition (ABAS-II / Ahlström & Wentz, 2014)</strong><br/>
          • Today’s Hydration: <strong>${t.waterCupsToday}/8 Cups (2L Goal)</strong> &nbsp;|&nbsp; Safe Meals Logged: <strong>${t.mealsLoggedToday}</strong><br/>
          • 1-2-3 Self-Care Bridges Built: <strong>${t.selfCareBridgesBuilt}</strong> &nbsp;|&nbsp; Active Streak: <strong>🔥 ${p.streakDays} Days</strong>
        </div>
        <div style="background:rgba(30,41,59,0.75); padding:9px; border-radius:8px; border-left:4px solid #10b981;">
          <strong style="color:#fff;">3. Receptive/Expressive Communication & Wit.ai Voice NLU (Magnúsdóttir et al., 2016)</strong><br/>
          • Social Messages Decoded: <strong>${t.socialMessagesDecoded}</strong> &nbsp;|&nbsp; Wit.ai Voice Actions: <strong>${t.witVoiceCommands || 0}</strong><br/>
          • Breath Pulses Synced: <strong>${t.breathPulsesSynced}</strong> &nbsp;|&nbsp; Calm Battery: <strong>${t.stressRestBattery}%</strong>
        </div>
        <div style="background:rgba(15,23,42,0.9); padding:9px; border-radius:8px; border:1px solid #334155;">
          <strong style="color:#fbbf24;">📅 Recent Multi-Day Progress Log (Saved Automatically):</strong>
          ${historyRows}
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="btn-copy-report" style="background:#10b981; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-weight:700; cursor:pointer; font-size:12px;">
          📋 Copy Daily Therapist Summary
        </button>
      </div>
    `;

    const closeBtn = this.reportModal.querySelector('#close-clinical-modal');
    if (closeBtn) {
      (closeBtn as HTMLButtonElement).onclick = () => {
        if (this.reportModal) this.reportModal.style.display = 'none';
      };
    }

    const copyBtn = this.reportModal.querySelector('#btn-copy-report');
    if (copyBtn) {
      (copyBtn as HTMLButtonElement).onclick = () => {
        const summary = `LumaDesk Daily Report for ${p.nickname} (${store.getFormattedDateAndTime()}): Water ${t.waterCupsToday}/8 cups, Meals ${t.mealsLoggedToday}, Routines ${t.selfCareBridgesBuilt}, Wit.ai Voice Actions ${t.witVoiceCommands || 0}, Motor Speed ${t.avgMotorReactionMs}ms, Trees Bloomed ${bloomed}/6.`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(summary).catch(() => {});
        }
        (copyBtn as HTMLButtonElement).textContent =
          '✅ Copied Summary to Clipboard!';
      };
    }
  }
}

export { UNLOCKABLE_CATALOG };