import Docker, { Container, ContainerCreateOptions } from "dockerode";
import { Observable, of, Subscriber, throwError } from "rxjs";
import { catchError, concatMap, switchMap, tap, timeout, timeoutWith } from "rxjs/operators";
import { WritableStream } from 'memory-streams';
import { ICodeRunnerOptions } from "../ICodeRunnerOptions";
import { IRunOptions } from "../IRunOptions";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { fromExtended, IRunnerInfo, IRunnerInfoExtended } from "./interfaces/IRunnerInfo";
import { v4 } from 'uuid';
import { CodeRunnerError } from "../error/CodeRunnerError";
import { CodeRunnerErrorType } from "../error/CodeRunnerErrorType";

export abstract class Runner {

  constructor(
    protected runEventHandler: IRunnerEventHandler,
    protected dockerHost: Docker,
    protected codeRunnerOptions: ICodeRunnerOptions
  ) { }

  public run(runOptions: IRunOptions, codeRunOptions?: any): Observable<IRunnerInfo> {
    return new Observable<IRunnerInfo>(
      sub => {
        const stdout: WritableStream = new WritableStream();
        const stderr: WritableStream = new WritableStream();
        const defaultRunOptions: IRunOptions = this.getDefaultOptions(runOptions);
        const runnerOptions: ContainerCreateOptions = this.runnerOptionFactory(defaultRunOptions);
        this.buildRunnerPipeline(stdout, stderr, runnerOptions, sub, codeRunOptions, defaultRunOptions)
          .subscribe(result => {
            if (result instanceof CodeRunnerError) {
              this.runEventHandler.onRunnerRemoved$.error(result);
            } else {
              this.runEventHandler.onRunnerRemoved$.next(fromExtended(result))
            }
          })
      }
    );
  }

  protected abstract runnerOptionFactory(runOptions: IRunOptions): ContainerCreateOptions;

  protected abstract runCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: any): Observable<IRunnerInfoExtended>;

  protected beforeRunCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: any): Observable<IRunnerInfoExtended> {
    return new Observable(sub => sub.next(runnerInfo));
  }

  protected beforeRemoveRunner(runnerInfo: IRunnerInfoExtended, codeRunOptions?: any): Observable<IRunnerInfoExtended> {
    return new Observable(sub => sub.next(runnerInfo));
  }

  private buildRunnerPipeline(stdout: WritableStream, stderr: WritableStream, runnerOptions: Docker.ContainerCreateOptions, sub: Subscriber<IRunnerInfo>, codeRunOptions: any, runOptions: IRunOptions) {
    return this.createRunner(stdout, stderr, runnerOptions)
      .pipe(
        tap(info => sub.next(fromExtended(info))),
        switchMap(info => this.beforeRunCode(info, codeRunOptions)),
        concatMap(info => this.runCodePipelinePart(info, codeRunOptions, runOptions)),
        switchMap(info => this.beforeRemoveRunnerPipelinePart(info, codeRunOptions)),
        switchMap(info => this.runnerDestroyPipelinePart(info)),
        switchMap(info => this.waitDestructionPipelinePart(info)),
        catchError((err: CodeRunnerError, _) => this.handleErrorPipelinePart(err))
      );
  }

  private handleErrorPipelinePart(err: CodeRunnerError) {
    this.removeAfterError(err.runnerInfo);
    return of(err);
  }

  private waitDestructionPipelinePart(info: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return this.waitRunnerDestruction(info)
      .pipe(
        catchError((err, _) => {
          const errorToThrow = new CodeRunnerError(
            CodeRunnerErrorType.DestroyRunner,
            info,
            'Something gone wrong while waiting runner destruction.'
          );
          return throwError(errorToThrow);
        })
      );
  }

  private runnerDestroyPipelinePart(info: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return this.runnerDestroy(info)
      .pipe(
        catchError((err, _) => {
          const errorToThrow = new CodeRunnerError(
            CodeRunnerErrorType.DestroyRunner,
            info,
            'Something gone wrong while destroing the runner.'
          );
          return throwError(errorToThrow);
        })
      );
  }

  private beforeRemoveRunnerPipelinePart(info: IRunnerInfoExtended, codeRunOptions: any) {
    this.runEventHandler.onRunFinished$.next(fromExtended(info));
    return this.beforeRemoveRunner(info, codeRunOptions);
  }

  private runCodePipelinePart(info: IRunnerInfoExtended, codeRunOptions: any, runOptions: IRunOptions): Observable<IRunnerInfoExtended> {
    return of(info).pipe(
      switchMap(info => {
        this.runEventHandler.onRunStarted$.next(fromExtended(info));
        return this.runCode(info, codeRunOptions)
          .pipe(
            catchError((err, _) => {
              const errorToThrow = new CodeRunnerError(
                CodeRunnerErrorType.Run,
                info,
                'Something gone wrong while running the code.'
              );
              return throwError(errorToThrow);
            })
          );
      }),
      timeoutWith(runOptions.timoutTime, throwError(new CodeRunnerError(CodeRunnerErrorType.Timeout, info, 'Runned code gone in timeout')))
    );
  }

  private createRunner(stdout: WritableStream, stderr: WritableStream, runnerOptions: ContainerCreateOptions): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>((sub: Subscriber<IRunnerInfoExtended>) => {
      runnerOptions.name = `${this.codeRunnerOptions.runnerBaseName}-${v4()}`;
      runnerOptions.Image = `${this.codeRunnerOptions.dockerImageName}:${this.codeRunnerOptions.dockerImageTag}`
      let runnerInfo: IRunnerInfoExtended;
      this.dockerHost.createContainer(runnerOptions)
        .then((container: Container) => {
          this.attachOutputs(container, stdout, stderr);
          runnerInfo = { runnerName: runnerOptions.name, stderr, stdout, container: container };
          return container.start();
        })
        .then(_ => {
          this.runEventHandler.onRunnerCreated$.next(runnerInfo);
          sub.next(runnerInfo);
        })
        .catch(err => {
          return sub.error(
            new CodeRunnerError(
              CodeRunnerErrorType.CreateRunner,
              runnerInfo,
              'Something gone wrong during runner init'
            )
          );
        });
    })
  }

  private attachOutputs(container: Docker.Container, stdout: WritableStream, stderr: WritableStream) {
    container.attach(
      { stream: true, stdout: true, stderr: true },
      (err, stream) => {
        if (err) throw new Error('Failed to attach to runner standard output and error output');
        container.modem.demuxStream(stream, stdout, stderr);
      }
    );
  }

  private waitRunnerDestruction(runnerInfo: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>(sub => {
      runnerInfo.container
        .wait({ condition: 'removed' })
        .then(_ => {
          sub.next(runnerInfo)
        })
        .catch(err => {
          if (err.statusCode === 404) {
            sub.next(runnerInfo)
          } else {
            sub.error(err)
          }
        });
    })
  }

  private runnerDestroy(runnerInfo: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>(sub => {
      runnerInfo.container
        .remove({ force: true })
        .then(_ => sub.next(runnerInfo))
        .catch(err => {
          if (err.statusCode === 404) {
            sub.next(runnerInfo);
          } else {
            sub.error(err);
          }
        });
    });
  }

  private removeAfterError(runnerInfo: IRunnerInfoExtended) {
    this.runnerDestroy(runnerInfo)
      .pipe(
        switchMap(container => {
          return this.waitRunnerDestruction(container)
        })
      )
      .subscribe({
        next: _ => this.runEventHandler.onRunnerRemoved$.next(fromExtended(runnerInfo)),
        error: err => this.runEventHandler.onRunnerRemoved$.error(
          new CodeRunnerError(
            CodeRunnerErrorType.DestroyRunner,
            runnerInfo,
            'Something gone wrong while destroing the runner.'
          )
        )
      })
  }

  private getDefaultOptions(runOptions: IRunOptions): IRunOptions {
    return {
      isNetworkDisabled: runOptions.isNetworkDisabled || true,
      timoutTime: runOptions.timoutTime || 3000
    }
  }

}
