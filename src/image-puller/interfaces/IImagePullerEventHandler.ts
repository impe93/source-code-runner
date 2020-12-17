import { Subject } from 'rxjs';
import { IPullProgress } from './IPullProgress';

export interface IImagePullerEventHandler {
  onImagePullStart$: Subject<void>;
  onImagePullFinished$: Subject<void>;
  onImagePullProgress$: Subject<IPullProgress>;
}