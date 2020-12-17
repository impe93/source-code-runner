import { IInlineRunOptions } from "../IRunOptions";
import { IRunner } from "./interfaces/IRunner";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";

export class InlineRunner extends IRunner {


  constructor(
    protected readonly runEventHandler: IRunnerEventHandler,
  ) {
    super();
  }

  run(runOptions: IInlineRunOptions): string {

  }
}