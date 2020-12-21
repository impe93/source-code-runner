import Docker from 'dockerode';
import { IInlineRunOptions } from "../IRunOptions";
import { Runner } from "./Runner";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { ICodeRunnerOptions } from "../ICodeRunnerOptions";
import { Observable } from 'rxjs';
import { IRunnerInfoExtended } from './interfaces/IRunnerInfo';

export class InlineRunner extends Runner {
  
  constructor(runEventHandler: IRunnerEventHandler, dockerHost: Docker, codeRunnerOptions: ICodeRunnerOptions) {
    super(runEventHandler, dockerHost, codeRunnerOptions);
  }

  protected runnerOptionFactory(): Docker.ContainerCreateOptions {
    throw new Error('Method not implemented.');
  }
  
  protected runCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: {}): Observable<IRunnerInfoExtended> {
    throw new Error('Method not implemented.');
  }

  private getRunnerOptions(isNetworkDisabled: boolean, runnerName: string) {
    return {
      name: `${runnerName}-${Date.now()}`,
      Tty: false,
      NetworkDisabled: isNetworkDisabled,
      HostConfig: {
        AutoRemove: true,
      }
    }
  }

  private getDefaultOptions(runOptions: IInlineRunOptions): IInlineRunOptions {
    if (!runOptions.code || runOptions.code === '') throw new Error('Code cannot be empty or null');
    return {
      code: runOptions.code,
      isNetworkDisabled: runOptions.isNetworkDisabled || true,
      timoutTime: runOptions.timoutTime || 3000
    }
  }
}