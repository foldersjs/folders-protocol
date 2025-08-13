/*
 *
 * Folders.io core routing, binding sessions to event streams and endpoints.
 *
 * This connects to a remote service requesting a new session and watches for events.
 *
 */
const prefix = "http://localhost:8080";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const endpoint = (key, path) => {
  // TODO: key is unused
  return `${prefix}${path}`;
};

import Handshake from "folders/src/handshake.js";

// Request a new session, getting a share ID and token.
export const open = async (baseUri, params, fetch = global.fetch) => {
  const response = await fetch(endpoint("", "/set_files"), {
    method: "POST",
    body: JSON.stringify({
      shareId: "",
      allowOfflineStorage: true,
      allowUploads: false,
      parent: 0,
      data: "[]",
    }),
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();

  return {
    endpoint: endpoint(data.shareName, `/g/${data.shareName}`),
    shareName: data.shareName,
    shareId: data.shareId,
    token: data.token,
    publicKey: data.publicKey,
  };
};

// Watch a pipe listening for commands/requests.
export const watch = async (session, onMessage, fetch = global.fetch) => {
  const { token, shareId } = session;

  const response = await fetch(endpoint(shareId, `/json?shareId=${shareId}`), {
    headers: {
      Cookie: token,
      Accept: "text/event-stream",
    },
  });

  const stream = response.body;

  stream.on("data", (chunk) => {
    const data = chunk.toString();
    const lines = data.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
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

  stream.on("end", () => {
    // console.log('stream closed');
  });
};

export const handshake = async (
  session,
  clientKeypair,
  fetch = global.fetch,
) => {
  const { shareId, publicKey: serverPublicKeyStr } = session;
  const serverPublicKey = Handshake.decodeHexString(serverPublicKeyStr);

  const handshake = Handshake.createHandshake(clientKeypair, {
    publicKey: serverPublicKey,
  });
  const token = handshake.handshake;

  const response = await fetch(
    endpoint(shareId, `/handshake?token=${token}`),
    {
      method: "GET",
    },
  );

  if (response.status !== 200) {
    throw new Error("Handshake failed");
  }
  return handshake.session;
};

// Send a buffered response to a watched request.
export const post = async (
  streamId,
  data,
  headers,
  session,
  transform,
  fetch = global.fetch,
) => {
  const postHeaders = { ...headers };
  postHeaders.Cookie = session.token;

  const body = transform ? data.pipe(transform) : data;

  await fetch(endpoint(streamId, `/upload_file?streamId=${streamId}`), {
    method: "POST",
    body: body,
    headers: postHeaders,
    duplex: "half",
  });
};
