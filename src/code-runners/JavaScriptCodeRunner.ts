import { DockerOptions } from "dockerode";
import { CodeRunner } from "../CodeRunner";

export class JavaScriptCodeRunner extends CodeRunner {
  
  constructor(autoDownloadRunnerImage: boolean = true, dockerHostOptions?: DockerOptions) {
    super(
      {
        runnerBaseName: 'javascript-runner',
        dockerImageName: 'node',
        dockerImageTag: 'alpine',
      },
      autoDownloadRunnerImage,
      dockerHostOptions
    );
  }

  protected codeRunOptionFactory() {
    return {
      runCommands: ['node', 'tmp.js'],
      fileName: 'tmp.js',
    }
  }
}