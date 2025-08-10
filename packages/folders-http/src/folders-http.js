import { z } from 'zod';
import * as route from './route.js';
import util from 'util';

const OptionsSchema = z.object({
  provider: z.any(),
  host: z.string().optional(),
});

class FoldersHttp {
  constructor(options) {
    const validatedOptions = OptionsSchema.parse(options);
    this.provider = validatedOptions.provider;
    this.session = null;

    if (!this.provider) {
      throw new Error('No backend provider specified.');
    }

    this.start();
  }

  async start() {
    try {
      this.session = await route.open('');
      await route.watch(this.session, (message) => this.onMessage(message));
    } catch (error) {
      console.error('Error starting FoldersHttp:', error);
    }
  }

  async onMessage(message) {
    if (message.type === 'DirectoryListRequest') {
      await this.ls(message.data);
    } else if (message.type === 'FileRequest') {
      await this.cat(message.data);
    }
  }

  async ls(data) {
    const { path, streamId } = data;
    try {
      const lsAsync = util.promisify(this.provider.ls).bind(this.provider);
      const result = await lsAsync(path);
      await route.post(
        streamId,
        JSON.stringify(result),
        {},
        this.session
      );
    } catch (err) {
      console.error('Error in ls:', err);
      // Handle error, maybe post an error message back
    }
  }

  async cat(data) {
    const { path, streamId } = data;
    try {
      const catAsync = util.promisify(this.provider.cat).bind(this.provider);
      const result = await catAsync(path);
      const headers = {
        'Content-Length': result.size,
      };
      await route.post(
        streamId,
        result.stream,
        headers,
        this.session
      );
    } catch (err) {
      console.error('Error in cat:', err);
      // Handle error
    }
  }
}

export default FoldersHttp;
