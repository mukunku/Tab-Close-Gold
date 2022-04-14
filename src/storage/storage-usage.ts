export class StorageUsage {
    public bytesUsed: number;
    public maxBytes: number;
    public percentage: number;

    constructor(bytesUsed: number, maxBytes: number) {
        this.bytesUsed = bytesUsed;
        this.maxBytes = maxBytes;
        if (this.maxBytes != 0) {
            this.percentage = (100 * bytesUsed / maxBytes);

            //lets round really low percentage values
            this.percentage = (this.percentage < 0.01 ? 0.01 : this.percentage)
        } else {
            this.percentage = 0;
        }
    }
}