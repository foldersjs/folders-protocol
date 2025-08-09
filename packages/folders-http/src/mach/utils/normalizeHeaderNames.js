import IrregularHeaderNames from './IrregularHeaderNames.js';

/**
 * Normalizes HTTP header names according to RFC 2616.
 */
function normalizeHeaderName(headerName) {
  headerName = headerName.toLowerCase();

  if (headerName in IrregularHeaderNames)
    return IrregularHeaderNames[headerName];

  return headerName.replace(/(^|-)([a-z])/g, function (match, dash, letter) {
    return dash + letter.toUpperCase();
  });
}

export default normalizeHeaderName;