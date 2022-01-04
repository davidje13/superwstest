function remove(list, item) {
  const p = list.indexOf(item);
  if (p !== -1) {
    list.splice(p, 1);
  }
}

export default class BlockingQueue {
  constructor() {
    this.pendingPush = [];
    this.pendingPop = [];
  }

  push(o) {
    if (this.pendingPop.length) {
      const i = this.pendingPop.shift();
      clearTimeout(i.tm);
      i.resolve(o);
    } else {
      this.pendingPush.push(o);
    }
  }

  pop(timeout) {
    if (this.pendingPush.length) {
      return Promise.resolve(this.pendingPush.shift());
    }
    return new Promise((resolve, reject) => {
      const i = { resolve, tm: null };
      this.pendingPop.push(i);
      if (timeout !== undefined) {
        i.tm = setTimeout(() => {
          remove(this.pendingPop, i);
          reject(new Error(`Timeout after ${timeout}ms`));
        }, timeout);
      }
    });
  }
}
