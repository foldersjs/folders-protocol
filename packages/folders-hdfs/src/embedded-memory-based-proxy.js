import p from "path";
import mime from "mime";

const storage = {};

const getMetadata = (data) => {
  // remove the buf data and other data
  return {
    accessTime: data.accessTime,
    blockSize: data.blockSize,
    group: data.group,
    length: data.length,
    modificationTime: data.modificationTime,
    owner: data.owner,
    pathSuffix: data.pathSuffix,
    permission: data.permission,
    replication: data.replication,
    type: data.type,
  };
};

// write a memory based hdfs proxy, data stored in Buffer.
const memoryStorageHandler = function (
  err,
  path,
  operation,
  params,
  req,
  res,
  next,
) {
  // Forward error
  if (err) {
    return next(err);
  }

  const sendJson = (data) => {
    const body = JSON.stringify(data);
    res.writeHead(200, {
      "content-length": body.length,
      "content-type": "application/json",
    });
    res.end(body);
    next();
  };

  switch (operation) {
    case "mkdirs":
      if (storage.hasOwnProperty(path)) {
        return next(new Error("File already exists"));
      }

      storage[path] = {
        accessTime: new Date().getTime(),
        blockSize: 0,
        group: "supergroup",
        length: 0,
        modificationTime: new Date().getTime(),
        owner: params["user.name"],
        pathSuffix: "",
        permission: "755",
        replication: 1,
        type: "DIRECTORY",
      };
      return sendJson({ boolean: true });

    case "append":
    case "create": {
      let overwrite = true;
      const exists = storage.hasOwnProperty(path);
      const append = operation === "append";

      if (params.hasOwnProperty("overwrite") && !params.overwrite) {
        overwrite = false;
      }

      if (!append && !overwrite && exists) {
        return next(new Error("File already exists"));
      }

      if (!exists) {
        storage[path] = {
          accessTime: new Date().getTime(),
          blockSize: 0,
          group: "supergroup",
          length: 0,
          modificationTime: new Date().getTime(),
          owner: params["user.name"],
          pathSuffix: "",
          permission: "644",
          replication: 1,
          type: "FILE",
          data: Buffer.from([]),
        };
      }

      const bufList = [];
      if (append && storage[path].data.length > 0) {
        bufList.push(storage[path].data);
      }

      req.on("data", (data) => {
        bufList.push(Buffer.from(data));
      });

      req.on("end", () => {
        storage[path].data = Buffer.concat(bufList);
        storage[path].pathSuffix = p.basename(path);
        storage[path].length = storage[path].data.length;
        return next();
      });

      req.resume();
      break;
    }
    case "open": {
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      let buf = storage[path].data;
      if (params.offset && params.length) {
        buf = buf.slice(params.offset, params.offset + params.length);
      }

      res.writeHead(200, {
        "content-length": buf.length,
        "content-type": "application/octet-stream",
      });

      res.end(buf);

      return next();
    }
    case "liststatus": {
      const files = [];
      for (const key in storage) {
        if (key !== path && p.dirname(key) === path) {
          files.push(getMetadata(storage[key]));
        }
      }

      return sendJson({ FileStatuses: { FileStatus: files } });
    }
    case "getfilestatus": {
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      return sendJson({ FileStatus: getMetadata(storage[path]) });
    }
    case "rename":
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      if (storage.hasOwnProperty(params.destination)) {
        return next(new Error("Destination path exist"));
      }

      storage[params.destination] = storage[path];
      delete storage[path];

      return sendJson({ boolean: true });

    case "setpermission":
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      storage[path].permission = params.permission;
      return next();

    case "setowner":
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      storage[path].owner = params.owner;
      storage[path].group = params.group;
      return next();

    case "createsymlink":
      if (!storage.hasOwnProperty(path)) {
        return next(new Error("File doesn't exist"));
      }

      if (storage.hasOwnProperty(params.destination)) {
        return next(new Error("Destination path exist"));
      }

      storage[params.destination] = storage[path];
      return next();

    case "delete": {
      let deleted = false;
      if (params.hasOwnProperty("recursive") && params.recursive) {
        for (const key in storage) {
          if (key.startsWith(path + "/")) {
            delete storage[key];
            deleted = true;
          }
        }
      }

      if (storage.hasOwnProperty(path)) {
        delete storage[path];
        deleted = true;
      }

      if (!deleted) {
        return next(new Error("File doesn't exist"));
      }

      return sendJson({ boolean: true });
    }
    default:
      return next();
  }
};

memoryStorageHandler.clear = () => {
  for (const key in storage) {
    delete storage[key];
  }
};

export default memoryStorageHandler;
