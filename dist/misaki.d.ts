export type MisakiLanguage =
  | "en-us"
  | "en-gb"
  | "ja"
  | "zh"
  | "zh-legacy"
  | "es"
  | "fr-fr"
  | "hi"
  | "it"
  | "pt-br";

export interface MisakiDataProgress {
  language: MisakiLanguage;
  file: string | null;
  loadedBytes: number;
  totalBytes: number | null;
  filesLoaded: number;
  filesTotal: number;
  percent: number | null;
  done: boolean;
}

export interface MisakiClient {
  ready(): Promise<this>;
  loadLanguage(language?: MisakiLanguage): Promise<this>;
  phonemize(text: string, language?: MisakiLanguage): Promise<string>;
  phonemizeBatch(texts: readonly string[], language?: MisakiLanguage): Promise<string[]>;
  dispose(): void;
}

export interface MisakiOptions {
  /** Run the runtime off the UI thread. Defaults to true. */
  worker?: boolean;
  /** Directory containing misaki.worker.js and _framework/. Defaults to the module directory. */
  assetBaseUrl?: string | URL;
  /** Directory containing compressed language data. Defaults to the release's versioned browser mirror. */
  dataBaseUrl?: string | URL;
  /** Override the worker module URL when assets are served from a custom location. */
  workerUrl?: string | URL;
  /** Receives aggregate progress while the selected language's data files are downloaded. */
  onDataProgress?: (progress: MisakiDataProgress) => void;
  /** Languages loaded before createMisaki resolves. Defaults to ["en-us"]. Pass [] to defer all data loading. */
  preload?: readonly MisakiLanguage[];
}

export const languages: readonly MisakiLanguage[];
export function createMisaki(options?: MisakiOptions): Promise<MisakiClient>;
