export interface IPullProgress {
  id: string;
  status: string;
  progressDetail?: {
    current?: number,
    total?: number
  };
  progress?: string
}