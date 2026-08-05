'use client';

/**
 * Renders the line-structured text extracted from a research file — CSV rows,
 * timestamped transcript lines, numbered contract clauses, plain sentences —
 * as a document instead of one preformatted blob. Shared by the Research
 * reading pane and the meeting file preview.
 */
import { cn } from '@/components/ui';

/* Rendering the extracted text                                        */
/* ------------------------------------------------------------------ */

type TextBlock =
  | { type: 'heading'; text: string }
  | { type: 'para'; text: string }
  | { type: 'clause'; ref: string; text: string }
  | { type: 'table'; lines: string[] }
  | { type: 'transcript'; rows: { time: string; text: string }[] };

const TRANSCRIPT_LINE = /^\[(\d{1,2}:\d{2})\]\s*(.*)$/;
const CLAUSE_LINE = /^((?:\d+\.\d+|p\.\d+))\s+(.*)$/;

/**
 * The extracted text is line-structured — CSV rows, timestamped transcript
 * lines, numbered contract clauses, plain sentences. Group it into blocks so it
 * reads like a document instead of one preformatted blob.
 */
function parseResearchText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;

    const transcript = TRANSCRIPT_LINE.exec(line);
    if (transcript) {
      const last = blocks.at(-1);
      const row = { time: transcript[1] ?? '', text: transcript[2] ?? '' };
      if (last?.type === 'transcript') last.rows.push(row);
      else blocks.push({ type: 'transcript', rows: [row] });
      continue;
    }

    // Two commas or more reads as a data row, not a sentence.
    if ((line.match(/,/g)?.length ?? 0) >= 2) {
      const last = blocks.at(-1);
      if (last?.type === 'table') last.lines.push(line);
      else blocks.push({ type: 'table', lines: [line] });
      continue;
    }

    const clause = CLAUSE_LINE.exec(line);
    if (clause) {
      blocks.push({ type: 'clause', ref: clause[1] ?? '', text: clause[2] ?? '' });
      continue;
    }

    if (index === 0) {
      blocks.push({ type: 'heading', text: line });
      continue;
    }

    blocks.push({ type: 'para', text: line });
  }
  return blocks;
}

/** A dark-card block with a small label, the way a chat answer frames code. */
function CardBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 overflow-hidden rounded-lg border">
      <p className="text-muted-foreground px-4 pt-2.5 text-[11px]">{label}</p>
      <div className="overflow-x-auto px-4 pt-1.5 pb-3">{children}</div>
    </div>
  );
}

export function ResearchText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4">
      {parseResearchText(text).map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={index} className="text-base font-semibold">
                {block.text}
              </h3>
            );
          case 'table':
            return (
              <CardBlock key={index} label="table">
                <pre className="font-mono text-xs leading-relaxed">
                  {block.lines.map((line, row) => (
                    <div key={row} className={cn(row === 0 && 'text-muted-foreground')}>
                      {line}
                    </div>
                  ))}
                </pre>
              </CardBlock>
            );
          case 'transcript':
            return (
              <CardBlock key={index} label="transcript">
                <div className="flex flex-col gap-1.5">
                  {block.rows.map((row) => (
                    <p key={row.time} className="text-xs leading-relaxed">
                      <span className="mr-2 font-mono text-emerald-600 dark:text-emerald-400">
                        {row.time}
                      </span>
                      {row.text}
                    </p>
                  ))}
                </div>
              </CardBlock>
            );
          case 'clause':
            return (
              <p key={index} className="flex items-start gap-2 text-sm leading-relaxed">
                <code className="bg-muted mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]">
                  {block.ref}
                </code>
                <span className="min-w-0">{block.text}</span>
              </p>
            );
          default:
            return (
              <p key={index} className="text-sm leading-relaxed">
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
