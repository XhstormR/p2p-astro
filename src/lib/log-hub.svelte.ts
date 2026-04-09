import type { LogEntry, PeerLogType, SystemLogType } from "#/lib/types/log.d.ts";
import { now } from "#/lib/utils/index.ts";

class LogHub {
    logs = $state<LogEntry[]>([]);
    peerLogs = $state<LogEntry[]>([]);

    addLog(msg: string, type: SystemLogType = "info") {
        this.logs.push({ timestamp: now(), msg, type });
    }

    addPeerLog(msg: string, type: PeerLogType) {
        this.peerLogs.push({ timestamp: now(), msg, type });
    }
}

export const logHub = new LogHub();
