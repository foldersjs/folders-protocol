/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * This is a proxy to assist with debugging.
 * It forwards requests for basic API services to a remote endpoint.
 * It will also act as a server, in the absence of an endpoint.
 *
 */

// Favored utility libraries.
var outbound = require('request')
  , index = require('./util/watchfile') // Watch a file for changes to the local file, otherwise keep it in memory.
  , serveapp = require('./mach/utils/serveApp.js')
  , createConnection = require("./mach/utils/createConnection")
  , helpers    = require('./util/helpers')
  , stringifyCookie = require('./mach/utils/stringifyCookie')
  , Message = require('./mach/Message.js')
  , stringify = require('./mach/utils/stringifyQuery')

/*
 * main class and constructor
 *
 */
var ForwardingProxy = function(argv){

	//command line arguments are contained in argv object
	// FIXME : code will break if --forward=inavlidvalue example number
	argv               = argv || {}
	this.baseHost      = argv['forward'] || "https://folders.io"
	this.port          = argv['listen']  || 8090;
	this.shareId       = argv['shareid'] || '';
	this.currentToken  = argv['token']   || '';
	this.mode          = argv['mode']
	switch (this.mode){
		case 0:
		case 1:
		case 2:
		case 3:
			console.log(">> Proxy Server created In Mode : " + this.mode);
			break;
		default:
			console.log(">> Proxy Server created In Default Mode ");
	}

};


/*
 * This method starts
 * proxy in desired mode
 */
ForwardingProxy.prototype.startProxy = function() {

	 var self   = this;
	 self.routeServer = new RouteServer(self);
        // Load our trampoline, it's part of the proxy process.

	index("static/index.html", function(err, data) {
		if(err) {
			//cb(null, err);
			return;
		}
		console.log(">> index file read: " + data.length + " bytes");
		//this.routeHandler = routeHandler
	});

	serveapp(self.routeServer.simpleServer,{port:self.port});

};


ForwardingProxy.prototype.mode0Handler = function(conn,response){

	self = this

conn.request.setHeader('Cookie',this.currentToken)

if (conn.location.pathname === '/set_files'){
	helpers.objectifyPostData(conn.request.content).then(function(obj){

		/* new share*/
		if (obj.shareId == ''){
		}
		/*existing share*/
		else {

			var sizeIncrement = self.shareId.length - obj.shareId.length
			obj.shareId = self.shareId
			conn.request.setHeader('content-length',parseInt(conn.request.getHeader('content-length')) + sizeIncrement )

		}

		conn.request.content = stringify(obj)

		self.defaultModeHandler(conn,response);

	});

	return ;
}

else if (conn.location.pathname == '/get_share'){

		var obj = conn.location.query
		obj.shareId = self.shareId
		conn.location.query = obj
}

else if (conn.location.pathname.indexOf('/dir/') > -1){

	   conn.location.pathname = '/dir/' + self.shareId

}

self.defaultModeHandler(conn,response);

}




ForwardingProxy.prototype.mode1Handler = function(conn,response){
	self = this



	if (self.currentToken == ''){
		var t = function(o,message){



			if(message.getHeader('set-cookie')){




				self.currentToken = message.getHeader('set-cookie')[0].toString().split(';')[0]

			}


		}



		self.defaultModeHandler(conn,response,t)
	}

	else{

	conn.request.setHeader('Cookie',self.currentToken)
		self.defaultModeHandler(conn,response)
	}


}



ForwardingProxy.prototype.mode2Handler = function(conn,response){
	self = this

	if (!self.sessions) self.sessions = {}


	if (conn.location.pathname === '/set_files'){

		helpers.objectifyPostData(conn.request.content).then(function(obj){
		if (obj.shareId == ''){

			var t = function(o,message){

				if (o.shareId){
				if (message.getHeader('set-cookie')){

					self.sessions[o.shareId] =  message.getHeader('set-cookie')[0].toString().split(';')[0]
					console.log(">> " + o.shareId + " ---> "+ self.sessions[o.shareId])
				}

			}

			}

		}
		else{
			conn.request.setHeader('Cookie',self.sessions[obj.shareId])

		}
		conn.request.content = stringify(obj)
		self.defaultModeHandler(conn,response,t)
	})

	return ;

	}
	self.defaultModeHandler(conn,response)


}


 ForwardingProxy.prototype.mode3Handler = function(conn,response){
	self = this
	var token ;
	var options = helpers.requestObject(conn.request.headers,conn.location.path,conn.method)

	if (!self.sessions) {
		self.sessions = {}
	    conn.request.content.pipe(outbound(options)).on('response',function(result){
		token = stringifyCookie('FIOSESSIONID',{'size':32,'Domain':'.folders.io','Path':'/'})
		if (result.headers['set-cookie']){
			self.sessions[token] = result.headers['set-cookie']
			delete result.headers['set-cookie']

		}
		else{
			self.sessions[token] = stringifyCookie('FIOSESSIONID',{'value': conn.request.cookies['FIOSESSIONID'],'Domain':'.folders.io','Path':'/'})
		}
		response.setHeader('Set-Cookie',token);

	}).pipe(response)
	}
	else {
		token = stringifyCookie('FIOSESSIONID',{'value': conn.request.cookies['FIOSESSIONID'],'Domain':'.folders.io','Path':'/'})
		conn.request.setHeader('cookie',self.sessions[token])
		self.defaultModeHandler(conn,response)

	}

 }

ForwardingProxy.prototype.defaultModeHandler = function(conn,response,t){

	var options = helpers.requestObject(conn.request.headers,conn.location.path,conn.method)
	conn.request.content.pipe(outbound(options).on('response',function(result){

		if (t){
		message = new Message(result,result.headers)

		message.parseContent().then(function(obj){

			t(obj,message)

		})}

	})).pipe(response)

}

/*
 *
 */
var defaultFriendly = function(request, response) {
	index(__dirname + '\\static\\index.html', function(err, data) {
		response.setHeader("Content-Type", "text/html");
		response.writeHead(200);
		response.end(data);
	});
};

var RouteServer   = function(proxy) {

	console.log( ">> forwarding to "  + proxy.baseHost);

	this.simpleServer = function(nodeRequest,response) {
		// Allow a CORS
		helpers.corsFriendly(response);

		var conn = createConnection(nodeRequest);

		conn.request.setHeader('Host','folders.io')

		if(conn.method == "OPTIONS") {
			response.end();
			return;
		}


	// URL to Action:
	if(conn.method == "GET" || conn.method == "POST") {
		var uri = conn.location.path;
		console.log( ">> forwarding " + uri+" ---> " + proxy.baseHost+uri );

		switch (proxy.mode){
			case 0:
				 proxy.mode0Handler(conn,response);
				 break;
			case 1:
				 proxy.mode1Handler(conn,response);
				break;
			case 2:
				 proxy.mode2Handler(conn,response);
				 break;
			case 3:
				 proxy.mode3Handler(conn,response);
				 break;
			default:
				 proxy.defaultModeHandler(conn,response);
		}
                return;
	}
	defaultFriendly(request, response);
	};

};


module.exports = ForwardingProxy