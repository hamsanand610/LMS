import { describe, expect, it } from 'vitest';
import { inAudience } from './flag-audience.js';

const everyone = { roleKeys: [], batchIds: [] };
const learnerInA = { roleKeys: ['student'], batchIds: ['batch-a'] };
const trainerOfB = { roleKeys: ['trainer'], batchIds: ['batch-b'] };
const admin = { roleKeys: ['admin'], batchIds: [] };
const superAdmin = { roleKeys: ['super_admin'], batchIds: [] };

describe('who a flag reaches', () => {
  it('reaches everyone when no audience is set', () => {
    for (const member of [learnerInA, trainerOfB, admin, superAdmin]) {
      expect(inAudience(everyone, member)).toBe(true);
    }
  });

  it('reaches only the listed roles when roles are listed', () => {
    const students = { roleKeys: ['student'], batchIds: [] };
    expect(inAudience(students, learnerInA)).toBe(true);
    expect(inAudience(students, trainerOfB)).toBe(false);
    expect(inAudience(students, admin)).toBe(false);
  });

  it('reaches the listed batches’ learners and trainers, and staff with no batch of their own', () => {
    const pilot = { roleKeys: [], batchIds: ['batch-a'] };
    expect(inAudience(pilot, learnerInA)).toBe(true);
    expect(inAudience(pilot, trainerOfB)).toBe(false);
    expect(inAudience(pilot, admin), 'staff prepare what the pilot will see').toBe(true);
  });

  it('needs every listed condition at once', () => {
    const pilotLearners = { roleKeys: ['student'], batchIds: ['batch-b'] };
    expect(inAudience(pilotLearners, learnerInA)).toBe(false);
    expect(inAudience(pilotLearners, { roleKeys: ['student'], batchIds: ['batch-b'] })).toBe(true);
  });

  it('never shuts the Super Admin out', () => {
    expect(inAudience({ roleKeys: ['student'], batchIds: ['batch-a'] }, superAdmin)).toBe(true);
  });
});
