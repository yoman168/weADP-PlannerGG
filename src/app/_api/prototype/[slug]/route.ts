/**
 * The html of one prototype screen.
 *
 * The files in `version 1` are html files, and this is where that html comes
 * from: the app renders the screen, and this route hands back that markup as a
 * standalone document — assets pointed at absolute urls so the file still looks
 * right when it is opened from disk or pasted into a deck.
 *
 * `?download=1` sends it as an attachment named after the file.
 */
import { NextResponse } from 'next/server';
import { findPrototypeBySlug, findPrototypeByFileName } from '@/lib/we-adk/prototype';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  // Accept both `cash-receipt` and `10-cash-receipt.html`.
  const file = findPrototypeBySlug(slug) ?? findPrototypeByFileName(slug);
  if (!file) {
    return NextResponse.json({ error: `No prototype file named ${slug}.` }, { status: 404 });
  }

  const url = new URL(request.url);
  const origin = url.origin;

  const rendered = await fetch(`${origin}${file.route}`, {
    headers: { accept: 'text/html' },
    cache: 'no-store',
  });
  if (!rendered.ok) {
    return NextResponse.json(
      { error: `The app returned ${rendered.status} for ${file.route}.` },
      { status: 502 },
    );
  }

  const html = (await rendered.text())
    // Root-relative assets only resolve against the server, so make them absolute.
    .replace(/(href|src)="\/(?!\/)/g, `$1="${origin}/`)
    .replace(
      '<head>',
      `<head>\n<!-- ${file.fileName} — ${file.name} · eACC Cloud prototype, exported from WE-ADK -->`,
    );

  const download = url.searchParams.get('download') === '1';

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${file.fileName}"`,
      'cache-control': 'no-store',
    },
  });
}
