import { RNG } from './rng.js';
import { generateFamily } from '../family/family_generator.js';
import { EventEngine } from '../events/event_engine.js';
import { childhoodEvents } from '../events/childhood_events.js';

export class Game {
  constructor(seed = String(Date.now())) {
    this.seedText = String(seed);
    this.rng = new RNG(this.seedText);
    this.state = generateFamily(this.rng);
    this.state.year = 2026;
    this.state.history = [];
    this.events = new EventEngine(childhoodEvents);
  }

  ageOneYear() {
    this.state.player.age += 1;
    this.state.year += 1;
    const event = this.events.choose(this.state, this.rng.fork(`year-${this.state.year}`));
    return event;
  }

  makeChoice(event, choiceId) {
    const resolved = this.events.resolve(this.state, event, choiceId);
    this.state = resolved.state;
    this.state.history.push({ age: this.state.player.age, eventId: event.id, choiceId, result: resolved.result });
    return resolved.result;
  }
}
