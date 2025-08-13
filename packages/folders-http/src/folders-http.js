import { z } from "zod";
import * as defaultRoute from "./route.js";
import util from "util";
import { createNaclTransforms } from "./impl.js";
import { Readable } from "stream";

const OptionsSchema = z.object({
  provider: z.any(),
  host: z.string().optional(),
  route: z.any().optional(),
});

class FoldersHttp {
  constructor(options) {
    const validatedOptions = OptionsSchema.parse(options);
    this.provider = validatedOptions.provider;
    this.route = validatedOptions.route || defaultRoute;
    this.session = null;
    this.encryptor = null;
    this.decryptor = null;

    if (!this.provider) {
      throw new Error("No backend provider specified.");
    }
  }

  async start() {
    this.session = await this.route.open("");
    const { encryptor, decryptor } = createNaclTransforms();
    this.encryptor = encryptor;
    this.decryptor = decryptor;
    await this.route.watch(this.session, (message) => this.onMessage(message));
  }

  async onMessage(message) {
    try {
      if (message.type === "DirectoryListRequest") {
        await this.ls(message.data);
      } else if (message.type === "FileRequest") {
        await this.cat(message.data);
      }
    } catch (error) {
      // TODO: Post error message back to the route
      console.error("Error processing message:", error);
    }
  }

  async ls(data) {
    const { path, streamId } = data;
    const lsAsync = util.promisify(this.provider.ls).bind(this.provider);
    const result = await lsAsync(path);
    const resultStream = new Readable();
    resultStream.push(JSON.stringify(result));
    resultStream.push(null);
    await this.route.post(
      streamId,
      resultStream,
      {},
      this.session,
      this.encryptor,
    );
  }

  async cat(data) {
    const { path, streamId } = data;
    const catAsync = util.promisify(this.provider.cat).bind(this.provider);
    const result = await catAsync(path);
    const headers = {
      "Content-Length": result.size, // This will be incorrect after encryption.
    };
    await this.route.post(
      streamId,
      result.stream,
      headers,
      this.session,
      this.encryptor,
    );
  }
}

export default FoldersHttp;
