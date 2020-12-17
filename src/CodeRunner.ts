import Docker, { Container, DockerOptions, ImageInfo } from 'dockerode';
import { WritableStream } from 'memory-streams';
import { Observable, of, ReplaySubject, Subject, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ICodeRunnerOptions } from './ICodeRunnerOptions';
import { ImagePuller } from './image-puller/ImagePuller';
import { ImagePullerEventHandler } from './image-puller/ImagePullerEventHandler';
import { IImagePullerEventHandler } from './image-puller/interfaces/IImagePullerEventHandler';
import { IPullProgress } from './image-puller/interfaces/IPullProgress';
import { IFileRunOptions, IInlineRunOptions } from './IRunOptions';

export abstract class CodeRunner {
  /**
   * Last runner standard output as stream. Stream object is from the library ['memory-streams'](https://www.npmjs.com/package/memory-streams).
   */
  public stdout: WritableStream = new WritableStream();
  /**
   * Last runner standard output
   */
  public get stdoutString(): string { return this.stdout.toString() }

  /**
   * Last runner standard output error as stream. Stream object type is from the library ['memory-streams'](https://www.npmjs.com/package/memory-streams).
   */
  public stderr: WritableStream = new WritableStream();
  /**
   * Last runner standard output error
   */
  public get stderrString(): string { return this.stderr.toString() }

  protected _dockerHostOptions: DockerOptions;
  /**
   * Option to connect to the docker host
   * ```javascript
   * interface DockerOptions {
       socketPath?: string;
       host?: string;
       port?: number | string;
       username?: string;
       ca?: string | string[] | Buffer | Buffer[];
       cert?: string | string[] | Buffer | Buffer[];
       key?: string | string[] | Buffer | Buffer[] | KeyObject[];
       protocol?: 'https' | 'http' | 'ssh';
       timeout?: number;
       version?: string;
       sshAuthAgent?: string;
       Promise?: typeof Promise;
    }
   * ```
   */
  public get dockerHostOptions(): DockerOptions { return this._dockerHostOptions }

  protected codeRunnerOptions: ICodeRunnerOptions;
  protected dockerHost: Docker;

  private imagePullerEventHandler: IImagePullerEventHandler = new ImagePullerEventHandler();
  private imagePuller: ImagePuller;

  protected notifyCodeRunStarted$: Subject<void> = new Subject();
  /**
   * Notify when code run started
   */
  public get notifyCodeRunStarted(): Observable<void> { return this.notifyCodeRunStarted$.asObservable() }

  protected notifyCodeRunFinished$: Subject<void> = new Subject();
  /**
   * Notify when code run finished
   */
  public get notifyCodeRunFinished(): Observable<void> { return this.notifyCodeRunFinished$.asObservable() }

  protected notifyRunnerRemoved$: Subject<void> = new Subject();
  /**
   * Notify when runner container has been removed
   */
  public get notifyRunnerRemoved(): Observable<void> { return this.notifyRunnerRemoved$.asObservable() }

  protected notifyRunnerImagePullStarted$: Subject<void> = new Subject();
  /**
   * Notify when image pull has started
   */
  public get notifyRunnerImagePullStarted(): Observable<void> { return this.notifyRunnerImagePullStarted$.asObservable() }

  protected notifyRunnerImagePullFinished$: Subject<void> = new Subject();
  /**
   * Notify when image pull has finished
   */
  public get notifyRunnerImagePullFinished(): Observable<void> { return this.notifyRunnerImagePullFinished$.asObservable() }

  protected notifyRunnerImagePullProgress$: Subject<IPullProgress> = new Subject();
  /**
   * Notify every image pull progresses by sending the ```event``` object
   */
  public get notifyRunnerImagePullProgress(): Observable<IPullProgress> { return this.notifyRunnerImagePullProgress$.asObservable() }

  protected onHostReady$: Subject<void> = new Subject();
  /**
   * Notify when image pull has finished
   */
  public get onHostReady(): Observable<void> { return this.onHostReady$.asObservable() }

  constructor(codeRunnerOptions: ICodeRunnerOptions, autoDownloadRunnerImage: boolean = true, dockerHostOptions?: DockerOptions) {
    this.codeRunnerOptions = codeRunnerOptions;
    this._dockerHostOptions = dockerHostOptions
    this.dockerHost = new Docker(dockerHostOptions);
    this.imagePuller = new ImagePuller(this.imagePullerEventHandler, this.dockerHost);
    this.initDockerHost(codeRunnerOptions, autoDownloadRunnerImage);
  }

  private initDockerHost(codeRunnerOptions: ICodeRunnerOptions, autoDownloadRunnerImage: boolean) {
    this.isDockerHostUp()
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
            this.onHostReady$.next();
            return of(true)
          } else if (autoDownloadRunnerImage) {
            return this.imagePuller.pullRunnerImage(codeRunnerOptions.dockerImageName, codeRunnerOptions.dockerImageTag);
          }
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
    if ('code' in runOptions) {
      this.inlineRun(runOptions);
    } else if ('mainFile' in runOptions) {

    }
    return runnerOptions.name
  }

  private inlineRun(runOptions: IInlineRunOptions) {
    const runOptionsWithDefaultValues: IInlineRunOptions = this.getInlineOptionsWithDefaultValues(runOptions);
    const commands: string[] = this.getFixedRunCommands(runOptionsWithDefaultValues.code);
    const runnerOptions: any = this.getRunnerOptions(runOptionsWithDefaultValues.isNetworkEnabled);
    const timeout = this.createRemoveContainerTimeout(runnerOptions.name, runOptionsWithDefaultValues.maxRunningTime);
    this.notifyCodeRunStarted$.next();
    this.dockerHost.run(
      `${this.codeRunnerOptions.dockerImageName}:${this.codeRunnerOptions.dockerImageTag}`,
      commands,
      [this.stdout, this.stderr],
      runnerOptions,
      (err, data, container: Container) => this.runCallback(err, data, container, timeout),
    );
  }

  private fileRun(runOptions: IFileRunOptions) {
    const runOptionsWithDefaultValues: IFileRunOptions = this.getFileOptionsWithDefaultValues(runOptions);

  }

  protected abstract getFixedRunCommands(code: string): string[];

  private runCallback(err: any, data: any, container: Container, timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    if (err) {
      this.notifyCodeRunFinished$.error(err);
    } else {
      this.notifyCodeRunFinished$.next();
      const containerObj: Container = this.dockerHost.getContainer(container.id);
      if (containerObj.id) {
        this.waitContainerRemoval(containerObj);
      } else {
        this.notifyRunnerRemoved$.next();
      }
    }
  }

  private waitContainerRemoval(containerObj: Container) {
    containerObj
      .wait({ condition: 'removed' })
      .then(_ => this.notifyRunnerRemoved$.next())
      .catch(err => {
        if (err.statusCode === 404) {
          this.notifyRunnerRemoved$.next();
        } else {
          this.notifyRunnerRemoved$.error(err);
        }
      });
  }

  private createRemoveContainerTimeout(containerName: string, maxRunningTime: number) {
    return setTimeout(() => {
      const containerToRemove = this.dockerHost.getContainer(containerName);
      if (containerToRemove && containerToRemove.id) {
        this.removeContainer(containerToRemove);
      }
    }, maxRunningTime);
  }

  private removeContainer(containerToRemove: Container) {
    containerToRemove
      .remove({ force: true })
      .then(_ => this.notifyRunnerRemoved$.next())
      .catch(err => {
        if (err.statusCode === 404) {
          this.notifyRunnerRemoved$.next();
        } else {
          this.notifyRunnerRemoved$.error(err);
        }
      });
  }

  private getInlineOptionsWithDefaultValues(runOptions: IInlineRunOptions): IInlineRunOptions {
    if (!runOptions.code || runOptions.code === '') throw new Error('Code cannot be empty or null');
    return {
      code: runOptions.code,
      isNetworkEnabled: runOptions.isNetworkEnabled || false,
      maxRunningTime: runOptions.maxRunningTime || 3000
    }
  }

  private getFileOptionsWithDefaultValues(runOptions: IFileRunOptions): IFileRunOptions {
    return {
      mainFile: runOptions.mainFile,
      dir: runOptions.dir || null,
      isNetworkEnabled: runOptions.isNetworkEnabled || false,
      maxRunningTime: runOptions.maxRunningTime || 3000
    }
  }

  private getRunnerOptions(isNetworkEnabled: boolean) {
    return {
      name: `${this.codeRunnerOptions.runnerName}-${Date.now()}`,
      Tty: false,
      NetworkDisabled: isNetworkEnabled,
      HostConfig: {
        AutoRemove: true,
      }
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
