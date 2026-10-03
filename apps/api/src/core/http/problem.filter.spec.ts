import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from './errors.js';
import { ProblemFilter } from './problem.filter.js';

function hostFor(res: object): ArgumentsHost {
  const req = { originalUrl: '/api/v1/ai/conversations/x/messages', headers: {} };
  return {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
}

describe('the problem filter', () => {
  it('answers an error with a problem document while nothing has been sent', () => {
    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };
    new ProblemFilter().catch(new ForbiddenError(), hostFor(res));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'forbidden' }));
  });

  it('closes a response already under way — an event stream — instead of writing over it', () => {
    const res = {
      headersSent: true,
      writableEnded: false,
      status: vi.fn(),
      type: vi.fn(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    new ProblemFilter().catch(new Error('late failure'), hostFor(res));
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
