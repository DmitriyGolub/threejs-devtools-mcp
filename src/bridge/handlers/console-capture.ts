import type { Handler } from '../types.js';

interface CapturedMessage {
  level: 'log' | 'warn' | 'error';
  text: string;
  timestamp: number;
  count: number;  // dedup: how many times this message repeated
}

const MAX_BUFFER = 200;
const messages: CapturedMessage[] = [];
let capturing = false;

export function setupConsoleCapture(): void {
  if (capturing) return;
  capturing = true;

  for (const level of ['log', 'warn', 'error'] as const) {
    const orig = console[level];
    console[level] = (...args: any[]) => {
      const text = args.map(a => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === 'object') try { return JSON.stringify(a).slice(0, 500); } catch { return String(a); }
        return String(a);
      }).join(' ');

      // Skip devtools own messages
      if (!text.startsWith('[threejs-devtools-mcp]')) {
        // Dedup: merge with last message if identical
        const last = messages[messages.length - 1];
        if (last && last.level === level && last.text === text) {
          last.count++;
          last.timestamp = Date.now();
        } else {
          messages.push({ level, text, timestamp: Date.now(), count: 1 });
          if (messages.length > MAX_BUFFER) messages.shift();
        }
      }

      orig.apply(console, args);
    };
  }
}

export const consoleCaptureHandler: Handler = (_ctx, params) => {
  setupConsoleCapture();

  const clear = params.clear as boolean;
  if (clear) { messages.length = 0; return { cleared: true }; }

  const level = params.level as string | undefined;
  const limit = Math.min((params.limit as number) || 50, MAX_BUFFER);

  let filtered = level ? messages.filter(m => m.level === level) : messages;
  const total = filtered.length;
  filtered = filtered.slice(-limit);

  // Compact: skip text longer than 300 chars, show count for repeats
  const compact = filtered.map(m => ({
    level: m.level,
    text: m.text.length > 300 ? m.text.slice(0, 297) + '...' : m.text,
    ...(m.count > 1 ? { repeated: m.count } : {}),
    timestamp: m.timestamp,
  }));

  return { messages: compact, total, bufferSize: messages.length };
};
