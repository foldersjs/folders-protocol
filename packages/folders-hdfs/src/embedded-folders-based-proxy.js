import p from "path";
import mime from "mime";
import { promisify } from "util";

const convertFolderMetadataToHdfs = (data) => {
  // TODO
  return {
    // accessTime : data.modificationTime,
    // blockSize : data.blockSize,
    // group : data.group,
    length: data.size,
    modificationTime: data.modificationTime,
    // owner : data.owner,
    pathSuffix: data.name,
    // permission : data.permission,
    replication: data.replication,
    type: data.extension === "+folder" ? "DIRECTORY" : "FILE",
  };
};

class FoldersStorageHandler {
  constructor(foldersBackend) {
    this.backend = foldersBackend;
  }

  storageHandler() {
    const backend = this.backend;

    return async (err, path, operation, params, req, res, next) => {
      if (err) {
        return next(err);
      }

      try {
        switch (operation) {
          case "mkdirs":
            return next(new Error("Not supported yet"));

          case "append":
          case "create": {
            const writeAsync = promisify(backend.write).bind(backend);
            const data = await writeAsync(path, req);
            const result = JSON.stringify({ success: true });
            res.writeHead(200, {
              "content-length": result.length,
              "content-type": "application/json",
            });
            res.end(result);
            return next();
          }

          case "open": {
            const catAsync = promisify(backend.cat).bind(backend);
            let catParam = path;
            if (backend.features && backend.features.range_cat) {
              catParam = {
                path: path,
                offset: params.offset,
                length: params.length,
              };
            }
            const data = await catAsync(catParam);
            data.stream.pipe(res);
            break;
          }
          case "getfilestatus": {
            const lsAsync = promisify(backend.ls).bind(backend);
            const data = await lsAsync(path);

            if (!data || data.length === 0) {
              return next(new Error("file not exist"));
            }

            const file = convertFolderMetadataToHdfs(data[0]);
            const result = JSON.stringify({ FileStatus: file });

            res.writeHead(200, {
              "content-length": result.length,
              "content-type": "application/json",
            });
            res.end(result);
            return next();
          }

          case "liststatus": {
            const lsAsync = promisify(backend.ls).bind(backend);
            const data = await lsAsync(path);
            const files = data.map(convertFolderMetadataToHdfs);
            const result = JSON.stringify({
              FileStatuses: { FileStatus: files },
            });

            res.writeHead(200, {
              "content-length": result.length,
              "content-type": "application/json",
            });
            res.end(result);
            return next();
          }

          case "delete": {
            const unlinkAsync = promisify(backend.unlink).bind(backend);
            await unlinkAsync(path);
            const result = JSON.stringify({ success: true });
            res.writeHead(200, {
              "content-length": result.length,
              "content-type": "application/json",
            });
            res.end(result);
            return next();
          }

          case "rename":
          case "setpermission":
          case "setowner":
          case "createsymlink":
          default:
            return next(new Error("not support yet"));
        }
      } catch (e) {
        return next(e);
      }
    };
  }
}

export default FoldersStorageHandler;
