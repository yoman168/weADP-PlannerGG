'use client';

/**
 * The `.html` button, for any design file in any round.
 *
 * A version 1 file is html because a real page sits behind it, and the server
 * can render that page. A design drawn in a later round has no page — it is
 * blocks in the browser — so its html is written from those blocks instead.
 * Same button, same file name, same result: the screen as one standalone
 * document. Which of the two it is stays in here.
 */
import { Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { designToHtml, downloadDesignHtml } from '@/lib/we-adk/design-html';
import { findPrototypeFile, prototypeHtmlHref } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';

export function DesignHtmlButton({
  screenId,
  name,
  route,
  seedPattern = 'listPage',
  origin,
  className,
}: {
  screenId: string;
  /** The screen's name — the document title, and the downloaded file name. */
  name: string;
  route?: string;
  /** Only used if the design has no saved canvas yet. */
  seedPattern?: string;
  /** Where the file lives, e.g. `version 2` — stamped into the export note. */
  origin?: string;
  className?: string;
}) {
  const prototype = findPrototypeFile(screenId);

  // A page of the running app: the server renders it, so this is a plain link.
  if (prototype) {
    return (
      <Button variant="outline" size="sm" className={className} asChild>
        <a href={`${prototypeHtmlHref(prototype)}?download=1`}>
          <Download className="size-3" />
          .html
        </a>
      </Button>
    );
  }

  // Blocks in this browser, so the document is written here and handed over as
  // a download — the canvas is read at click time, not at render.
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() =>
        downloadDesignHtml(
          name,
          designToHtml({
            name,
            route,
            origin,
            blocks: loadScreenBlocks(screenId, seedPattern, () => prototypeDesignBlocks(screenId)),
          }),
        )
      }
    >
      <Download className="size-3" />
      .html
    </Button>
  );
}
