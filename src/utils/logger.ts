const isDev = process.env.NODE_ENV !== 'production';

function log(level: string, message: string, ...args: unknown[]) {
  const ts = new Date().toISOString();
  const out = level === 'error' ? console.error : console.log;
  out(`[${ts}] [${level.toUpperCase()}] ${message}`, ...args);
}

export const logger = {
  debug: (m: string, ...a: unknown[]) => { if (isDev) log('debug', m, ...a); },
  info:  (m: string, ...a: unknown[]) => log('info', m, ...a),
  warn:  (m: string, ...a: unknown[]) => log('warn', m, ...a),
  error: (m: string, ...a: unknown[]) => log('error', m, ...a),
};

export default logger;
