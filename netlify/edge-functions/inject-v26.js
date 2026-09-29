export default async function handler(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const injection = '<script src="/patch-v26.js?v=26"></script><script src="/patch-v27.js?v=27"></script><script src="/patch-v28.js?v=28"></script><script src="/patch-v29.js?v=29"></script><script src="/patch-v30.js?v=30"></script>';
  if (!html.includes('/patch-v30.js')) {
    html = html.replace('</body>', injection + '</body>');
  }

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export const config = {
  path: '/*',
  excludedPath: ['/patch-v26.js', '/patch-v27.js', '/patch-v28.js', '/patch-v29.js', '/patch-v30.js', '/.netlify/functions/*', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.jpeg', '/*.webp', '/*.svg', '/*.ico']
};
