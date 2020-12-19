import { Subject } from "rxjs";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { IRunnerInfo } from "./interfaces/IRunnerInfo";

export class RunnerEventHandler implements IRunnerEventHandler {
  onRunnerCreated$: Subject<IRunnerInfo> = new Subject<IRunnerInfo>();
  onRunnerRemoved$: Subject<IRunnerInfo> = new Subject<IRunnerInfo>();
  onRunStarted$: Subject<IRunnerInfo> = new Subject<IRunnerInfo>();
  onRunFinished$: Subject<IRunnerInfo> = new Subject<IRunnerInfo>();
}