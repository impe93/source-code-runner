import Docker, { Container, DockerOptions, ImageInfo } from 'dockerode';
import { Observable, of, Subject } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ICodeRunnerOptions } from './ICodeRunnerOptions';
import { ImagePuller } from './image-puller/ImagePuller';
import { ImagePullerEventHandler } from './image-puller/ImagePullerEventHandler';
import { IImagePullerEventHandler } from './image-puller/interfaces/IImagePullerEventHandler';
import { IPullProgress } from './image-puller/interfaces/IPullProgress';
import { IFileRunOptions, IInlineRunOptions } from './IRunOptions';
import { IRunnerEventHandler } from './runners/interfaces/IRunnerEventHandler';
import { RunnerEventHandler } from './runners/RunnerEventHandler';

export abstract class CodeRunner {

  protected codeRunnerOptions: ICodeRunnerOptions;

  // ----- Docker Host section -----
  protected dockerHost: Docker;
  protected onHostReady$: Subject<void> = new Subject();
  public get onHostReady(): Observable<void> { return this.onHostReady$.asObservable() }
  protected _dockerHostOptions: DockerOptions;
  public get dockerHostOptions(): DockerOptions { return this._dockerHostOptions }

  // ----- Image puller section -----
  private imagePullerEventHandler: IImagePullerEventHandler = new ImagePullerEventHandler();
  private imagePuller: ImagePuller;
  public get onImagePullStart(): Observable<void> { return this.imagePullerEventHandler.onImagePullStart$.asObservable(); }
  public get onImagePullFinished(): Observable<void> { return this.imagePullerEventHandler.onImagePullFinished$.asObservable(); }
  public get onImagePullProgress(): Observable<IPullProgress> { return this.imagePullerEventHandler.onImagePullProgress$.asObservable(); }

  // ----- Runners section -----  
  private runnerEventHandler: IRunnerEventHandler = new RunnerEventHandler();
  public get onRunStarted(): Observable<string> { return this.runnerEventHandler.onRunStarted$.asObservable() }
  public get onRunFinished(): Observable<string> { return this.runnerEventHandler.onRunFinished$.asObservable() }
  public get onRunnerRemoved(): Observable<string> { return this.runnerEventHandler.onRunnerRemoved$.asObservable() }

  constructor(codeRunnerOptions: ICodeRunnerOptions, autoDownloadRunnerImage: boolean = true, dockerHostOptions?: DockerOptions) {
    this.codeRunnerOptions = codeRunnerOptions;
    this._dockerHostOptions = dockerHostOptions
    this.dockerHost = new Docker(dockerHostOptions);
    this.imagePuller = new ImagePuller(this.imagePullerEventHandler, this.dockerHost);
    this.initDockerHost(codeRunnerOptions, autoDownloadRunnerImage).subscribe();
  }

  private initDockerHost(codeRunnerOptions: ICodeRunnerOptions, autoDownloadRunnerImage: boolean): Observable<boolean> {
    return this.isDockerHostUp()
      .pipe(
        switchMap(isHostUp => {
          if (isHostUp) {
            return this.imagePuller.checkImageExistence(codeRunnerOptions.dockerImageName, codeRunnerOptions.dockerImageTag);
          } else {
            throw new Error('Can\'t connect to docker host.');
          }
        }),
        switchMap((isImageExist: ImageInfo) => {
          if (isImageExist) {
            return of(true)
          } else if (autoDownloadRunnerImage) {
            return this.imagePuller.pullRunnerImage(codeRunnerOptions.dockerImageName, codeRunnerOptions.dockerImageTag)
          } else {
            return of(false)
          }
        }),
        tap({
          next: isHostReady => { if (isHostReady) this.onHostReady$.next() }
        })
      )
  }

  // public runCode(runOptions: RunOptions) {
  //   const runOptionsWithDefaultValues: RunOptions = this.getOptionsWithDefaultValues(runOptions);
  //   const commands: string[] = this.getFixedRunCommands(runOptionsWithDefaultValues.code);
  //   const runnerOptions: any = this.getRunnerOptions(runOptionsWithDefaultValues.isNetworkEnabled);
  //   const timeout = this.createRemoveContainerTimeout(runnerOptions.name, runOptionsWithDefaultValues.maxRunningTime);
  //   this.notifyCodeRunStarted$.next();
  //   this.dockerHost.run(
  //     `${this.codeRunnerOptions.dockerImageName}:${this.codeRunnerOptions.dockerImageTag}`,
  //     commands,
  //     [this.stdout, this.stderr],
  //     runnerOptions,
  //     (err, data, container: Container) => this.runCallback(err, data, container, timeout),
  //   )
  // }

  public run(runOptions: IInlineRunOptions | IFileRunOptions) {
    
  }

  protected abstract getFixedRunCommands(code: string): string[];

  private getFileOptionsWithDefaultValues(runOptions: IFileRunOptions): IFileRunOptions {
    return {
      mainFile: runOptions.mainFile,
      dir: runOptions.dir || null,
      isNetworkEnabled: runOptions.isNetworkEnabled || false,
      timoutTime: runOptions.timoutTime || 3000
    }
  }

  public isDockerHostUp(): Observable<boolean> {
    return new Observable<boolean>(sub => {
      this.dockerHost
        .ping()
        .then(_ => sub.next(true))
        .catch(_ => sub.next(false));
    })
  }
}
