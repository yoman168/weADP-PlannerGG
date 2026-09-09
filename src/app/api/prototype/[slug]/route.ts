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
  // `file.route` is the in-app path. When the app is served under a basePath
  // (the shared nginx edge sets BASE_PATH=/adk) the real URL carries that
  // prefix, and so must this self-fetch — otherwise every screen 404s and the
  // export comes back as a 502. Empty in dev, so nothing changes there.
  const basePath = process.env.BASE_PATH?.replace(/\/$/, '') ?? '';

  /**
   * The origin baked into the exported file's absolute urls.
   *
   * `request.url` is the origin the *server* was reached on, which in the Docker
   * image is the bind address (http://0.0.0.0:3000) — a url no browser can open.
   * Behind the nginx edge the real public origin only exists in the forwarded
   * headers, so prefer those, then the Host header, and keep `url.origin` as the
   * last resort for a plain `next dev` run.
   */
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(/:$/, '');
  const origin = host ? `${proto}://${host}` : url.origin;
  /**
   * Always fetch over loopback: this is the server talking to itself.
   *
   * `url.origin` is no good here either — Next rebuilds `request.url` from
   * x-forwarded-host, so behind the edge it becomes the public https origin and
   * the self-fetch dies on ERR_SSL_WRONG_VERSION_NUMBER against a plain-http
   * server. PORT is set by the Docker image and by compose; the 3000 fallback
   * matches the `dev` script's `--port 3000`.
   */
  const selfOrigin = `http://127.0.0.1:${process.env.PORT ?? '3000'}`;

  const rendered = await fetch(`${selfOrigin}${basePath}${file.route}`, {
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
