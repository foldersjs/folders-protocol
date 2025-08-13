function serializer() {
  const stack = [];
  const keys = [];

  return function (key, value) {
    if (stack.length > 0) {
      const thisPos = stack.indexOf(this);
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
    } else {
      stack.push(value);
    }

    return value;
  };
}

export default function (obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(), spaces);
}
