import { Observable, Subject } from 'rxjs';

export interface IRunnerEventHandler {
  notifyCodeRunFinished$: Subject<string>;
  notifyCodeRunStarted$: Subject<string>;
  notifyRunnerRemoved$: Subject<string>;
}