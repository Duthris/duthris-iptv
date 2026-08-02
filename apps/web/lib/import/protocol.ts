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
      /**
       * The real password in the browser. On the desktop this is the bridge
       * placeholder and `credentialRef` is set, so the secret is substituted in
       * the main process and never enters this thread.
       */
      password: string;
      credentialRef?: string | null;
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
  | { type: "error"; requestId: string; message: string }
  /**
   * Asks the page to run one panel request through the desktop bridge. The
   * worker cannot reach the preload API itself, so the page relays it.
   */
  | { type: "http-request"; callId: string; credentialRef: string; url: string; maxAgeMs: number };

export type ImportCommand =
  | ImportRequest
  | { type: "http-response"; callId: string; ok: true; body: string }
  | { type: "http-response"; callId: string; ok: false; message: string; status: number };

export interface EpgImportResult {
  programCount: number;

  epgChannelCount: number;

  matchedChannels: number;

  unmatchedChannels: number;
}
