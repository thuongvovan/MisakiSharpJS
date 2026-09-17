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

export interface MisakiClient {
  ready(): Promise<this>;
  phonemize(text: string, language?: MisakiLanguage): Promise<string>;
  phonemizeBatch(texts: readonly string[], language?: MisakiLanguage): Promise<string[]>;
  dispose(): void;
}

export interface MisakiOptions {
  /** Run the runtime off the UI thread. Defaults to true. */
  worker?: boolean;
  /** Directory containing misaki.worker.js and _framework/. Defaults to the module directory. */
  assetBaseUrl?: string | URL;
  /** Directory containing compressed language data. Defaults to the package's versioned GitHub Release. */
  dataBaseUrl?: string | URL;
  /** Override the worker module URL when assets are served from a custom location. */
  workerUrl?: string | URL;
}

export const languages: readonly MisakiLanguage[];
export function createMisaki(options?: MisakiOptions): Promise<MisakiClient>;
