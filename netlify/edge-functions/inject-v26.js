export default async function handler(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  if (!html.includes('/patch-v26.js')) {
    html = html.replace('</body>', '<script src="/patch-v26.js?v=26"></script></body>');
  }
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export const config = {
  path: '/*',
  excludedPath: ['/patch-v26.js', '/.netlify/functions/*', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.jpeg', '/*.webp', '/*.svg', '/*.ico']
};
