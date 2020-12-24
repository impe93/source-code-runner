const { switchMap } = require('rxjs/operators');
const { JavaScriptCodeRunner } = require('../lib/code-runners/JavaScriptCodeRunner');
const { RunType } = require('../lib/RunType');


const jsRunner = new JavaScriptCodeRunner(true);

jsRunner.onRunStarted.subscribe(_ => console.log('Run started'));
jsRunner.onRunFinished.subscribe(_ => console.log('Run finished'));
jsRunner.onRunnerRemoved.subscribe(_ => console.log('Runner removed'));

jsRunner.onHostReady
  .pipe(
    switchMap(_ => {
      console.log('Runner ready')
      return jsRunner.run({}, 0, { code: `console.log('Ciao sto funzionando)` })
    })
  )
  .subscribe({
    next: runnerInfo => {
      console.log(runnerInfo.runnerName)
    },
    error: err => {
      console.log(err)
    }
  });



