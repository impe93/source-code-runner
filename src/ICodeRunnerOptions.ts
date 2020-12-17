export interface ICodeRunnerOptions {
  runnerName: string;
  dockerImageName: string;
  dockerImageTag: string;
  dockerImageVersion?: string;
  runCodeCommands: string[]
}