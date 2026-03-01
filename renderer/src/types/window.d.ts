export {};

declare global {
  interface Window {
    systemAPI?: {
      getStats: () => Promise<{
        cpu: number;
        ram: number;
        gpu: number;
      }>;
    };
  }
}
