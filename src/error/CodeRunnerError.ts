import { IRunnerInfoExtended } from "../runners/interfaces/IRunnerInfo";
import { CodeRunnerErrorType } from "./CodeRunnerErrorType";

export class CodeRunnerError extends Error {

  constructor(
    public errorType: CodeRunnerErrorType,
    public runnerInfo?: IRunnerInfoExtended,
    message?: string
  ) {
    super(message)
  }
}