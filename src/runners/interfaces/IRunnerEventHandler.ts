import { Observable, Subject } from 'rxjs';
import { IRunnerInfo } from './IRunnerInfo';

export interface IRunnerEventHandler {
  onRunnerCreated$: Subject<IRunnerInfo>;
  onRunStarted$: Subject<IRunnerInfo>;
  onRunFinished$: Subject<IRunnerInfo>;
  onRunnerRemoved$: Subject<IRunnerInfo>;
}

export interface ErrorRunner {
  runnerName: string;
  error: any;
}