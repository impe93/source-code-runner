import { ImageInfo } from 'dockerode';
import { Subject } from 'rxjs';
import { IImagePullerEventHandler } from "./interfaces/IImagePullerEventHandler";
import { IPullProgress } from './interfaces/IPullProgress';

export class ImagePullerEventHandler implements IImagePullerEventHandler{
  onImagePullStart$: Subject<void> = new Subject();
  onImagePullFinished$: Subject<void> = new Subject();
  onImagePullProgress$: Subject<IPullProgress> = new Subject();
}