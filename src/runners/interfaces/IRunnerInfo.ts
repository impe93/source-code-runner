import { Container } from 'dockerode';
import { WritableStream } from 'memory-streams';

export interface IRunnerInfo {
  runnerName: string;
  stdout: WritableStream;
  stderr: WritableStream;
}

export interface IRunnerInfoExtended extends IRunnerInfo {
  container: Container
}

export function fromExtended(extendedInfo: IRunnerInfoExtended): IRunnerInfo {
  return {
    runnerName: extendedInfo.runnerName,
    stderr: extendedInfo.stderr,
    stdout: extendedInfo.stdout,
  };
}