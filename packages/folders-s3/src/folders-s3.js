import path from "path";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import Server from "./embedded-s3-server.js";

const FoldersS3Options = z.object({
  connectionString: z.string(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  endpoint: z.string().optional(),
  silent: z.boolean().optional(),
  directory: z.string().optional(),
  enableEmbeddedServer: z.boolean().optional(),
});

class FoldersS3 {
  constructor(prefix, options) {
    this.options = FoldersS3Options.parse(options || {});
    this.prefix = prefix;
    this.client = null;

    if (this.options.enableEmbeddedServer) {
      this.options.endpoint = this.options.endpoint || "http://localhost:4568";
      this.options.directory = this.options.directory || "./bucket";
      this.options.accessKeyId = this.options.accessKeyId || "S3RVER";
      this.options.secretAccessKey = this.options.secretAccessKey || "S3RVER";
      const serverOptions = {
        hostname: new URL(this.options.endpoint).hostname,
        port: new URL(this.options.endpoint).port,
        silent: this.options.silent,
        directory: this.options.directory,
      };
      this.server = new Server(serverOptions);
      this.server.start();
    }
  }

  async close() {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  prepare() {
    if (this.client) {
      return;
    }
    const config = {
      region: "us-east-1", // Default region
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
      },
      endpoint: this.options.endpoint,
    };
    this.client = new S3Client(config);
  }

  async ls(filePath) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;

    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: filePath,
        Delimiter: "/",
      });
      const response = await this.client.send(command);

      const files = (response.Contents || []).map((file) => {
        const name = path.basename(file.Key);
        return {
          name,
          fullPath: file.Key,
          meta: {},
          uri: file.Key,
          size: file.Size || 0,
          extension: path.extname(name).slice(1),
          type: "application/octet-stream", // Basic type, can be improved
        };
      });

      const folders = (response.CommonPrefixes || []).map((folder) => {
        const name = path.basename(folder.Prefix);
        return {
          name,
          fullPath: folder.Prefix,
          meta: {},
          uri: folder.Prefix,
          size: 0,
          extension: "+folder",
          type: "",
        };
      });

      return [...folders, ...files];
    } catch (error) {
      throw error;
    }
  }

  async cat(filePath) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });
      const response = await this.client.send(command);
      return {
        stream: response.Body,
        size: response.ContentLength,
        name: path.basename(filePath),
      };
    } catch (error) {
      throw error;
    }
  }

  async write(filePath, data) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: filePath,
        Body: data,
      });
      const response = await this.client.send(command);
      return {
        ETag: response.ETag,
        VersionId: response.VersionId,
      };
    } catch (error) {
      throw error;
    }
  }
}

export default FoldersS3;
