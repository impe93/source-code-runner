export interface IRunOptions {
  isNetworkEnabled?: boolean;
  maxRunningTime?: number;
}

export interface IFileRunOptions {
  mainFile: string;
  dir?: string;
  isNetworkEnabled?: boolean;
  maxRunningTime?: number;
}

export interface IInlineRunOptions {
  code: string;
  isNetworkEnabled?: boolean;
  maxRunningTime?: number;
}

export function isInlineRunOptions(obj: any): boolean {
  return 'code' in obj;
}

export function isFileRunOptions(obj: any): boolean {
  return 'mainFile' in obj;
}