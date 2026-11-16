import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { store, WorldThemeId } from '../state/store.js';

export interface ThemePalette {
  name: string;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  islandHex: number;
  hillHex: number;
  accentHex: number;
  particleHex: number;
}

export const WORLD_THEMES: Record<WorldThemeId, ThemePalette> = {
  space: {
    name: '🪐 Starlight Nebula',
    skyTop: '#1e1b4b',
    skyHorizon: '#4338ca',
    skyBottom: '#312e81',
    islandHex: 0x312e81,
    hillHex: 0x4f46e5,
    accentHex: 0x38bdf8,
    particleHex: 0xfef08a,
  },
  ocean: {
    name: '🌊 Coral Lagoon',
    skyTop: '#0284c7',
    skyHorizon: '#38bdf8',
    skyBottom: '#0369a1',
    islandHex: 0x0d9488,
    hillHex: 0x14b8a6,
    accentHex: 0x00f0ff,
    particleHex: 0xe0f2fe,
  },
  forest: {
    name: '🌲 Sunny Meadow Sanctuary',
    skyTop: '#0ea5e9',
    skyHorizon: '#bae6fd',
    skyBottom: '#15803d',
    islandHex: 0x16a34a,
    hillHex: 0x22c55e,
    accentHex: 0xfacc15,
    particleHex: 0xfef08a,
  },
  dino: {
    name: '🦕 Golden Dino Valley',
    skyTop: '#7c3aed',
    skyHorizon: '#f472b6',
    skyBottom: '#f59e0b',
    islandHex: 0xd97706,
    hillHex: 0xf59e0b,
    accentHex: 0xfbbf24,
    particleHex: 0xfde047,
  },
};

export const UNLOCKABLE_CATALOG: Array<{
  propType: string;
  label: string;
  cost: number;
  colorHex: number;
}> = [
  { propType: 'ringed_planet', label: '🪐 Saturn Ring (15✨)', cost: 15, colorHex: 0x38bdf8 },
  { propType: 'rocket_tower', label: '🚀 Space Rocket (15✨)', cost: 15, colorHex: 0xf43f5e },
  { propType: 'jellyfish', label: '🪼 Pink Jellyfish (15✨)', cost: 15, colorHex: 0xe879f9 },
  { propType: 'pine_sanctuary', label: '🌲 Meadow Tree (15✨)', cost: 15, colorHex: 0x10b981 },
  { propType: 'dino_companion', label: '🦕 Friendly Dino (20✨)', cost: 20, colorHex: 0xf59e0b },
  { propType: 'star_gate', label: '🌈 Rainbow Arch (25✨)', cost: 25, colorHex: 0x00f0ff },
];

export class WorldGenerator {
  public root = new Group();
  private skyDome!: Mesh;
  private islandFloor!: Mesh;
  private ambientLight!: AmbientLight;
  private sunLight!: DirectionalLight;
  private hills: Mesh[] = [];
  private clouds: Group[] = [];
  private ambientParticles: Mesh[] = [];
  public spawnedPropsGroup = new Group();
  private isNightDimmed = false;

  constructor() {
    this.root.name = 'WorldGeneratorRoot';
    if (store.state.unlockedProps.length > 10) {
      store.state.unlockedProps = store.state.unlockedProps.slice(-10);
      store.save();
    }

    this.buildBrightLandscapeEnvironment();
    this.root.add(this.spawnedPropsGroup);
    this.applyTheme(store.state.worldTheme);
    this.rebuildPlacedProps();
  }

  private buildBrightLandscapeEnvironment(): void {
    this.skyDome = new Mesh(
      new SphereGeometry(16, 32, 32),
      new MeshBasicMaterial({ side: BackSide }),
    );
    this.root.add(this.skyDome);

    this.ambientLight = new AmbientLight(0xffffff, 1.55);
    this.root.add(this.ambientLight);

    this.sunLight = new DirectionalLight(0xfffbeb, 1.65);
    this.sunLight.position.set(3, 6, 2);
    this.root.add(this.sunLight);

    this.islandFloor = new Mesh(
      new CylinderGeometry(4.2, 3.2, 0.3, 36),
      new MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 }),
    );
    this.islandFloor.position.set(0, -1.05, -0.5);
    this.root.add(this.islandFloor);

    const shoreRing = new Mesh(
      new RingGeometry(4.2, 5.5, 48),
      new MeshBasicMaterial({
        color: 0x38bdf8,
        side: DoubleSide,
        transparent: true,
        opacity: 0.5,
      }),
    );
    shoreRing.rotation.x = -Math.PI / 2;
    shoreRing.position.set(0, -0.92, -0.5);
    this.root.add(shoreRing);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const hill = new Mesh(
        new ConeGeometry(0.9 + (i % 3) * 0.3, 1.2 + (i % 2) * 0.5, 7),
        new MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 }),
      );
      hill.position.set(
        Math.cos(angle) * 3.6,
        -0.4,
        Math.sin(angle) * 3.6 - 0.5,
      );
      this.root.add(hill);
      this.hills.push(hill);
    }

    for (let i = 0; i < 6; i++) {
      const cloud = new Group();
      const cloudMat = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
      });
      const mainPuff = new Mesh(new SphereGeometry(0.28, 12, 12), cloudMat);
      const leftPuff = new Mesh(new SphereGeometry(0.2, 12, 12), cloudMat);
      leftPuff.position.set(-0.22, -0.04, 0);
      const rightPuff = new Mesh(new SphereGeometry(0.22, 12, 12), cloudMat);
      rightPuff.position.set(0.22, -0.03, 0);
      cloud.add(mainPuff, leftPuff, rightPuff);

      const angle = (i / 6) * Math.PI * 2;
      cloud.position.set(
        Math.cos(angle) * 3.8,
        1.8 + (i % 2) * 0.4,
        Math.sin(angle) * 3.8 - 0.6,
      );
      cloud.lookAt(0, 1.5, 0);
      this.root.add(cloud);
      this.clouds.push(cloud);
    }

    const partGeo = new SphereGeometry(0.032, 8, 8);
    for (let i = 0; i < 24; i++) {
      const mat = new MeshBasicMaterial({ color: 0xfef08a });
      const p = new Mesh(partGeo, mat);
      const angle = (i / 24) * Math.PI * 2;
      const radius = 1.5 + (i % 3) * 0.65;
      const height = 0.0 + (i % 4) * 0.45;
      p.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius - 0.5,
      );
      p.userData.baseY = height;
      p.userData.phase = i * 0.7;
      this.root.add(p);
      this.ambientParticles.push(p);
    }
  }

  // Smoothly dims or brightens the room for Evening vs. Morning routines!
  public setEveningDimMode(dimmed: boolean): void {
    this.isNightDimmed = dimmed;
    if (dimmed) {
      this.ambientLight.intensity = 0.45;
      this.ambientLight.color.setHex(0x818cf8);
      this.sunLight.intensity = 0.35;
      this.sunLight.color.setHex(0x6366f1);
    } else {
      this.ambientLight.intensity = 1.55;
      this.ambientLight.color.setHex(0xffffff);
      this.sunLight.intensity = 1.65;
      this.sunLight.color.setHex(0xfffbeb);
    }
    this.applyTheme(store.state.worldTheme);
  }

  public applyTheme(themeId: WorldThemeId): void {
    const palette = WORLD_THEMES[themeId];
    const isLowStim = store.state.sensoryProfile === 'lowstim';

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (this.isNightDimmed) {
      // Cozy Starry Night / Twilight Sky when "Dim Lights" is activated!
      grad.addColorStop(0, '#090d1e');
      grad.addColorStop(0.55, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
    } else if (isLowStim) {
      grad.addColorStop(0, '#334155');
      grad.addColorStop(0.55, '#64748b');
      grad.addColorStop(1, '#475569');
    } else {
      grad.addColorStop(0, palette.skyTop);
      grad.addColorStop(0.55, palette.skyHorizon);
      grad.addColorStop(1, palette.skyBottom);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);

    const skyMat = this.skyDome.material as MeshBasicMaterial;
    skyMat.map = new CanvasTexture(canvas);
    skyMat.needsUpdate = true;

    (this.islandFloor.material as MeshStandardMaterial).color.setHex(
      this.isNightDimmed
        ? 0x1e1b4b
        : isLowStim
          ? 0x334155
          : palette.islandHex,
    );
    this.hills.forEach((h) => {
      (h.material as MeshStandardMaterial).color.setHex(
        this.isNightDimmed
          ? 0x312e81
          : isLowStim
            ? 0x475569
            : palette.hillHex,
      );
    });

    this.ambientParticles.forEach((p) => {
      p.visible = !isLowStim;
      (p.material as MeshBasicMaterial).color.setHex(
        this.isNightDimmed ? 0xfde047 : palette.particleHex,
      );
    });
  }

  public rebuildPlacedProps(): void {
    while (this.spawnedPropsGroup.children.length > 0) {
      this.spawnedPropsGroup.remove(this.spawnedPropsGroup.children[0]);
    }

    store.state.unlockedProps.forEach((prop, idx) => {
      const meshGroup = this.create3DMonument(prop.propType, prop.colorHex);
      const slotIndex = idx % 8;
      const row = Math.floor(idx / 8);
      const angle = ((slotIndex - 3.5) / 4.2) * 1.35;
      const radius = 1.85 + row * 0.65;

      const x = Math.sin(angle) * radius;
      const z = -Math.cos(angle) * radius - 0.3;
      const y = 0.25 + (slotIndex % 3) * 0.38 + row * 0.35;

      meshGroup.position.set(x, y, z);
      meshGroup.scale.setScalar(0.85);
      meshGroup.userData.baseY = y;
      meshGroup.userData.propType = prop.propType;
      this.spawnedPropsGroup.add(meshGroup);
    });
  }

  private create3DMonument(propType: string, colorHex: number): Group {
    const g = new Group();
    const mat = new MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.22,
      roughness: 0.3,
    });

    if (propType === 'ringed_planet') {
      const sphere = new Mesh(new SphereGeometry(0.18, 24, 24), mat);
      const ring = new Mesh(
        new RingGeometry(0.23, 0.32, 32),
        new MeshBasicMaterial({ color: 0xfbbf24, side: DoubleSide }),
      );
      ring.rotation.x = 1.1;
      g.add(sphere, ring);
    } else if (propType === 'rocket_tower') {
      const body = new Mesh(new CylinderGeometry(0.07, 0.1, 0.36, 16), mat);
      const nose = new Mesh(
        new ConeGeometry(0.075, 0.14, 16),
        new MeshBasicMaterial({ color: 0xfacc15 }),
      );
      nose.position.y = 0.25;
      g.add(body, nose);
    } else if (propType === 'jellyfish') {
      const dome = new Mesh(new SphereGeometry(0.17, 20, 16), mat);
      dome.scale.y = 0.65;
      for (let i = 0; i < 4; i++) {
        const tentacle = new Mesh(
          new CylinderGeometry(0.009, 0.004, 0.26, 8),
          mat,
        );
        tentacle.position.set((i - 1.5) * 0.045, -0.15, 0);
        g.add(tentacle);
      }
      g.add(dome);
    } else if (propType === 'pine_sanctuary') {
      const trunk = new Mesh(
        new CylinderGeometry(0.035, 0.05, 0.22, 10),
        new MeshStandardMaterial({ color: 0x78350f }),
      );
      const leaves = new Mesh(new ConeGeometry(0.19, 0.42, 8), mat);
      leaves.position.y = 0.22;
      g.add(trunk, leaves);
    } else if (propType === 'dino_companion') {
      const body = new Mesh(new BoxGeometry(0.24, 0.15, 0.14), mat);
      const neck = new Mesh(new CylinderGeometry(0.035, 0.05, 0.26, 12), mat);
      neck.position.set(0.1, 0.15, 0);
      neck.rotation.z = -0.25;
      const head = new Mesh(new BoxGeometry(0.1, 0.07, 0.08), mat);
      head.position.set(0.15, 0.27, 0);
      g.add(body, neck, head);
    } else {
      const arch = new Mesh(new TorusGeometry(0.26, 0.03, 16, 36), mat);
      const core = new Mesh(new OctahedronGeometry(0.08, 0), mat);
      g.add(arch, core);
    }
    return g;
  }

  public update(delta: number, time: number): void {
    if (store.state.sanctuaryPaused) return;
    const amp = store.state.sensoryProfile === 'lowstim' ? 0.15 : 1.0;

    this.ambientParticles.forEach((p) => {
      p.position.y =
        p.userData.baseY + Math.sin(time * 1.2 + p.userData.phase) * 0.06 * amp;
    });

    this.clouds.forEach((c, idx) => {
      c.position.y += Math.sin(time * 0.6 + idx) * 0.0005 * amp;
    });

    this.spawnedPropsGroup.children.forEach((propGroup, idx) => {
      propGroup.rotation.y += delta * 0.45 * amp;
      if (propGroup.userData.baseY !== undefined) {
        propGroup.position.y =
          propGroup.userData.baseY + Math.sin(time * 1.6 + idx) * 0.035 * amp;
      }
    });
  }
}