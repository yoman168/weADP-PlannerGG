/**
 * What happened in Business, in order.
 *
 * The tab tells you things once: a design was saved, a round was released, a
 * carry-over brought four files across — each as a toast that is gone in three
 * seconds. That is fine while you are the one doing it and useless afterwards,
 * which is exactly when somebody asks when a round was released, or why a file
 * they were looking for is not there any more.
 *
 * So the same sentences are kept. Monitor has a log per service for the same
 * reason: a stream of what a thing did beats a snapshot of what it is.
 *
 * Recorded as it happens and nothing is seeded — an untouched project has an
 * empty log, which is the truth about it. A log with invented history in it
 * would be the one thing in this mockup that cannot be trusted.
 */

export interface ActivityEvent {
  id: string;
  /** ISO instant — formatted for display, never parsed back for meaning. */
  at: string;
  /** The round it happened in, when it happened in one. */
  version?: number;
  /** The sentence, already in the reader's language. */
  text: string;
}

const KEY = 'we-adk:business:activity';

/**
 * How much is kept.
 *
 * Enough to cover a session's work and then some; not so much that a project
 * worked on for months carries a log nobody scrolls. The oldest go first, which
 * is the right end to lose from a record whose point is what happened lately.
 */
export const MAX_EVENTS = 200;

function isEvent(value: unknown): value is ActivityEvent {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<ActivityEvent>;
  return (
    typeof entry.id === 'string' && typeof entry.at === 'string' && typeof entry.text === 'string'
  );
}

/** Newest first — the order it is read in. */
export function loadActivity(projectId: string): ActivityEvent[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEvent).map((entry) => ({
      id: entry.id,
      at: entry.at,
      version: typeof entry.version === 'number' ? entry.version : undefined,
      text: entry.text,
    }));
  } catch {
    return [];
  }
}

/**
 * Add one, and hand back the log it produced.
 *
 * Returned rather than announced, so the caller that already re-renders for the
 * toast can set the log in the same breath and there is no second channel for
 * a view to get out of step on.
 */
export function recordActivity(
  projectId: string,
  text: string,
  version?: number,
  now: Date = new Date(),
): ActivityEvent[] {
  const at = now.toISOString();
  const existing = loadActivity(projectId);
  const event: ActivityEvent = {
    // The instant plus a counter: two events in the same millisecond are
    // ordinary — releasing a round records the release and what it copied — and
    // React needs the keys to differ.
    id: `${at}-${existing.length}`,
    at,
    version,
    text,
  };
  const next = [event, ...existing].slice(0, MAX_EVENTS);
  try {
    window.localStorage.setItem(`${KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the log lasts as long as the tab does.
  }
  return next;
}

export function clearActivity(projectId: string): ActivityEvent[] {
  try {
    window.localStorage.removeItem(`${KEY}:${projectId}`);
  } catch {
    // Nothing to do — the read will keep returning what is there.
  }
  return [];
}

/** `14:32:07`, the stamp Monitor's logs use, so the two read the same way. */
export function activityStamp(at: string): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return '--:--:--';
  return parsed.toTimeString().slice(0, 8);
}

/** `12 Aug` — the day, for the divider between one day's work and the next. */
export function activityDay(at: string): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
