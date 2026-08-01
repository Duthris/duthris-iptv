import type { ParseProgress, SourceStats, StreamEndpoints, StreamFormat ,
  SourceSubscription,
} from "@iptv/core";

export type ImportRequest =
  | {
      type: "import-m3u-text";
      requestId: string;
      sourceId: string;
      text: string;
    }
  | {
      type: "import-m3u-url";
      requestId: string;
      sourceId: string;
      url: string;
    }
  | {
      type: "import-xtream";
      requestId: string;
      sourceId: string;
      baseUrl: string;
      username: string;
      password: string;
      preferredFormat: StreamFormat;
    }
  | {
      type: "import-epg";
      requestId: string;
      sourceId: string;
      epgUrl: string;
    };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ImportJob = DistributiveOmit<ImportRequest, "requestId">;

export type ImportResponse =
  | { type: "progress"; requestId: string; progress: ParseProgress }
  | {
      type: "done";
      requestId: string;
      stats: SourceStats;
      warnings: string[];

      epgUrl: string | null;

      streamEndpoints: StreamEndpoints | null;
      subscription?: SourceSubscription | null;
    }
  | {
      type: "epg-done";
      requestId: string;
      result: EpgImportResult;
    }
  | { type: "error"; requestId: string; message: string };

export interface EpgImportResult {
  programCount: number;

  epgChannelCount: number;

  matchedChannels: number;

  unmatchedChannels: number;
}
