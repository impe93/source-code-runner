export interface IRunOptions {
  isNetworkEnabled?: boolean;
  timoutTime?: number;
}

export interface IFileRunOptions extends IRunOptions {
  mainFile: string;
  dir?: string;
}

export interface IInlineRunOptions extends IRunOptions {
  code: string;
}