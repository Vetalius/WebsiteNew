/**
 * Cloudflare Pages: marketing at / + Vue SPA at /app/ + offline demo at /demo/.
 *
 * Do NOT use ASSETS 404 to detect SPA routes — Cloudflare returns root
 * index.html with 200 for unknown paths, which breaks /app/* and /demo/app/* refresh.
 */
const ELERING_PROXY_URL =
  'https://us-central1-wexa-9401f.cloudfunctions.net/eleringNpsProxy';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/app/api/elering-nps' || pathname === '/demo/app/api/elering-nps') {
      const target = new URL(ELERING_PROXY_URL);
      target.search = url.search;
      return fetch(target.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      });
    }

    if (pathname === '/app') {
      return Response.redirect(new URL('/app/', url).toString(), 301);
    }

    if (pathname === '/demo') {
      return Response.redirect(new URL('/demo/', url).toString(), 301);
    }

    if (pathname.startsWith('/demo/app')) {
      return handleSpaMount(request, env, url, '/demo/app');
    }

    if (pathname.startsWith('/app/')) {
      return handleSpaMount(request, env, url, '/app');
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSpaMount(request, env, url, mount) {
  const pathname = url.pathname;
  const prefix = mount.endsWith('/') ? mount.slice(0, -1) : mount;
  const root = `${prefix}/`;
  const indexPath = `${prefix}/index.html`;

  if (pathname === prefix) {
    return Response.redirect(new URL(root, url).toString(), 301);
  }

  if (pathname === root || pathname === indexPath) {
    return serveHtml(request, env, url, indexPath);
  }

  if (isStaticAsset(pathname, prefix)) {
    const assetResponse = await env.ASSETS.fetch(request);
    if (pathname.startsWith(`${prefix}/assets/`)) {
      const contentType = assetResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return new Response('Not Found', { status: 404, statusText: 'Not Found' });
      }
    }
    return assetResponse;
  }

  return serveHtml(request, env, url, indexPath);
}

function isStaticAsset(pathname, prefix) {
  const assetsRoot = `${prefix}/assets/`;
  if (pathname.startsWith(assetsRoot)) {
    return true;
  }

  const relative = pathname.slice(`${prefix}/`.length);
  if (!relative || relative.includes('/')) {
    return false;
  }

  return /\.[a-zA-Z0-9]+$/.test(relative);
}

function stripCloudflareAnalytics(html) {
  return html
    .replace(/<!-- Cloudflare Pages Analytics -->[\s\S]*?(?=<!-- Cloudflare Pages Analytics -->|<\/body>)/gi, '')
    .replace(/<script\b[^>]*\bsrc=(['"])https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\1[^>]*>\s*<\/script>/gi, '');
}

async function serveHtml(request, env, url, indexPath) {
  const indexRequest = new Request(new URL(indexPath, url).toString(), {
    method: 'GET',
    headers: request.headers,
  });

  const indexResponse = await env.ASSETS.fetch(indexRequest);
  if (!indexResponse.ok) {
    return indexResponse;
  }

  const contentType = indexResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return indexResponse;
  }

  const headers = new Headers(indexResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-cache');

  const html = stripCloudflareAnalytics(await indexResponse.text());
  return new Response(html, {
    status: 200,
    headers,
  });
}
