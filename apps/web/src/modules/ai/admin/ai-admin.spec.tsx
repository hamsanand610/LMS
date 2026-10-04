// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canSeeAiPage } from '../access';
import { meWith, renderWith } from '../testing';
import { AiSettingsForm } from './ai-settings-form';
import { AiUsageReport, usagePeriodQuery } from './ai-usage-report';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const figures = {
  questions: 3,
  inputTokens: 120,
  outputTokens: 80,
  estimatedCalls: 0,
  estimatedCostUsd: 0.0021,
};

function usage(budget: object | null) {
  return {
    from: '2026-10-01',
    to: '2026-10-04',
    costsAreEstimates: true,
    totals: figures,
    days: [{ day: '2026-10-04', ...figures }],
    people: [
      { userId: '0190a0e4-7c1d-7b9e-8f00-0000000000e1', name: 'Asha Learner', ...figures },
      { userId: null, name: '', ...figures },
    ],
    budget,
  };
}

const VIEW = {
  settings: {
    dailyQuestions: null,
    dailyTokens: null,
    monthlyBudgetUsd: 25,
    budgetWarningPercent: 80,
    conversationRetentionDays: 90,
    usageDetailRetentionDays: 730,
    dataClasses: null,
    model: null,
    taskModels: {},
    fallbackModel: null,
    cacheTtlHours: 168,
  },
  effective: {
    dailyQuestions: 50,
    dailyTokens: 200000,
    monthlyBudgetUsd: 25,
    budgetWarningPercent: 80,
    conversationRetentionDays: 90,
    usageDetailRetentionDays: 730,
    dataClasses: ['public', 'course'],
    model: 'gemini-3.8-flash',
    taskModels: { chat: 'gemini-3.8-flash' },
    fallbackModel: null,
    cacheTtlHours: 168,
  },
  models: [
    { id: 'gemini-3.8-flash', tasks: ['chat', 'hint', 'title'], mayStandIn: true, priced: true },
  ],
  approvableDataClasses: ['public', 'course'],
  ignored: ['fallbackModel names a model this installation cannot call'],
};

// Radix's Switch measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

beforeEach(() => {
  mocks.api.mockReset();
});
afterEach(cleanup);

describe('SI Academy AI’s management pages (Phase 7E)', () => {
  it('opens the settings to the Super Admin alone, and usage to those with ai:usage_read', () => {
    const on = { 'module.ai': true };
    expect(canSeeAiPage(meWith(on, ['ai:manage', 'ai:usage_read']), 'ai:manage')).toBe(true);
    expect(canSeeAiPage(meWith(on, ['ai:usage_read', 'ai:chat']), 'ai:manage')).toBe(false);
    expect(canSeeAiPage(meWith(on, ['ai:chat', 'ai:hints']), 'ai:usage_read')).toBe(false);
    expect(canSeeAiPage(meWith(on, ['ai:usage_read']), 'ai:usage_read')).toBe(true);
    expect(canSeeAiPage(meWith({ 'module.ai': false }, ['ai:manage']), 'ai:manage')).toBe(false);
  });

  it('shows usage exactly as the API scoped it: a trainer sees no budget, and no question or answer', async () => {
    mocks.api.mockResolvedValue(usage(null));
    renderWith(<AiUsageReport />, meWith({ 'module.ai': true }, ['ai:usage_read']));
    expect(await screen.findByText('Asha Learner')).toBeTruthy();
    expect(screen.getByText('People whose data was erased')).toBeTruthy();
    expect(screen.queryByText('Monthly budget')).toBeNull();
    expect(screen.getByText(/Costs are estimates/)).toBeTruthy();
    expect(mocks.api).toHaveBeenCalledWith('/ai/usage');
    // Two people's rows, exactly what was returned: nothing filtered or added in the browser.
    expect(screen.getAllByRole('row')).toHaveLength(1 + 1 + 1 + 2);
  });

  it('shows the budget to those who see the whole institute', async () => {
    mocks.api.mockResolvedValue(
      usage({ month: '2026-10', budgetUsd: 25, spentUsd: 21, percent: 84, state: 'warning' }),
    );
    renderWith(<AiUsageReport />, meWith({ 'module.ai': true }, ['ai:usage_read']));
    expect(await screen.findByText('Monthly budget')).toBeTruthy();
    expect(screen.getByText('84% used: close to the budget.')).toBeTruthy();
  });

  it('asks for a period ending today', () => {
    const today = new Date(2026, 9, 4);
    expect(usagePeriodQuery('month', today)).toEqual({ from: '', to: '' });
    expect(usagePeriodQuery('7', today)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(usagePeriodQuery('30', today)).toEqual({ from: '2026-09-05', to: '2026-10-04' });
  });

  it('shows the settings and what applies now, the choices it cannot honour, and never a key', async () => {
    mocks.api.mockImplementation(async (path: string) => {
      if (path === '/ai/admin/settings') return VIEW;
      if (path === '/ai/admin/status')
        return { configured: true, gatewayReady: true, service: 'ready' };
      throw new Error(`unexpected ${path}`);
    });
    renderWith(<AiSettingsForm />, meWith({ 'module.ai': true }, ['ai:manage']));
    expect(await screen.findByLabelText('Questions per person per day')).toBeTruthy();
    expect(screen.getByText('Applies now: 50')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Answering')).toBeTruthy());
    expect(
      screen.getByText('fallbackModel names a model this installation cannot call'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empty the answer cache' })).toBeTruthy();
    for (const input of Array.from(document.querySelectorAll('input, select, textarea'))) {
      const label = document.querySelector(`label[for="${input.id}"]`)?.textContent ?? '';
      expect(label).not.toMatch(/key|secret|password|token url/i);
    }
  });
});
