const { contextBridge } = require("electron");
const si = require("systeminformation");

function extractGpuLoad(graphicsInfo) {
  if (!graphicsInfo || !Array.isArray(graphicsInfo.controllers)) {
    return 0;
  }

  const loads = graphicsInfo.controllers
    .map((controller) => {
      const direct = Number(controller.utilizationGpu);
      if (Number.isFinite(direct) && direct >= 0) {
        return direct;
      }

      const fallback = Number(controller.utilization);
      if (Number.isFinite(fallback) && fallback >= 0) {
        return fallback;
      }

      return null;
    })
    .filter((value) => value !== null);

  if (loads.length === 0) {
    return 0;
  }

  return Math.round(loads.reduce((sum, value) => sum + value, 0) / loads.length);
}

contextBridge.exposeInMainWorld("systemAPI", {
  async getStats() {
    const [cpu, mem, graphics] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.graphics(),
    ]);

    return {
      cpu: Math.round(cpu.currentLoad),
      ram: Math.round((mem.used / mem.total) * 100),
      gpu: extractGpuLoad(graphics),
    };
  },
});
