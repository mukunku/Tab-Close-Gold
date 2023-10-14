export class Queue<T> {
    private stack1: T[] = [];
    private stack2: T[] = [];
  
    enqueue(item: T): void {
      this.stack1.push(item);
    }
  
    dequeue(): T | undefined {
      if (this.stack2.length === 0) {
        while (this.stack1.length > 0) {
          this.stack2.push(this.stack1.pop() as T);
        }
      }
      return this.stack2.pop();
    }
  
    isEmpty(): boolean {
      return this.stack1.length === 0 && this.stack2.length === 0;
    }
  }
  