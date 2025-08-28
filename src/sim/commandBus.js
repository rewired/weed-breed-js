const handlers = new Map();

/**
 * Register a command handler.
 * @param {string} type
 * @param {(ctx: { engine?: any, logger?: any, payload?: any }) => any|Promise<any>} fn
 */
export function register(type, fn) {
  handlers.set(type, fn);
}

/**
 * Dispatch a command.
 * @param {{ type: string, payload?: any }} cmd
 * @param {{ engine?: any, logger?: any }} [ctx]
 * @returns {Promise<any>}
 */
export async function dispatch(cmd, ctx = {}) {
  const h = handlers.get(cmd?.type);
  if (!h) throw new Error(`unknown command: ${cmd?.type}`);
  return await h({ ...ctx, payload: cmd.payload });
}

// built-in handlers (no-ops if engine missing)
register('sim.start', ({ engine }) => engine?.start());
register('sim.stop', ({ engine }) => engine?.stop());
register('sim.setSpeed', ({ engine, payload }) => engine?.setSpeed(Number(payload?.tickMs)));
register('sim.status', ({ engine }) => ({
  running: engine?.isRunning?.() || false,
  tick: engine?.getTick?.() || 0,
  tickMs: engine?.getTickMs?.(),
}));

export default { register, dispatch };

