/*
 *
 * Provide translation layers and compatibility for the popular gulpjs ecosystem.
 *
 */

var path = require('path');
var Vinyl = require('vinyl');
var folders = new require('folders');

var cat = function() {};
cat.prototype.to = function(blobStream, base) {
// Headers ain't so nice!
        var headers = {};
	var headerMap = blobStream.headers;
        if(headerMap) for(var i = 0; i < headerMap.length; i++) {
                var x = headerMap[i].split(':',2);
                headers[x[0]] = x[1];
        }
	var size = headers['X-File-Size'];
	var name = headers['X-File-Name'];
	var stream = blobStream.data;
	if(typeof(stream) == "string") stream = new Buffer(stream);
	var output = new Vinyl({
		stat: { size: size },
		cwd: "/",
		base: "/",
		path: "/" + name,
		contents: stream,
	});
	return output;
};

cat.prototype.from = function(vinylObj) {
	var result = vinylObj.stat;
	var name = path.basename(vinylObj.path);
	var data = vinylObj.contents;
	var headers = {
		"Content-Length": result.size,
		"Content-Type": "application/octet-stream",
		"X-File-Type": "application/octet-stream",
		"X-File-Size": result.size,
		"X-File-Name": name
	};
	var output = {
		data: data,
		headers: headers
	};
	return output;
};

var ls = function (){};
ls.prototype.to = function(listObj) {
	var size = listObj.size;
	var mtime = new Date(parseFloat(listObj.modificationTime));
	var stream = Buffer(JSON.stringify(listObj));
	var base = listObj.uri; // NOTES: May want to clean up this path.
	var output = new Vinyl({
		stat: { size: size, mtime: mtime },
		cwd: "/",
		base: path.dirname(base),
		path: base,
		contents: stream,
	});
	return output;
};
ls.prototype.from = function(vinlyObj) {
	var modificationTime = vinlyObj.stat.mtime.getTime() + "";
	var name = path.basename(vinlyObj.path);
	var size = vinlyObj.stat.size;
	var uri = vinlyObj.base + "/" + name;
	var output = {
		"name": name,
		"uri": uri,
		"modificationTime": modificationTime,
		"fullPath": "/" + name,
		"size": size,
		"extension": "txt",
		"type":"text/plain"
	};
	return output;
};

// "stub-file.txt",
(new (folders.stub())).cat({data: { streamId: "Test" }, "shareId": "Test" },
function(data) {
	var v = new cat();
	transformed = v.from(v.to(data));
	console.log("yes", data, transformed);
});

(new (folders.stub())).ls(".",
function(data) {
	var v = new ls();
	for(var i = 0; i < data.length; i++) {
		transformed = v.from(v.to(data[i]));
		console.log("yes", data, transformed);
	}
});

var stream = require('stream');
var util = require('util');

// Gulp pipe to fio
var Write = function(opt) {
	opt = opt || {};
	opt.objectMode = true;
	stream.Writable.call(this, opt);
}; util.inherits(Write, stream.Writable);

Write.prototype._write = function(chunk, encoding, callback) {
	console.log("chunk", chunk);
	return;
	var v = new cat();
	console.log("fio", v.from(chunk));

	v = new ls();
	console.log("fls", v.from(chunk));

	callback();
	return true;
}

var gulp = require('gulp')
var write = new Write();
gulp.src('tmp/*.txt', {
	read: false,
	buffer: false
}).pipe(write)

// Fio pipe to gulp
var Read = function(opt) {
	opt = opt || {};
	opt.objectMode = true;
	stream.Readable.call(this, opt);
	this.listing = false;
}; util.inherits(Read, stream.Readable);

Read.prototype._read = function(size) {
	var self = this;
	if(this.listing == false) {
		if(0)
		(new (folders.stub())).cat({data: { streamId: "Test" }, "shareId": "Test" },
		function(data) {
			var v = new cat();
			self.push(v.to(data));
			self.waiting = false;
		});

		(new (folders.stub())).ls(".",
		function(data) {
			var v = new ls();
			for(var i = 0; i < data.length; i++) {
				self.push(v.to(data[i]));
			}
			self.waiting = false;
		});
		this.listing = true;
		this.waiting = true;
	}
	else {
		if(this.waiting != true)
		this.push();
	}
}

var read = new Read();
read.pipe(write);
