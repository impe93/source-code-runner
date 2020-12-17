import { DockerOptions } from "dockerode";
import { CodeRunner, CodeRunnerOptions } from "../CodeRunner";

export class JavaScriptCodeRunner extends CodeRunner {
  constructor(autoDownloadRunnerImage: boolean = true, dockerHostOptions?: DockerOptions) {
    super(
      {
        runnerName: 'javascript-runner',
        dockerImageName: 'node',
        dockerImageTag: 'alpine',
        runCodeCommands: ['node', '-e', '{:code:}']
      },
      autoDownloadRunnerImage,
      dockerHostOptions
    );
  }

  protected getFixedRunCommands(code: string): string[] {
    const subRegex: RegExp = new RegExp(/{:code:}/);
    return this.codeRunnerOptions.runCodeCommands.map(c => {
      return c.replace(subRegex, code)
    });
  }
}