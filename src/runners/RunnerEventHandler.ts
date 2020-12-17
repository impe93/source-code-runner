import { Subject } from "rxjs";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";

export class RunnerEventHandler implements IRunnerEventHandler {
  notifyCodeRunFinished$: Subject<string> = new Subject<string>();
  notifyCodeRunStarted$: Subject<string> = new Subject<string>();
  notifyRunnerRemoved$: Subject<string> = new Subject<string>();
}