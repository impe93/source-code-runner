import archiver from "archiver";
import { WritableStream } from "memory-streams";
import { Observable } from "rxjs";

export function archiveString(code: string, fileName: string): Observable<Buffer> {
  return new Observable<Buffer>(sub => {
    const output = new WritableStream()
    const archive = archiver('tar');
    archive.pipe(output);
    archive.append(code, { name: fileName })
    archive.finalize()
      .then(_ => {
        const buffer: Buffer = output.toBuffer();
        sub.next(buffer)
      })
  });
}