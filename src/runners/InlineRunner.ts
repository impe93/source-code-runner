import Docker, { ContainerCreateOptions } from 'dockerode';
import { IRunOptions } from "../IRunOptions";
import { Runner } from "./Runner";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { ICodeRunnerOptions } from "../ICodeRunnerOptions";
import { Observable, throwError } from 'rxjs';
import { fromExtended, IRunnerInfoExtended } from './interfaces/IRunnerInfo';
import { CodeRunnerError } from '../error/CodeRunnerError';
import { CodeRunnerErrorType } from '../error/CodeRunnerErrorType';
import path from 'path';
import { archiveString } from '../helpers/archive-helper';
import { switchMap, tap } from 'rxjs/operators';

export class InlineRunner extends Runner {

  constructor(
    runEventHandler: IRunnerEventHandler,
    dockerHost: Docker,
    codeRunnerOptions: ICodeRunnerOptions
  ) {
    super(runEventHandler, dockerHost, codeRunnerOptions);
  }

  protected runnerOptionFactory(runOptions: IRunOptions): ContainerCreateOptions {
    return {
      Tty: false,
      NetworkDisabled: runOptions.isNetworkDisabled,
    }
  }

  protected runCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: any): Observable<IRunnerInfoExtended> {
    const { runCommands } = codeRunOptions;
    this.runEventHandler.onRunStarted$.next(fromExtended(runnerInfo))
    return this.execRunCommands(runCommands, runnerInfo)
      .pipe(
        tap(_ => this.runEventHandler.onRunFinished$.next(fromExtended(runnerInfo)))
      );
  }

  protected beforeRunCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: any): Observable<IRunnerInfoExtended> {
    const { code, beforeRunCommands, ext } = codeRunOptions;
    let { fileName } = codeRunOptions;

    if (!code) return throwError(new CodeRunnerError(CodeRunnerErrorType.BeforeRun, runnerInfo, 'Code can\'t be null'));
    if (!fileName && !ext) return throwError(new CodeRunnerError(CodeRunnerErrorType.BeforeRun, runnerInfo, 'One between ext and fileName has to be provided'));
    if (!fileName) fileName = this.getDefaultName(fileName, ext);

    return this.sendToRunner(code, fileName, runnerInfo)
      .pipe(
        switchMap(_ => this.execPrepCommands(beforeRunCommands, runnerInfo))
      );
  }

  private execPrepCommands(commands: any, runnerInfo: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>(sub => {
      if (commands) {
        runnerInfo.container.exec({
          AttachStdout: false,
          AttachStderr: false,
          AttachStdin: false,
          Cmd: ['sh', '-c', ...commands],
          Tty: false,
        })
          .then(val => sub.next(runnerInfo))
          .catch(err => sub.error(new CodeRunnerError(CodeRunnerErrorType.BeforeRun, runnerInfo, 'Something gone wrong during exec preparation commands')));
      } else {
        sub.next(runnerInfo);
      }
    });
  }

  private execRunCommands(commands: any, runnerInfo: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>(sub => {
      if (commands) {
        runnerInfo.container.exec({
          AttachStdout: true,
          AttachStderr: true,
          Cmd: ['sh', '-c', ...commands],
          Tty: false,
        })
          .then(val => sub.next(runnerInfo))
          .catch(err => sub.error(new CodeRunnerError(CodeRunnerErrorType.BeforeRun, runnerInfo, 'Something gone wrong during exec run commands')));
      } else {
        sub.next(runnerInfo);
      }
    });
  }

  private getDefaultName(fileName: any, ext: any) {
    fileName = `tmp.${ext}`;
    return fileName;
  }

  private sendToRunner(code: any, fileName: any, runnerInfo: IRunnerInfoExtended): Observable<void> {
    return archiveString(code, fileName)
      .pipe(
        switchMap(buffer => {
          return new Observable<void>(sub => {
            runnerInfo.container
              .putArchive(buffer, { path: '/tmp' })
              .then(_ => sub.next())
              .catch(err => throwError(new CodeRunnerError(CodeRunnerErrorType.BeforeRun, runnerInfo, 'Something gone wrong while send the archived code to the runner.')));
          });
        })
      );
  }
}