import Docker, { Container } from 'dockerode';
import { IInlineRunOptions } from "../IRunOptions";
import { Runner } from "./Runner";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { ICodeRunnerOptions } from "../ICodeRunnerOptions";
import { Observable } from 'rxjs';

export class InlineRunner extends Runner {

  constructor(runEventHandler: IRunnerEventHandler, dockerHost: Docker, codeRunnerOptions: ICodeRunnerOptions) {
    super(runEventHandler, dockerHost, codeRunnerOptions);
  }

  protected runCode(container: Container): Observable<Container> {
    throw new Error('Method not implemented.');
  }

  // public run(
  //   runOptions: IInlineRunOptions,
  //   execCommands: string[]
  // ): IRunnerInfo {
  //   const stdout: WritableStream = new WritableStream();
  //   const stderr: WritableStream = new WritableStream();
  //   const runOptionsWithDefaultValues: IInlineRunOptions = this.getInlineOptionsWithDefaultValues(runOptions);
  //   const runnerOptions: any = this.getRunnerOptions(runOptionsWithDefaultValues.isNetworkEnabled, this.codeRunnerOptions.runnerBaseName);
  //   const timeout = this.setRemoveRunnerTimeout(runnerOptions.name, runOptionsWithDefaultValues.maxRunningTime);
    
  //   this.runEventHandler.onRunStarted$.next(this.codeRunnerOptions.runnerBaseName);
  //   this.dockerHost.run(
  //     `${this.codeRunnerOptions.dockerImageName}:${this.codeRunnerOptions.dockerImageTag}`,
  //     execCommands,
  //     [stdout, stderr],
  //     runnerOptions,
  //     (err, data, container: Container) => this.runFinished(err, this.codeRunnerOptions.runnerBaseName, container, timeout),
  //   );

  //   return {
  //     runnerName: this.codeRunnerOptions.runnerBaseName,
  //     stderr,
  //     stdout
  //   }
  // }

  private runFinished(err: any, containerName: string, container: Container, timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    if (err) {
      this.finishedWithError(containerName, err);
    } else {
      this.finished(containerName, container);
    }
  }

  private finished(containerName: string, container: Docker.Container) {
    this.runEventHandler.onRunFinished$.next(containerName);
    const containerObj: Container = this.dockerHost.getContainer(container.id);
    if (containerObj.id) {
      this.waitRemoveRunner(containerObj, containerName);
    } else {
      this.runEventHandler.onRunnerRemoved$.next(containerName);
    }
  }

  private finishedWithError(containerName: string, err: any) {
    this.runEventHandler.onRunFinished$.error({
      runnerName: containerName,
      error: err
    });
  }

  private waitRemoveRunner(containerObj: Docker.Container, containerName: string) {
    this.waitRunnerRemoval(containerObj)
      .subscribe({
        next: _ => this.runEventHandler.onRunnerRemoved$.next(containerName),
        error: err => this.runEventHandler.onRunnerRemoved$.error({
          runnerName: containerName,
          error: err
        })
      });
  }

  private getRunnerOptions(isNetworkEnabled: boolean, runnerName: string) {
    return {
      name: `${runnerName}-${Date.now()}`,
      Tty: false,
      NetworkDisabled: isNetworkEnabled,
      HostConfig: {
        AutoRemove: true,
      }
    }
  }

  private getInlineOptionsWithDefaultValues(runOptions: IInlineRunOptions): IInlineRunOptions {
    if (!runOptions.code || runOptions.code === '') throw new Error('Code cannot be empty or null');
    return {
      code: runOptions.code,
      isNetworkEnabled: runOptions.isNetworkEnabled || false,
      maxRunningTime: runOptions.maxRunningTime || 3000
    }
  }
}