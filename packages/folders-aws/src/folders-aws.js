import path from "path";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const FoldersAwsOptions = z.object({
  connectionString: z.string(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  endpoint: z.string().optional(),
  region: z.string().optional(),
});

class FoldersAws {
  constructor(prefix, options) {
    this.options = FoldersAwsOptions.parse(options || {});
    this.prefix = prefix;
    this.client = null;
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    unlink: true,
    rmdir: true,
    mkdir: true,
    server: false,
  };

  prepare() {
    if (this.client) {
      return;
    }
    const config = {
      region: this.options.region || "us-east-1",
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
          type: "application/octet-stream",
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
  async unlink(filePath) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;

    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });
      await this.client.send(command);
    } catch (error) {
      throw error;
    }
  }

  async rmdir(filePath) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;
    if (!filePath.endsWith("/")) {
      filePath += "/";
    }

    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: filePath,
      });
      const listResponse = await this.client.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key })),
          },
        });
        await this.client.send(deleteCommand);
      }
    } catch (error) {
      throw error;
    }
  }

  async mkdir(filePath) {
    this.prepare();
    const url = new URL(this.options.connectionString);
    const bucket = url.hostname;
    if (!filePath.endsWith("/")) {
      filePath += "/";
    }

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: filePath,
        Body: "",
      });
      await this.client.send(command);
    } catch (error) {
      throw error;
    }
  }
}

export default FoldersAws;
