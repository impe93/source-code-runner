import Docker, { ImageInfo } from "dockerode";
import { Observable } from "rxjs";
import { IImagePullerEventHandler } from "./interfaces/IImagePullerEventHandler";
import { IPullProgress } from "./interfaces/IPullProgress";

export class ImagePuller {

  constructor(
    private readonly imagePullerEventHandler: IImagePullerEventHandler,
    private readonly dockerHost: Docker,
  ) { }

  public checkImageExistence(imageName: string, imageTag: string): Observable<ImageInfo | undefined> {
    return new Observable(sub => {
      this.dockerHost
        .listImages()
        .then((images: ImageInfo[]) => {
          const image = images.find(im => {
            const searchedRepo = im.RepoTags.find(rt => {
              return rt === `${imageName}:${imageTag}`
            });
            return !!searchedRepo;
          });
          sub.next(image);
        })
        .catch(err => sub.error(err));
    })
  }

  public pullRunnerImage(imageName: string, imageTag: string): Observable<boolean> {
    return new Observable<boolean>(sub => {
      this.imagePullerEventHandler.onImagePullStart$.next();
      this.dockerHost.pull(
        `${imageName}:${imageTag}`,
        (err0, stream) => {
          this.dockerHost.modem.followProgress(
            stream,
            (err1, output) => {
              if (err1) {
                this.imagePullerEventHandler.onImagePullFinished$.error(err1);
                sub.error(err1);
              } else {
                this.imagePullerEventHandler.onImagePullFinished$.next();
                sub.next(true);
              }
            },
            (event: IPullProgress) => {
              this.imagePullerEventHandler.onImagePullProgress$.next(event);
            },
          );
        }
      );
    })
  }
}