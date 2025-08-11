/*
 *
 * Folders.io core routing, binding sessions to event streams and endpoints.
 *
 * This connects to a remote service requesting a new session and watches for events.
 *
 */
import nodeFetch from 'node-fetch';

const prefix = 'https://folders.io';
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const endpoint = (key, path) => {
  return `${prefix}${path}`;
};

// Request a new session, getting a share ID and token.
export const open = async (baseUri, params, fetch = nodeFetch) => {
  const response = await fetch(endpoint('', '/set_files'), {
    method: 'POST',
    body: JSON.stringify({
      shareId: '',
      allowOfflineStorage: true,
      allowUploads: false,
      parent: 0,
      data: '[]',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const cookie = response.headers.get('set-cookie');
  const data = await response.json();

  return {
    endpoint: endpoint(data.shareName, `/g/${data.shareName}`),
    shareName: data.shareName,
    shareId: data.shareId,
    token: cookie,
  };
};

// Watch a pipe listening for commands/requests.
export const watch = async (session, onMessage, fetch = nodeFetch) => {
  const { token, shareId } = session;

  const response = await fetch(
    endpoint(shareId, `/json?shareId=${shareId}`),
    {
      headers: {
        Cookie: token,
        Accept: 'text/event-stream',
      },
    }
  );

  const stream = response.body;

  stream.on('data', (chunk) => {
    const data = chunk.toString();
    const lines = data.split('\n\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = line.substring(6);
        if (json) {
          try {
            const message = JSON.parse(json);
            onMessage(message);
          } catch (e) {
            // ignore parse error
          }
        }
      }
    }
  });

  stream.on('end', () => {
    // console.log('stream closed');
  });
};

// Send a buffered response to a watched request.
export const post = async (streamId, data, headers, session, fetch = nodeFetch) => {
  const postHeaders = { ...headers };
  postHeaders.Cookie = session.token;

  await fetch(endpoint(streamId, `/upload_file?streamId=${streamId}`), {
    method: 'POST',
    body: data,
    headers: postHeaders,
  });
};
