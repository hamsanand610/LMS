import { describe, expect, it } from 'vitest';
import { AiCircuitBreakers, CircuitBreaker } from './circuit-breaker.js';

function clocked(failureThreshold = 3, cooldownMs = 1000) {
  let now = 0;
  const circuit = new CircuitBreaker({ failureThreshold, cooldownMs, now: () => now });
  return { circuit, advance: (ms: number) => (now += ms) };
}

describe('a model’s circuit (Phase 7B)', () => {
  it('lets calls through until the threshold of consecutive failures, then rests the model', () => {
    const { circuit } = clocked(3);
    expect(circuit.state()).toBe('closed');
    expect(circuit.failed()).toBe(false);
    expect(circuit.failed()).toBe(false);
    expect(circuit.tryAcquire()).toBe(true);
    expect(circuit.failed()).toBe(true);
    expect(circuit.state()).toBe('open');
    expect(circuit.tryAcquire()).toBe(false);
  });

  it('counts consecutive failures only: a success clears the count', () => {
    const { circuit } = clocked(3);
    circuit.failed();
    circuit.failed();
    circuit.succeeded();
    circuit.failed();
    circuit.failed();
    expect(circuit.state()).toBe('closed');
  });

  it('after the rest, lets one probe through at a time', () => {
    const { circuit, advance } = clocked(1, 1000);
    circuit.failed();
    advance(999);
    expect(circuit.tryAcquire()).toBe(false);
    advance(1);
    expect(circuit.state()).toBe('half_open');
    expect(circuit.tryAcquire()).toBe(true);
    expect(circuit.tryAcquire()).toBe(false);
  });

  it('closes when the probe succeeds, and rests the model again when it fails', () => {
    const { circuit, advance } = clocked(1, 1000);
    circuit.failed();
    advance(1000);
    circuit.tryAcquire();
    expect(circuit.failed()).toBe(true);
    expect(circuit.state()).toBe('open');
    advance(1000);
    circuit.tryAcquire();
    expect(circuit.succeeded()).toBe(true);
    expect(circuit.state()).toBe('closed');
    expect(circuit.tryAcquire()).toBe(true);
    // A success with nothing to recover from is not a recovery.
    expect(circuit.succeeded()).toBe(false);
  });

  it('frees the probe without a verdict when the call ended for another reason', () => {
    const { circuit, advance } = clocked(1, 1000);
    circuit.failed();
    advance(1000);
    expect(circuit.tryAcquire()).toBe(true);
    circuit.released();
    expect(circuit.state()).toBe('half_open');
    expect(circuit.tryAcquire()).toBe(true);
  });

  it('keeps one circuit per provider and model, closed until used', () => {
    let now = 0;
    const circuits = new AiCircuitBreakers({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });
    expect(circuits.state('gemini', 'gemini-3.8-flash')).toBe('closed');
    circuits.circuitOf('gemini', 'gemini-3.8-flash').failed();
    expect(circuits.state('gemini', 'gemini-3.8-flash')).toBe('open');
    expect(circuits.state('gemini', 'gemini-3.5-flash-lite')).toBe('closed');
    expect(circuits.circuitOf('gemini', 'gemini-3.8-flash')).toBe(
      circuits.circuitOf('gemini', 'gemini-3.8-flash'),
    );
    now += 1000;
    expect(circuits.state('gemini', 'gemini-3.8-flash')).toBe('half_open');
  });
});
