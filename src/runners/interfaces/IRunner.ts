import { IRunOptions } from "../../IRunOptions";
import { IRunnerEventHandler } from "./IRunnerEventHandler";

export abstract class IRunner {

  /**
   * Handle events from runners during a run, those events are
   * 
   * * ```notifyCodeRunFinished```: Notify when the code run is finished and the container is starting to remove itself
   * * ```notifyCodeRunStarted```: Notify when the container start the creation process, not exactly the moment when the code start running
   * * ```notifyRunnerRemoved```: Notify when the container has been removed
   */
  protected runEventHandler: IRunnerEventHandler;

  /**
   * Start a run in a separate container
   * @param runOptions Necessary container optsions 
   */
  abstract run(runOptions: IRunOptions): string;
}