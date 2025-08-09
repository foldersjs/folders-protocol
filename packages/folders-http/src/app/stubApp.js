/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * This is a proxy to assist with debugging.
 * It forwards requests for basic API services to a remote endpoint.
 * It will also act as a server, in the absence of an endpoint.
 *
 */

/*
 *
 * FIXME: This may be more appropriate in the test folder.
 *
 */

export const getStubGetShare = function(){

	var stubShare;
	 // test Stub
	stubShare = {
		"canUploadFiles":false,
		"shareId":"ddcb096a-2e02-4173-aece-6bed27cb01fa",
		"passwordRestricted":false,
		"shareGateway":"0",
		"success":true,
		"shareName":"GyB4Nd"
		};

	// Extended set: static fileTree; client defined shareId/shareName.
	if(0)
        stubShare = {
          "gateway_id":"0",
          "isProtected":false,
          "success":true,
          "onlyEmptyDirs":false,
          "fileTree":[{
          "d":false,
          "s":74098,
          "c":null,
          "fi":1,
          "p":"",
          "n":"image1.jpg",
          "o":false,
          "l":"2015-02-12T13:08:06.000Z",
          "dbid":"90cf2ce2-4238-43a3-a161-589c3bae7f38"}],
          "online":true,
          "uploadPermission":false,
          "allowOfflineStorage":"true"
        }
		return stubShare;

};

export const getStubSetFiles = function(){


	//Test Stub
    var stubShare ={
          "shareId":"testshareid",
          "success":true,
          "shareName":"testShare"
    };
	return stubShare;

};

export const getStubJson = function(){

	//eventFriendly(request, response);
    var stubShare = {"success":true,"signals":[{"data":{},"type":"KeepAlive"}]};
	return stubShare;

};


export const getStubSignalPoll = function(){


	//eventFriendly(request, response);
    var stubShare = {"success":true,"signals":[{"data":{},"type":"KeepAlive"}]};
	return stubShare;

};

export const getStubSession = function(res){

	 var stubShare = {
		"users":[{
			"availableStorage":2146702817,
			"availableBandwidth":10736637409,
			"plan":"REGISTERED",
			"email":"test@gmail.com",
			"userName":"testuser",
			"fullName":"testuser testuser"
		}],
		"success":true,
		"mainUser":"testuser"
	 };
	 return stubShare;

};

function dummyStream(){

	// provide a dummy stream here
	return 'some_stream' ;

};

export const getStubFile = function(backend){

	if(backend){
		return function() {
			return new Promise(function(done, fail) {
				backend.cat("stub-file.txt", function(result, err) {
					if(err) {

						return fail(err);
					}
					var headers = {};
					headers['X-File-Name'] = result.name;
					headers['X-File-Size'] = result.size;
					headers['Content-Length'] = result.size;
					var response = {
						headers: headers,
						content: result.stream,
						status: 200
					};
					done(response);
				});
			});
		}
	};

	var headers = {};
	headers['X-File-Name'] = 'stubfile.txt';
	headers['X-File-Size'] = 1024;
	headers['Content-Length'] = 1024;
	var stubShare = {
		headers: headers,
		content: dummyStream(),
		status: 200
	};

	return stubShare;


};

export const getStubDir = function(backend){

	var stubShare ;
	if(backend) {
		stubShare = function(cb) {
			backend.ls('.', cb);
		};
	}
	else
	{
		stubShare =[{
            "name":"local",
            "fullPath":"/local",
            "meta":{},
            "uri":"#/http_folders.io_0:union/local",
            "size":0,
            "extension":"+folder",
            "type":""
          },
			{
            "name":"text.txt",
            "fullPath":"/test.txt",
            "meta":{},
            "uri":"#/http_folders.io_0:union/test.txt",
            "size":100,
            "extension":"txt",
            "type":"text/plain"
			}
		]
	}
	return stubShare;
};

export const getStubDefault = function(){

	var stubShare = {"insert":"here"};
	return stubShare;
};