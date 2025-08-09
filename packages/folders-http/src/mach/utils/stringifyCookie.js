/**
 * Creates a cookie string using the given options, which may be any of
 * the following:
 *
 * - value
 * - Domain
 * - Path
 * - expires
 * - secure
 * - httpOnly or HttpOnly
 * - size
 */

function stringifyCookie(name, options) {
  options = options || {};

  if (typeof options === 'string')
    options = { value: options };

  var cookie = encodeURIComponent(name) + '=' + encodeURIComponent(options.value || getRandomCookie(options.size));

  if (options.Domain)
    cookie += '; Domain=' + options.Domain;

  if (options.Path)
    cookie += '; Path=' + options.Path;

  if (options.expires)
    cookie += '; expires=' + (options.expires instanceof Date) ? options.expires.toUTCString() : options.expires;

  if (options.secure)
    cookie += '; secure';

  if (options.httpOnly || options.HttpOnly)
    cookie += '; HttpOnly';
  return cookie;
}

var getRandomCookie = function(maxLength){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for( var i=0; i < maxLength; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
	return text;
 };


 module.exports = stringifyCookie;
