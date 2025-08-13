let instance: DebugLogger | undefined;

const DEBUG_LOGGER_KEY = 'dt_debug_logger';

type DebugData = string[];

export class DebugLogger {
  static getLogger(): DebugLogger {
    if (!instance) {
      instance = new DebugLogger();
    }
    return instance;
  }

  log(msg: string) {
    const data = this.getData();
    data.push(`[${new Date().toISOString()}]: ${msg}`);
    localStorage.setItem(DEBUG_LOGGER_KEY, JSON.stringify(data));
  }

  dump() {
    console.log(this.getData());
  }

  private getData(): DebugData {
    const lsValue = localStorage.getItem(DEBUG_LOGGER_KEY);
    return JSON.parse(lsValue || '[]');
  }
}

(window as any).DebugLogger = DebugLogger;
