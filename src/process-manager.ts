export interface ProcessManager {
  start(): void | Promise<void>;
  close(): void | Promise<void>;
}
