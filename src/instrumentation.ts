/** Runs once when the server starts: refuse to start with missing or invalid configuration. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getConfig } = await import('@/server/config');
  getConfig();
}
