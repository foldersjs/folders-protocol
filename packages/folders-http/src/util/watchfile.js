import fs from "fs";

// Basic util.
// Watch a file for changes to the local file, otherwise keep it in memory.
var cache = {};
var index = function (fileName, cb) {
  if (fileName in cache) {
    cb(null, cache[fileName]);
    return;
  }
  var loading = fileName + ".lock";
  var waiting = fileName + ".wait";
  if (waiting in cache) {
    cache[waiting].push(cb);
    return;
  }
  cache[waiting] = [cb];
  var onchange = function (evt, extra) {
    if (!(fileName in cache)) return;
    cache[loading].close();
    delete cache[fileName];
    delete cache[loading];
  };
  var onload = function (err, data) {
    cache[fileName] = data;
    var queue = cache[waiting];
    for (var i = 0, x = queue.length; i < x; i++) {
      queue[i](err, data);
    }
    delete cache[waiting];
    if (!cache[loading]) {
      cache[loading] = fs.watch(fileName, onchange);
    }
  };
  try {
    fs.readFile(fileName, onload);
  } catch (e) {
    console.log("oh", e);
  }
};

export default index;
