/*
 *
 * Folders.io core routing, binding sessions to event streams and endpoints.
 *
 * This connects to a remote service requesting a new session and watches for events.
 *
 */

var stream = require('event-stream');
var outbound = require('request');


/*
 *
 * Sessions are identified by UUID and require a token to operate.
 * A session may also come with a short URL for easier access.
 *
 */
var session = {};
var endpoints = {};
var currentSession = null;

var prefix = "https://folders.io"; // "http://window.io";
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';


var endpoint = function(key, path) {
	console.log("outbound:"+key+"->" + path);
	return prefix + path;
};


// A "share" could also be considered a node, or a session; token is used for authorization.
var asShare = function(token, obj) {
	var event = {
		"endpoint": endpoint(obj.shareName, "/g/"+obj.shareName),
		"shareName": obj.shareName,
		"shareId": obj.shareId,
		"token": token
	};
	return event;
};
var mockShare = function() {
	return {
		shareName: "testShare",
		shareId: "testUUID"
	};
};

// Request a new session, getting a share ID and token.
exports.open = function(baseUri, cb, params) {
	var register = function(event) {
		var shareId = event.shareId;
		session[shareId] = event.token;
		endpoints[shareId] = event.shareName;
		currentSession = shareId;
		// Assume less, watch more.
		cb(event);
		// watch(shareId, cookie);
		return event;
	};

	// FIXME: Better code coverage.
	var mockToken = false;//  "testCookie";
	var input, output;
	if(mockToken) {
		input = stream.readArray([mockShare()]).pipe(stream.stringify());
		output = stream.mapSync(function(obj) {
			var event = asShare(mockToken, obj);
			return register(event);
		});
	}
	else {
		// Create a new endpoint.
		input = outbound.post(endpoint("", "/set_files"), {form:{
			shareId: "",
			allowOfflineStorage: true,
			allowUploads: false,
			parent: 0,
			data: "[]"}});
		output = stream.mapSync(function (obj) {
			var cookie = input.response.headers['set-cookie'][0];
			var event = asShare(cookie, obj);
			return register(event);
		});
	}
	return input.
		pipe(stream.split()).
		pipe(stream.parse()).
		pipe(output).
		pipe(stream.stringify()).
		pipe(stream.mapSync(function(str) {
			// cb(str);
		}));
};

// Watch a pipe listening for commands/requests.
exports.watch = function(baseUri, session, onReady, onMessage, onClose) {
	var cookie = session.token;
	var shareId = session.shareId;
	var r;

if(false) {
// Immediately mock a directory list request, only used to test flow.
	var mockDirectoryList = {"type": "DirectoryListRequest", "data": {"shareId": "testShareId", "streamId": "testStreamId", "serverHostname": "testHostname", "path": "/"}};
	r = stream.readArray(["data: " + JSON.stringify(mockDirectoryList) + "\n\n"]);
	if(onReady) onReady({headers: { "type": "Mocked request"}});
// Process injected messages; handled in setup, not here.
//	this.send = onMessage;
}

// EventSource.
	if(true) {
		// FIXME: data needs two \n\n to flush, has no re-connect semantics.
		r = (outbound(endpoint(shareId, "/json?shareId="+shareId), { headers: {
			Cookie: cookie,
			Accept: 'text/event-stream'
		}}));
		r.on('response', onReady);
	}

	r.pipe(stream.split()).pipe(stream.mapSync(function(str) {
		// if(str.substr(0,7) == 'event: ') return;
		if(str.length < 6) return;
		if(str.substr(0,6) != 'data: ') return;
		return str.substr(6);
	})).pipe(stream.parse()).pipe(stream.mapSync(function(obj) {
		onMessage(obj);
		// obj.shareId = shareId;
		// channel.publish(obj.type, obj);
		console.log("yep", obj);
		return obj.type;
	})).pipe(stream.through(function(data) {
		console.log("signal: " + data);
	}, /*end*/ function() {
		console.log("stream closed");
		console.log("not retrying");
		// FIXME: use backoff.
		if(false)
		setTimeout(function() {
			watch(shareId, cookie);
		}, 5000);
	}));
	return r;
};



// Resolve an existing endpoint.
var resolve = function(shareName, cb) {
	var r; (r = outbound.get(
			endpoint(shareName, "/get_share?shareName="+shareName))).
		pipe(stream.split()).
		pipe(stream.parse()).
		pipe(stream.mapSync(function(obj) {
			// assert(a.success === true);
			// assert(a.shareName == shareName)
			// (bool) canUploadFiles, (bool) passwordRestricted
			cb(obj.shareId, obj);
		}));
};

// Send a buffered response to a watched request.
var post = function(streamId, data, headerMap, tokenId) {
// console.log("post data");
	var headers = {};
	if(headerMap) for(var i = 0; i < headerMap.length; i++) {
		var x = headerMap[i].split(':',2);
		headers[x[0]] = x[1];
	}
	headers.Cookie = session[tokenId];
	var r; (r = outbound.post({
			"url": endpoint(streamId, "/upload_file?streamId="+streamId),
			body: data, headers: headers})).
	pipe(process.stdout);
};
