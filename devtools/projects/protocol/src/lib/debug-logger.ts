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
    const newEntry = `[${new Date().toISOString()}]: ${msg}`;
    data.push(newEntry);

    try {
      localStorage.setItem(DEBUG_LOGGER_KEY, JSON.stringify(data));
    } catch (er) {
      console.log('An error occured while logging');
      console.log(er);

      this.dump();
      localStorage.removeItem(DEBUG_LOGGER_KEY);

      localStorage.setItem(DEBUG_LOGGER_KEY, JSON.stringify([newEntry]));
    }
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
