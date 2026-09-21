export class EventEngine {
  constructor(events = []) {
    this.events = events;
  }

  eligible(state) {
    return this.events.filter((event) => !event.condition || event.condition(state));
  }

  choose(state, rng) {
    const candidates = this.eligible(state);
    if (!candidates.length) return null;
    return rng.weighted(candidates.map((event) => ({ value: event, weight: event.weight?.(state) ?? 1 })));
  }

  resolve(state, event, choiceId) {
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
    const nextState = structuredClone(state);
    choice.effect(nextState);
    return { state: nextState, result: choice.result };
  }
}
