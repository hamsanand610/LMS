/**
 * Waits for work an event started after the response was sent (an `@OnEvent` handler or a job):
 * reads again every 100 ms, for up to six seconds, until `done` holds, and returns the last read.
 */
export async function eventually<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
): Promise<T> {
  let value = await read();
  for (let tries = 0; tries < 60 && !done(value); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}
