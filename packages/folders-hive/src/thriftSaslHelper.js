const STATUS_BYTES = 1;
const PAYLOAD_LENGTH_BYTES = 4;

const NegotiationStatus = {
  START: 0x01,
  OK: 0x02,
  BAD: 0x03,
  ERROR: 0x04,
  COMPLETE: 0x05,
};

const bufferify = function (val) {
  return Buffer.isBuffer(val) ? val : Buffer.from(val);
};

const wrapSaslMessage = function (status, payload) {
  if (!payload) payload = '';
  payload = bufferify(payload);

  const message = Buffer.alloc(STATUS_BYTES + PAYLOAD_LENGTH_BYTES + payload.length);
  message[0] = status;
  message.writeInt32BE(payload.length, STATUS_BYTES);
  payload.copy(message, STATUS_BYTES + PAYLOAD_LENGTH_BYTES);
  return message;
};

let responseBuffer = Buffer.alloc(0);

const appendToBuffer = function (dataBuf) {
  const old = responseBuffer;
  responseBuffer = Buffer.alloc(old.length + dataBuf.length);
  old.copy(responseBuffer, 0);
  dataBuf.copy(responseBuffer, old.length);
  return responseBuffer;
};

const parseSaslMessage = function (dataBuf) {
  dataBuf = bufferify(dataBuf);

  if (dataBuf.length < STATUS_BYTES + PAYLOAD_LENGTH_BYTES) {
    return false;
  }

  const status = dataBuf.readUInt8(0);
  const payloadLength = dataBuf.readUInt32BE(STATUS_BYTES);

  if (dataBuf.length < STATUS_BYTES + PAYLOAD_LENGTH_BYTES + payloadLength) {
    return false;
  }

  const payload = dataBuf.slice(STATUS_BYTES + PAYLOAD_LENGTH_BYTES);

  if (status == NegotiationStatus.BAD || status == NegotiationStatus.ERROR) {
    console.error('Peer indicated failure: ', payload.toString());
  }

  responseBuffer = responseBuffer.slice(STATUS_BYTES + PAYLOAD_LENGTH_BYTES + payloadLength);

  return {
    status: status,
    payload: payload,
  };
};

const saslPlainHandleShake = function (connection, options, cb) {
  const dataListeners = connection.listeners('data');
  connection.removeAllListeners('data');

  const callback = function (error) {
    for (let i = 0; i < dataListeners.length; i++) {
      connection.addListener('data', dataListeners[i]);
    }
    cb(error);
  };

  const authRspListener = function (dataBuf) {
    let response = parseSaslMessage(appendToBuffer(dataBuf));
    while (response) {
      if (response.status == NegotiationStatus.OK) {
        // FIXME not expected OK in PLAIN sasl
      } else if (response.status == NegotiationStatus.COMPLETE) {
        console.log('[ThriftSaslHelper] COMPLETE message received, PLAIN SASL handshaked success');
        connection.removeListener('data', authRspListener);
        callback(null);
      } else {
        console.error('error status code, ', response.status, response.payload.toString());
        connection.removeListener('data', authRspListener);
        callback(response.payload.toString());
      }
      response = parseSaslMessage(responseBuffer);
    }
  };

  connection.on('data', authRspListener);

  console.log('[ThriftSaslHelper] send START Message,');
  connection.write(wrapSaslMessage(NegotiationStatus.START, 'PLAIN'));

  const authStr = '\0' + options.username + '\0' + options.password;
  console.log('[ThriftSaslHelper] send PLAIN SASL auth Message,');
  connection.write(wrapSaslMessage(NegotiationStatus.COMPLETE, authStr));
};

export default {
  saslPlainHandleShake,
};
