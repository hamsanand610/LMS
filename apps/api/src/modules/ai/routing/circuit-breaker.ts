export interface CircuitOptions {
  /** Consecutive failures of the model service that rest a model. */
  failureThreshold: number;
  /** How long a resting model gets no calls before one probe may try it again. */
  cooldownMs: number;
  now: () => number;
}

export const DEFAULT_CIRCUIT: CircuitOptions = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  now: () => Date.now(),
};

/** `closed`: calls go through; `open`: the model rests, no calls; `half_open`: one probe may go. */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * One model's circuit (Phase 7B). Closed while the model answers. After `failureThreshold`
 * consecutive failures of the model service it opens, and the model gets no calls; after
 * `cooldownMs` it is half open, and one probe call goes through, whose outcome closes the circuit
 * or opens it again. A success always closes it and clears the count.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private probing = false;

  constructor(private readonly options: CircuitOptions) {}

  state(): CircuitState {
    if (this.openedAt === null) return 'closed';
    return this.options.now() - this.openedAt >= this.options.cooldownMs ? 'half_open' : 'open';
  }

  /** Whether a call may go now; while half open, only one probe at a time. */
  tryAcquire(): boolean {
    const state = this.state();
    if (state === 'closed') return true;
    if (state === 'open' || this.probing) return false;
    this.probing = true;
    return true;
  }

  /** The model answered: the circuit closes. True when that ends a rest. */
  succeeded(): boolean {
    const wasResting = this.openedAt !== null;
    this.failures = 0;
    this.openedAt = null;
    this.probing = false;
    return wasResting;
  }

  /** The model service failed. True when this opened the circuit: the threshold, or a failed probe. */
  failed(): boolean {
    this.failures += 1;
    if (this.probing || this.state() === 'half_open') {
      this.openedAt = this.options.now();
      this.probing = false;
      return true;
    }
    if (this.openedAt === null && this.failures >= this.options.failureThreshold) {
      this.openedAt = this.options.now();
      return true;
    }
    return false;
  }

  /** The call ended without a verdict on the model (cancelled, refused as invalid). */
  released(): void {
    this.probing = false;
  }
}

/**
 * Every model's circuit in this process. In-process state, as the rate limiter and the execution
 * gate keep theirs (ADR-0006): each API instance rests a failing model on its own.
 */
export class AiCircuitBreakers {
  private readonly circuits = new Map<string, CircuitBreaker>();

  constructor(private readonly options: CircuitOptions = DEFAULT_CIRCUIT) {}

  circuitOf(provider: string, model: string): CircuitBreaker {
    const key = `${provider}/${model}`;
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = new CircuitBreaker(this.options);
      this.circuits.set(key, circuit);
    }
    return circuit;
  }

  state(provider: string, model: string): CircuitState {
    return this.circuits.get(`${provider}/${model}`)?.state() ?? 'closed';
  }
}
