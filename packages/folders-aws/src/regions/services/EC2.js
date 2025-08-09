import path from 'path';
import { Readable } from 'stream';

let ec2;

class ObjectReader extends Readable {
  constructor(data) {
    const options = {
      objectMode: true,
    };
    super(options);
    this.data = data;
  }

  _read() {
    this.push(this.data);
    this.push(null);
  }
}

class EC2 {
  constructor(service, options) {
    ec2 = service;
    this.configure(options);
  }

  configure() {}

  ls(path, cb) {
    const params = {
      InstanceIds: [path],
    };

    ec2.describeInstanceStatus(params, function (err, data) {
      if (err) {
        console.log(err, err.stack);
        return cb(err, null);
      } else {
        console.log(data);
        cb(null, data);
      }
    });
  }

  cat(path, cb) {
    const params = {
      InstanceIds: [path],
    };

    ec2.describeInstanceStatus(params, function (err, data) {
      if (err) {
        console.log(err, err.stack);
        return cb(err, null);
      } else {
        const stream = new ObjectReader(data);
        cb(null, {
          stream: stream,
        });
      }
    });
  }

  write() {
    //implement service specific method
  }
}

export default EC2;
