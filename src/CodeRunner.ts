import Docker, { Container, DockerOptions, ImageInfo } from 'dockerode';
import { Observable, of, Subject } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ICodeRunnerOptions } from './ICodeRunnerOptions';
import { ImagePuller } from './image-puller/ImagePuller';
import { ImagePullerEventHandler } from './image-puller/ImagePullerEventHandler';
import { IImagePullerEventHandler } from './image-puller/interfaces/IImagePullerEventHandler';
import { IPullProgress } from './image-puller/interfaces/IPullProgress';
import { IRunOptions } from './IRunOptions';
import { InlineRunner } from './runners/InlineRunner';
import { IRunnerEventHandler } from './runners/interfaces/IRunnerEventHandler';
import { IRunnerInfo } from './runners/interfaces/IRunnerInfo';
import { RunnerEventHandler } from './runners/RunnerEventHandler';
import { RunType } from './RunType';

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
  private inlineRunner: InlineRunner;

  private runnerEventHandler: IRunnerEventHandler = new RunnerEventHandler();
  public get onRunStarted(): Observable<IRunnerInfo> { return this.runnerEventHandler.onRunStarted$.asObservable() }
  public get onRunFinished(): Observable<IRunnerInfo> { return this.runnerEventHandler.onRunFinished$.asObservable() }
  public get onRunnerRemoved(): Observable<IRunnerInfo> { return this.runnerEventHandler.onRunnerRemoved$.asObservable() }

  constructor(codeRunnerOptions: ICodeRunnerOptions, autoDownloadRunnerImage: boolean = true, dockerHostOptions?: DockerOptions) {
    this.codeRunnerOptions = codeRunnerOptions;
    this._dockerHostOptions = dockerHostOptions
    this.dockerHost = new Docker(dockerHostOptions);
    this.imagePuller = new ImagePuller(this.imagePullerEventHandler, this.dockerHost);
    this.inlineRunner = new InlineRunner(this.runnerEventHandler, this.dockerHost, codeRunnerOptions);
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

  public run(runOptions: IRunOptions, runType: RunType, options: any): Observable<IRunnerInfo> {
    switch(runType) {
      case RunType.Inline: {
        const codeRunOption = this.codeRunOptionFactory();
        codeRunOption.code = options.code;
        return this.inlineRunner.run(runOptions, codeRunOption);
      }
    }
  }

  protected abstract codeRunOptionFactory(): any;

  public isDockerHostUp(): Observable<boolean> {
    return new Observable<boolean>(sub => {
      this.dockerHost
        .ping()
        .then(_ => sub.next(true))
        .catch(_ => sub.next(false));
    })
  }
}
