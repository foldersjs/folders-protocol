/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * "http" is a special provider, as it provides event routing
 * (via that route.js implementation and the /json endpoint).
 *
 */

// we can also use fio channels to recieve messages
var route = require('./route');

var FoldersHttp = function (options) {

    var self = this;
	options = options || {};

	// FIXME:Host should be passed to route.js for creating connections

	var host = options.host;
	var cb = options.cb ;

	this.provider = options.provider ;

	if (!this.provider){

		console.log("!Error : no backend provided.");
		return ;

	}


    var onReady = function (result) {


        //console.log(result);

    };

    var onMessage = function (message) {


        if (message.type = 'DirectoryListRequest') {

            ls(self,message.data,cb);

        } else if (message.type = 'FileRequest') {

            cat(self,message.data,cb);

        }

	var onClose = function(){

		//TODO: implement clean up

	}


    };


    var stream = route.open('', function (result) {

        var session = {};
        session.token = result.token;
        session.shareId = result.shareId;
        self.session = session;

        route.watch('', session, onReady, onMessage);

    });


};

/*
 * The cb is to  expose the err of
 * 'ls' operation
 *
 */

var ls = function (o,data,cb) {



    var self = o,
        headers = {}
    var path = data.path;
    var streamId = data.streamId;
    self.provider.ls(path, function (err,result) {

		if(err){
			console.log(err);
			return cb(err);

		}


		// this is working
        route.post(streamId, JSON.stringify(result), headers, self.session.shareId);



    });


};

/*
 * The cb is to  expose the err of
 * 'cat' operation
 *
 */

var cat = function (o,data,cb) {

    var self = o;
    var path = data.path,
        headers = {};
    var streamId = data.streamId;

    self.provider.cat(path, function (err,result) {

		if(err){
			console.log(err);
			return cb(err);

		}

		headers['Content-Length'] = result.size;
        route.post(streamId, result.stream, headers, self.session.shareId);
		cb(result);

    });


};


module.exports = FoldersHttp;