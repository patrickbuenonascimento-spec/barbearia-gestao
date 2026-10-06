export default async function handler(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const injection = '<script src="/patch-v26.js?v=26"></script><script src="/patch-v30.js?v=30"></script><script src="/patch-v47.js?v=47"></script>';
  if (!html.includes('/patch-v47.js')) {
    html = html.replace('</body>', injection + '</body>');
  }

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export const config = {
  path: '/*',
  excludedPath: ['/patch-v26.js', '/patch-v30.js', '/patch-v47.js', '/api/*', '/.netlify/functions/*', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.jpeg', '/*.webp', '/*.svg', '/*.ico']
};
