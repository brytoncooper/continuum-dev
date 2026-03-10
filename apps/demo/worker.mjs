function isAnthropicPath(pathname) {
  return pathname === '/api/anthropic/messages';
}

async function handleAnthropicProxy(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        allow: 'POST',
      },
    });
  }

  const upstreamHeaders = new Headers(request.headers);
  const upstreamRequest = new Request(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: upstreamHeaders,
      body: request.body,
    }
  );

  return fetch(upstreamRequest);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isAnthropicPath(url.pathname)) {
      return handleAnthropicProxy(request);
    }

    return env.ASSETS.fetch(request);
  },
};
