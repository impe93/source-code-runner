import archiver from "archiver";
import { WritableStream } from "memory-streams";
import { Observable } from "rxjs";

export function archiveString(code: string, fileName: string): Observable<Buffer> {
  return new Observable<Buffer>(sub => {
    const output = new WritableStream()
    const archive = archiver('zip', {
      gzip: true,
      gzipOptions: {
        level: 9
      }
    });
    archive.pipe(output);
    archive.append(code, { name: fileName })
    // archive.directory(path.join(__dirname, '..', 'testdir'), false);
    archive.finalize()
      .then(_ => {
        const buffer: Buffer = output.toBuffer();
        sub.next(buffer)
      })
  });
}