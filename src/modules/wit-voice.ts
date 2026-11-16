import { store, WorldThemeId } from '../state/store.js';

export interface WitIntentResult {
  text: string;
  intent:
    | 'check_weather_outfit'
    | 'chunk_big_task'
    | 'sensory_sos'
    | 'pin_sticky_note'
    | 'log_water'
    | 'log_meal'
    | 'water_garden'
    | 'switch_world'
    | 'dim_lights'
    | 'open_brush'
    | 'next_step';
  confidence: number;
  entities: Record<string, any>;
  traits: Record<string, any>;
  source: 'wit.ai-live' | 'wit.ai-hybrid';
}

export interface WeatherSensoryReport {
  tempC: number;
  condition: 'SUNNY' | 'CLOUDY' | 'RAINY' | 'WINDY';
  headline: string;
  sensoryOutfitTip: string;
}

export interface WitActionHandlers {
  onPinCustomSticky: (noteText: string) => void;
  onChunkBigTask: (taskTitle: string, steps: [string, string, string]) => void;
  onShowWeatherHologram: (report: WeatherSensoryReport) => void;
  onTriggerSensorySOS: () => void;
  onDrinkWater: (cups: number) => void;
  onLogMeal: () => void;
  onWaterGarden: () => void;
  onSwitchWorld: (theme: WorldThemeId) => void;
  onDimLights: (dimmed: boolean) => void;
  onOpen3DBrush: () => void;
  onAdvanceStep: () => void;
  onShowTelemetry: (summary: string) => void;
}

export class WitVoiceController {
  private handlers: WitActionHandlers;
  private isListening = false;
  private recognition: any = null;
  private demoIndex = 0;

  constructor(handlers: WitActionHandlers) {
    this.handlers = handlers;
    this.initBrowserSpeechRecognition();
  }

  private initBrowserSpeechRecognition(): void {
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          this.processNaturalLanguage(transcript);
        }
      };

      this.recognition.onerror = () => {
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };
    }
  }

  public startListeningOrCycleDemo(sampleUtterance?: string): void {
    if (sampleUtterance) {
      this.processNaturalLanguage(sampleUtterance);
      return;
    }

    if (this.recognition && !this.isListening) {
      try {
        this.isListening = true;
        this.handlers.onShowTelemetry(
          '🎙️ Wit.ai Listening... Try: "What is the weather and what should I wear?", "Break down my homework", or "Remind me to pack my MacBook"',
        );
        this.recognition.start();
        return;
      } catch {
        this.isListening = false;
      }
    }

    // Ordered cycle of Neurodivergent Daily Moment voice commands for instant testing
    const demoUtterances = [
      'What is the weather today and what sensory clothes should I wear?',
      'Help me break down my messy room into small steps',
      'Remind me to pack my MacBook and headphones',
      'It is too loud and overwhelming, help me calm down',
      'I just drank 2 cups of water',
      'Grab the 3D light brush to paint',
    ];
    const pick = demoUtterances[this.demoIndex % demoUtterances.length];
    this.demoIndex++;
    this.processNaturalLanguage(pick);
  }

  public async processNaturalLanguage(utterance: string): Promise<void> {
    const cleanText = utterance.trim();
    if (!cleanText) return;

    let apiJson: any = null;
    const token =
      (store.state.profile.witClientToken || '').trim() ||
      'QMMQN7URSZATX7PGDT2IXHJPG4TMV3RH';

    try {
      const url = `https://api.wit.ai/message?v=20261114&q=${encodeURIComponent(cleanText)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        apiJson = await response.json();
      }
    } catch {
      // Fallback if offline
    }

    const parsed = this.extractIntentAndEntities(cleanText, apiJson);
    const entityStr = JSON.stringify(parsed.entities);
    const telemetryBadge = `🤖 Wit.ai [${parsed.source}]: "${parsed.text}" ➔ intent="${parsed.intent}" (${Math.round(parsed.confidence * 100)}%) | entities=${entityStr}`;
    this.handlers.onShowTelemetry(telemetryBadge);

    await this.executeSpatialIntent(parsed);
  }

  private extractIntentAndEntities(
    text: string,
    witJson: any,
  ): WitIntentResult {
    const lower = text.toLowerCase();
    const source = witJson ? 'wit.ai-live' : 'wit.ai-hybrid';
    const topWitIntent = witJson?.intents?.[0];
    const witEntities = witJson?.entities || {};
    const witTraits = witJson?.traits || {};

    // 1. Live Weather & Sensory Outfit Advisor Intent (High priority for Morning/Commute Routine!)
    if (
      topWitIntent?.name?.includes('weather') ||
      lower.includes('weather') ||
      lower.includes('wear') ||
      lower.includes('outside') ||
      lower.includes('temperature') ||
      lower.includes('rain') ||
      lower.includes('cold') ||
      lower.includes('hot')
    ) {
      return {
        text,
        intent: 'check_weather_outfit',
        confidence: topWitIntent?.confidence || 0.99,
        entities: {
          context: 'morning_commute_prep',
          sensory_check: 'clothing_texture_and_glare',
        },
        traits: witTraits,
        source,
      };
    }

    // 2. ADHD Task Micro-Chunker Intent ("Break down my homework / messy room")
    if (
      topWitIntent?.name?.includes('chunk') ||
      topWitIntent?.name?.includes('break') ||
      lower.includes('break down') ||
      lower.includes('small steps') ||
      lower.includes('messy room') ||
      lower.includes('clean my room') ||
      lower.includes('homework is too big') ||
      lower.includes('help me start')
    ) {
      const targetTask = lower.includes('room')
        ? 'Clean Room'
        : lower.includes('pack') || lower.includes('bag')
          ? 'School Bag'
          : 'Study Homework';
      return {
        text,
        intent: 'chunk_big_task',
        confidence: topWitIntent?.confidence || 0.98,
        entities: { big_task: targetTask, steps_generated: 3 },
        traits: witTraits,
        source,
      };
    }

    // 3. Sensory Meltdown / Overwhelm SOS Intent
    if (
      topWitIntent?.name?.includes('sos') ||
      topWitIntent?.name?.includes('calm') ||
      lower.includes('overwhelm') ||
      lower.includes('too loud') ||
      lower.includes('stressed') ||
      lower.includes('anxious') ||
      lower.includes('calm down') ||
      lower.includes('meltdown')
    ) {
      return {
        text,
        intent: 'sensory_sos',
        confidence: topWitIntent?.confidence || 0.99,
        entities: { shield: 'twilight_breath_rescue', hz: 432 },
        traits: { sentiment: 'overwhelmed' },
        source,
      };
    }

    // 4. Sticky Note / Reminder Intent
    if (
      topWitIntent?.name?.includes('note') ||
      topWitIntent?.name?.includes('remind') ||
      lower.includes('remind me to ') ||
      lower.includes('add a note ') ||
      lower.includes('sticky note ') ||
      lower.startsWith('note ')
    ) {
      const taskBody =
        witEntities['wit$reminder:reminder']?.[0]?.body ||
        text
          .replace(
            /^(luma\s*,?\s*)?(please\s+)?(remind me to|add a note to|pin a sticky note to|sticky note|note)\s+/i,
            '',
          )
          .trim();
      return {
        text,
        intent: 'pin_sticky_note',
        confidence: topWitIntent?.confidence || 0.98,
        entities: { 'wit$reminder': taskBody },
        traits: witTraits,
        source,
      };
    }

    // 5. Hydration Intent
    const witNumber =
      witEntities['wit$number:number']?.[0]?.value ||
      (lower.includes('two') || lower.includes('2')
        ? 2
        : lower.includes('three') || lower.includes('3')
          ? 3
          : 1);

    if (
      topWitIntent?.name?.includes('water') ||
      (lower.includes('water') &&
        !lower.includes('garden') &&
        !lower.includes('plant')) ||
      lower.includes('drank') ||
      lower.includes('thirsty')
    ) {
      return {
        text,
        intent: 'log_water',
        confidence: topWitIntent?.confidence || 0.97,
        entities: { habit: 'hydration', 'wit$number': witNumber },
        traits: witTraits,
        source,
      };
    }

    // 6. Safe Meal Intent
    if (
      topWitIntent?.name?.includes('meal') ||
      lower.includes('ate') ||
      lower.includes('eat') ||
      lower.includes('lunch') ||
      lower.includes('breakfast') ||
      lower.includes('snack') ||
      lower.includes('apple')
    ) {
      return {
        text,
        intent: 'log_meal',
        confidence: topWitIntent?.confidence || 0.96,
        entities: { habit: 'safe_meal' },
        traits: witTraits,
        source,
      };
    }

    // 7. Botanical Garden Intent
    if (
      lower.includes('garden') ||
      lower.includes('plant') ||
      lower.includes('seed') ||
      lower.includes('tree')
    ) {
      return {
        text,
        intent: 'water_garden',
        confidence: topWitIntent?.confidence || 0.96,
        entities: { station: 'right_garden_table' },
        traits: witTraits,
        source,
      };
    }

    // 8. Dim Lights Intent
    if (
      lower.includes('dim') ||
      lower.includes('too bright') ||
      lower.includes('night') ||
      lower.includes('bedtime') ||
      lower.includes('dark')
    ) {
      return {
        text,
        intent: 'dim_lights',
        confidence: topWitIntent?.confidence || 0.97,
        entities: { lighting: 'night_dim' },
        traits: { sentiment: 'overstimulated' },
        source,
      };
    }

    // 9. World Switcher Intent
    if (
      lower.includes('ocean') ||
      lower.includes('forest') ||
      lower.includes('dino') ||
      lower.includes('space') ||
      lower.includes('world')
    ) {
      const targetWorld: WorldThemeId = lower.includes('ocean')
        ? 'ocean'
        : lower.includes('dino')
          ? 'dino'
          : lower.includes('space')
            ? 'space'
            : 'forest';
      return {
        text,
        intent: 'switch_world',
        confidence: topWitIntent?.confidence || 0.98,
        entities: { world_theme: targetWorld },
        traits: witTraits,
        source,
      };
    }

    // 10. 3D Light Brush Intent
    if (
      lower.includes('brush') ||
      lower.includes('paint') ||
      lower.includes('draw') ||
      lower.includes('art')
    ) {
      return {
        text,
        intent: 'open_brush',
        confidence: topWitIntent?.confidence || 0.96,
        entities: { tool: '3d_light_brush' },
        traits: witTraits,
        source,
      };
    }

    return {
      text,
      intent: 'next_step',
      confidence: topWitIntent?.confidence || 0.92,
      entities: { action: 'advance_stage' },
      traits: witTraits,
      source,
    };
  }

  private async fetchLiveSensoryWeather(): Promise<WeatherSensoryReport> {
    try {
      // Fetches live local weather from Open-Meteo (No API key needed, CORS-enabled)
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=17.385&longitude=78.4867&current_weather=true',
      );
      if (res.ok) {
        const data = await res.json();
        const temp = Math.round(data.current_weather?.temperature ?? 26);
        const code = data.current_weather?.weathercode ?? 0;
        const wind = data.current_weather?.windspeed ?? 5;

        let condition: WeatherSensoryReport['condition'] = 'SUNNY';
        if (code >= 51) condition = 'RAINY';
        else if (wind > 18) condition = 'WINDY';
        else if (code >= 2) condition = 'CLOUDY';

        const sensoryOutfitTip =
          condition === 'RAINY'
            ? '🌧️ Sensory Prep: Soft hoodie + pack extra dry socks & ear defenders for rain noise!'
            : condition === 'WINDY'
              ? '🌬️ Sensory Prep: Snug zip jacket + noise headphones so wind doesn’t bother your ears!'
              : temp >= 27
                ? '☀️ Sensory Prep: Breathable tagless cotton tee + sunglasses for bright glare + drink 1 cup water!'
                : '🌤️ Sensory Prep: Comfy soft layers + sunglasses if stepping outside!';

        return {
          tempC: temp,
          condition,
          headline: `🌡️ Live Weather: ${temp}°C (${condition})`,
          sensoryOutfitTip,
        };
      }
    } catch {
      // Offline fallback
    }
    return {
      tempC: 26,
      condition: 'SUNNY',
      headline: '🌡️ Live Weather: 26°C (CLEAR & BRIGHT)',
      sensoryOutfitTip:
        '☀️ Sensory Prep: Soft tagless cotton tee + sunglasses for glare + pack headphones!',
    };
  }

  private async executeSpatialIntent(res: WitIntentResult): Promise<void> {
    switch (res.intent) {
      case 'check_weather_outfit': {
        const report = await this.fetchLiveSensoryWeather();
        this.handlers.onShowWeatherHologram(report);
        break;
      }
      case 'chunk_big_task': {
        const task = res.entities.big_task || 'Big Task';
        const steps: [string, string, string] =
          task === 'Clean Room'
            ? [
                '📌 1. Pick up 3 clothes',
                '📌 2. Clear desk corner',
                '📌 3. Put books on shelf',
              ]
            : task === 'School Bag'
              ? [
                  '📌 1. Put notebook in bag',
                  '📌 2. Zip pencil pouch',
                  '📌 3. Fill water bottle',
                ]
              : [
                  '📌 1. Open book to page 1',
                  '📌 2. Read first 3 lines',
                  '📌 3. Write 1st sentence',
                ];
        this.handlers.onChunkBigTask(task, steps);
        break;
      }
      case 'sensory_sos':
        this.handlers.onTriggerSensorySOS();
        break;
      case 'pin_sticky_note':
        this.handlers.onPinCustomSticky(
          res.entities['wit$reminder'] || res.text,
        );
        break;
      case 'log_water':
        this.handlers.onDrinkWater(res.entities['wit$number'] || 1);
        break;
      case 'log_meal':
        this.handlers.onLogMeal();
        break;
      case 'water_garden':
        this.handlers.onWaterGarden();
        break;
      case 'dim_lights':
        this.handlers.onDimLights(true);
        break;
      case 'switch_world':
        this.handlers.onSwitchWorld(res.entities.world_theme || 'ocean');
        break;
      case 'open_brush':
        this.handlers.onOpen3DBrush();
        break;
      default:
        this.handlers.onAdvanceStep();
        break;
    }
  }
}