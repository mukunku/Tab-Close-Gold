export class CircularLogBuffer<T> {
    private storage: T[];
    private capacity: number;
    private head: number = 0;
    private tail: number = 0;
    private size: number = 0;
  
    constructor(bufferSize: number) {
      this.capacity = bufferSize;
      this.storage = new Array(bufferSize);
    }

    push(value: T): void {
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
  
    *[Symbol.iterator](): Generator<T> {
      for (let i = this.head; i !== this.tail; i = (i + 1) % this.capacity) {
        yield this.storage[i];
      }
    }

    getBufferSize(): number {
      return this.capacity;
    }
  }