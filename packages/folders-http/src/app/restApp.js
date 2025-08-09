/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * This is a proxy to assist with debugging.
 * It forwards requests for basic API services to a remote endpoint.
 * It will also act as a server, in the absence of an endpoint.
 *
 */


export default function(conn,requestId,shareid) {
  var uri = conn.location.pathname;

  if(uri.substr(0,5) === "/dir/") {
    var shareId = uri.substr(5);
    var path = "/";
    var idxPath = shareId.indexOf("/");
    if(idxPath != -1) {
      path = shareId.substr(idxPath);
      shareId = shareId.substr(0,idxPath);
    }
    if ((shareid != 'testshareid'  && shareid ) || shareId=='' ){

      shareId = shareid;

    }
    var DirectoryListRequest = {
      "type": "DirectoryListRequest",
      "data": {
        "shareId": shareId,
        "streamId": requestId,
        "serverHostname": "testHostname",
        "path": path
      }
    };
    console.log("Requested URI", uri, DirectoryListRequest);
    return DirectoryListRequest;
  }


  if (uri.substr(0,6) == '/file/'){

    shareId = shareid;

    var FileRequest ={
      "type" : "FileRequest",
      "data" :{
       "shareId" :shareId,
       "streamId":requestId,
       "fileId":'testfileid',
       "browserFileId":"testid",
       "serverHostname" :"testserverhostname",
       "clientHostname":"testclienthostname",
       "ip":"testip",
       "offset":"testoffset",
       "length":"testlength",
       "offer":"testoffer",
      }

    }

    console.log("Requested URI", uri, FileRequest);
    return FileRequest;

  }

  if(uri === "/set_files") {
    var SetFilesRequest = {
      "type": "SetFilesRequest",
      "streamId" : requestId,
      "data": {
        "shareId":"",
        "allowOfflineStorage":"true",
        "allowUploads":"false",
        "parent":"0",
        "data":[]
      }
    };
    console.log("Requested URI", uri, SetFilesRequest);
    return SetFilesRequest;
  }

  if (uri === '/get_share'){
    var x = {
      "shareId":"testshareid",
      "offline":"0",
      "parent":"0",
      "gw":"0",
      "_":"1429695010939"
    }
    console.log("Requested URI", uri,x);
    return x;
  }

  console.log("Requested URI", uri);
};
