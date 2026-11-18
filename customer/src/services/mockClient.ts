/** Every mock service goes through this, so swapping one for a NestJS call only changes the service file. */
export function mockRequest<T>(produce: () => T, latencyMs = 300): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(produce());
      } catch (e) {
        reject(e);
      }
    }, latencyMs);
  });
}
