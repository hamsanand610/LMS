/** Thrown when every slot is busy and the waiting list is full. */
export class QueueFullError extends Error {
  constructor() {
    super('The runner is busy');
    this.name = 'QueueFullError';
  }
}

/**
 * At most `concurrency` jobs at once, at most `queue` more waiting, first come first served.
 * Beyond that a job is refused at once, so a burst turns into quick "try again" answers instead
 * of requests that hang until they time out.
 */
export class Limiter {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly queue: number,
  ) {}

  get load(): { running: number; waiting: number } {
    return { running: this.running, waiting: this.waiting.length };
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      if (this.waiting.length >= this.queue) throw new QueueFullError();
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      // The slot passes straight to the next job; the count only drops when nobody is waiting.
      if (next) next();
      else this.running -= 1;
    }
  }
}
