import parseQuery from "./parseQuery.js";

function parseCookie(cookie) {
  return parseQuery(cookie, { delimiter: /[;,] */ });
}

export default parseCookie;
