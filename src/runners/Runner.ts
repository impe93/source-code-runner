import Docker, { Container, ContainerCreateOptions } from "dockerode";
import { Observable, of, Subscriber } from "rxjs";
import { catchError, switchMap, tap, timeoutWith } from "rxjs/operators";
import { WritableStream } from 'memory-streams';
import { ICodeRunnerOptions } from "../ICodeRunnerOptions";
import { IRunOptions } from "../IRunOptions";
import { IRunnerEventHandler } from "./interfaces/IRunnerEventHandler";
import { fromExtended, IRunnerInfo, IRunnerInfoExtended } from "./interfaces/IRunnerInfo";
import { v4 } from 'uuid';

export abstract class Runner {

  constructor(
    protected runEventHandler: IRunnerEventHandler,
    protected dockerHost: Docker,
    protected codeRunnerOptions: ICodeRunnerOptions
  ) { }

  public run(runOptions: IRunOptions, codeRunOptions?: {}): Observable<IRunnerInfo> {
    return new Observable<IRunnerInfo>(
      sub => {
        const stdout: WritableStream = new WritableStream();
        const stderr: WritableStream = new WritableStream();
        const runnerOptions: ContainerCreateOptions = this.runnerOptionFactory();
        this.createRunner(stdout, stderr, runnerOptions)
          .pipe(
            tap(info => sub.next(fromExtended(info))),
            switchMap(info => {
              return this.beforeRunCode(info, codeRunOptions);
            }),
            switchMap(info => {
              this.runEventHandler.onRunStarted$.next(fromExtended(info));
              return this.runCode(info, codeRunOptions);
            }),
            timeoutWith(runOptions.timoutTime, of(info)),
            switchMap(info => {
              this.runEventHandler.onRunFinished$.next(fromExtended(info));
              return this.beforeRemoveRunner(info, codeRunOptions);
            }),
            switchMap(info => {
              return this.runnerDestroy(info);
            }),
            switchMap(info => {
              return this.waitRunnerDistruction(info);
            }),
            catchError((err, caught) => {
              if (err) {
                sub.error(err);
              }
              return caught;
            })
          )
          .subscribe(info => this.runEventHandler.onRunnerRemoved$.next(fromExtended(info)))
      }
    );
  }

  protected abstract runnerOptionFactory(): ContainerCreateOptions;

  protected abstract runCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: {}): Observable<IRunnerInfoExtended>;

  protected beforeRunCode(runnerInfo: IRunnerInfoExtended, codeRunOptions?: {}): Observable<IRunnerInfoExtended> {
    return new Observable(sub => sub.next(runnerInfo));
  }

  protected beforeRemoveRunner(runnerInfo: IRunnerInfoExtended, codeRunOptions?: {}): Observable<IRunnerInfoExtended> {
    return new Observable(sub => sub.next(runnerInfo));
  }

  private createRunner(stdout: WritableStream, stderr: WritableStream, runnerOptions: ContainerCreateOptions): Observable<IRunnerInfoExtended> {
    return new Observable<IRunnerInfoExtended>((sub: Subscriber<IRunnerInfoExtended>) => {
      runnerOptions.name = `${this.codeRunnerOptions.runnerBaseName}-${v4()}`;
      runnerOptions.Image = `${this.codeRunnerOptions.dockerImageName}:${this.codeRunnerOptions.dockerImageTag}`
      this.dockerHost.createContainer(
        runnerOptions,
        (err, container) => {
          this.runnerCreated(err, sub, container, stdout, stderr, runnerOptions.name);
        }
      );
    })
  }

  private runnerCreated(err: any, sub: Subscriber<IRunnerInfoExtended>, container: Docker.Container, stdout: WritableStream, stderr: WritableStream, runnerName: string) {
    if (err) {
      sub.error(err);
    } else {
      this.attachOutputs(container, stdout, stderr);
      const runnerInfo: IRunnerInfoExtended = { runnerName, stderr, stdout, container: container };
      this.runEventHandler.onRunnerCreated$.next(runnerInfo);
      sub.next(runnerInfo);
    }
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

  private waitRunnerDistruction(runnerInfo: IRunnerInfoExtended): Observable<IRunnerInfoExtended> {
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
            sub.error()
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

  private setRemoveRunnerTimeout(containerName: string, maxRunningTime: number) {
    return setTimeout(() => {
      const containerToRemove = this.dockerHost.getContainer(containerName);
      if (containerToRemove && containerToRemove.id) {
        this.runnerDestroy(containerToRemove)
          .pipe(
            switchMap(container => {
              return this.waitRunnerDistruction(container)
            })
          )
          .subscribe({
            next: _ => this.runEventHandler.onRunnerRemoved$.next(containerName),
            error: err => this.runEventHandler.onRunnerRemoved$.error(containerName)
          })
      }
    }, maxRunningTime);
  }

}
