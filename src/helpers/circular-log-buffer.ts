export class CircularLogBuffer<T> {
  public readonly storage: T[];
  public readonly capacity: number;
  public head: number = 0;
  public tail: number = 0;
  public size: number = 0;

  constructor(bufferSize: number) {
    this.capacity = bufferSize;
    this.storage = new Array(bufferSize);
  }

  public pushAll(values: T[]): void {
    if (values && Array.isArray(values)) {
      for(let i = 0; i < values.length; i++) {
        this.push(values[i]);
      }
    }
  }

  public push(value: T): void {
    if (this.capacity <= 0)
      return;

    this.storage[this.tail] = value;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  public *[Symbol.iterator](ascending: boolean): Generator<T> {
    if (ascending) {
      for (let i = 0; i < this.size; i++) {
        let index = (this.head + i) % this.capacity;
        yield this.storage[index];
      }
    } else {
      for (let i = 0; i < this.size; i++) {
        let index = (this.size + (this.tail - i)) % this.size;
        yield this.storage[index];
      }
    }
  }

  public getBufferSize(): number {
    return this.capacity;
  }

  public getCount(): number {
    return this.size;
  }

  public static instantiate<T>(deserializedObject: CircularLogBuffer<T>): CircularLogBuffer<T> {
    if (!deserializedObject) {
      return deserializedObject;
    }

    //We need to do this so we have all methods available on the object
    return Object.assign(new CircularLogBuffer<T>(0), deserializedObject);
  }
}