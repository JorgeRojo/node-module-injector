import { spawn, spawnSync } from 'node:child_process';

import ConsoleGroup from './ConsoleGroup';
import {
  ExecuteCommandOutputType,
  OutputColor,
  OutputIcons,
  OutputTypeToColor,
  STDERR_OUTPUT_DETECT_ERROR_PATTERNS,
} from './TerminalConstants';
import {
  executeCommandAsyncModeOptions,
  type ExecuteCommandOptions,
  type ExecuteCommandOutput,
  executeCommandSyncModeOptions,
} from './TerminalTypes';

type TraceConfig = ExecuteCommandOutput & {
  icon?: string;
  logFn?: typeof console.log | typeof console.warn;
};

const MINIMUM_TIMEOUT = 100;
const EXIT_DELAY = 1000;

const cleanOutput = (output: string): string =>
  output
    .replace(/[^a-z0-9-\n\s\r\t{}()"',:_\\/\\*+.|><=@áéíóúÁÉÍÓÚñçü]/gi, '')
    .trim();

const getConsoleInitColorizedFlag = (
  type: ExecuteCommandOutput['type'],
  pid?: number,
  icon?: string
): string[] => {
  const typeColor = OutputTypeToColor[type];
  return [
    `%c${icon} %c${type.padEnd(5, ' ')}`,
    `color:${OutputColor}`,
    `color:${typeColor}`,
    `PID: ${pid}`,
  ];
};

const printMiddleTraceWithIconByLine = ({
  logFn,
  type,
  icon,
  data,
}: TraceConfig): void => {
  const color =
    type === ExecuteCommandOutputType.STDOUT ? '' : OutputTypeToColor[type];

  logFn?.(
    `%c${data}`.replace(/^(.*)/gi, `${icon} $1`).replace(/\n/gi, `\n${icon} `),
    `color:${color}`
  );
};

const printMiddleTrace = ({ logFn, type, icon, data }: TraceConfig): void => {
  typeof data !== 'object'
    ? printMiddleTraceWithIconByLine({ logFn, type, icon, data })
    : logFn?.(icon, data);
};

const consolePrint = ({ logFn, type, pid, icon, data }: TraceConfig): void => {
  const isMiddleTrace =
    type === ExecuteCommandOutputType.STDOUT ||
    type === ExecuteCommandOutputType.STDERR_WARN;

  if (isMiddleTrace) {
    printMiddleTrace({ logFn, type, icon, data });
    return;
  }

  logFn?.(...getConsoleInitColorizedFlag(type, pid, icon), `${data}`);
};

const consoleLog = (config: TraceConfig): void => {
  // eslint-disable-next-line no-console
  consolePrint({ ...config, logFn: console.log });
};

const consoleWarn = (config: TraceConfig): void => {
  // eslint-disable-next-line no-console
  consolePrint({ ...config, logFn: console.log });
};

const consoleError = (config: TraceConfig): void => {
  // eslint-disable-next-line no-console
  consolePrint({ ...config, logFn: console.error });
};

const displayLogs = ({
  abortController,
  groupLogsLabel,
  icon,
  outputStack,
}: {
  abortController?: AbortController;
  groupLogsLabel?: string;
  icon?: string;
  outputStack: ExecuteCommandOutput[];
}): void => {
  if (!outputStack.length) {
    return;
  }

  const group = new ConsoleGroup(`${icon} ${groupLogsLabel} `, {
    abortController,
  });

  if (groupLogsLabel) {
    group.start();
  }

  outputStack.forEach(({ type, pid, data }) => {
    switch (type) {
      case ExecuteCommandOutputType.STDERR_WARN:
        consoleWarn({ type, pid, icon, data });
        break;
      case ExecuteCommandOutputType.ERROR:
      case ExecuteCommandOutputType.STDERR_ERROR:
        consoleError({ type, pid, icon, data });
        break;
      case ExecuteCommandOutputType.CLOSE:
      case ExecuteCommandOutputType.EXIT:
      case ExecuteCommandOutputType.INIT:
      case ExecuteCommandOutputType.STDOUT:
      default:
        consoleLog({ type, pid, icon, data });
        break;
    }
  });

  if (groupLogsLabel) {
    group.close();
  }
};

const containsTerminalError = (output: string): boolean =>
  STDERR_OUTPUT_DETECT_ERROR_PATTERNS.some(regExp => regExp.test(output));

let exitTimeoutId: NodeJS.Timeout;

const executeCommandSyncMode = ({
  args,
  childProcessParams,
  command,
  enqueueConsoleOutput,
  ignoreStderrErrors,
  initCommandOutput,
  outputs,
}: executeCommandSyncModeOptions): Promise<ExecuteCommandOutput[]> => {
  const syncCmd = spawnSync(command, args, childProcessParams);

  enqueueConsoleOutput({
    type: ExecuteCommandOutputType.INIT,
    pid: syncCmd.pid,
    data: initCommandOutput,
  });

  const stdoutString = syncCmd.stdout?.toString() ?? '';
  const cleanMessage = cleanOutput(stdoutString);
  if (stdoutString) {
    const output = {
      type: ExecuteCommandOutputType.STDOUT,
      pid: syncCmd.pid,
      data: cleanMessage,
    };
    outputs.push(output);
    enqueueConsoleOutput(output);
  }

  const stderrString = syncCmd.stderr?.toString() ?? '';
  if (stderrString) {
    const cleanMessage = cleanOutput(stderrString);
    const isError = !ignoreStderrErrors && containsTerminalError(cleanMessage);
    const output = {
      type: isError
        ? ExecuteCommandOutputType.STDERR_ERROR
        : ExecuteCommandOutputType.STDERR_WARN,
      pid: syncCmd.pid,
      data: cleanMessage,
    };
    outputs.push(output);
    enqueueConsoleOutput(output);

    if (isError) {
      const error = new Error(cleanMessage);
      return Promise.reject(error);
    }
  }

  enqueueConsoleOutput({
    type: ExecuteCommandOutputType.CLOSE,
    pid: syncCmd.pid,
    data: '',
  });
  return Promise.resolve(outputs);
};

const executeCommandAsyncMode = ({
  abortController,
  args,
  childProcessParams,
  command,
  enqueueConsoleOutput,
  ignoreStderrErrors,
  initCommandOutput,
  outputs,
  resolveTimeout,
  resolveTimeoutAfterFirstOutput,
}: executeCommandAsyncModeOptions): Promise<ExecuteCommandOutput[]> => {
  const cmd = spawn(command, args, childProcessParams);

  let isAborted = false;
  let resolveAfterFirstOutputId;

  abortController?.signal.addEventListener('abort', () => {
    isAborted = true;

    if (resolveAfterFirstOutputId) {
      clearTimeout(resolveAfterFirstOutputId);
    }

    cmd.kill();
    cmd.kill('SIGKILL');
  });

  enqueueConsoleOutput(
    {
      type: ExecuteCommandOutputType.INIT,
      pid: cmd.pid,
      data: initCommandOutput,
    },
    isAborted
  );

  return new Promise((resolve, reject) => {
    const resolveByTimeout = (): void => {
      enqueueConsoleOutput(
        {
          type: ExecuteCommandOutputType.STDOUT,
          pid: cmd.pid,
          data: 'Resolve on timeout, still running in background',
        },
        isAborted
      );
      resolve(outputs);
    };

    const resolveAfterFirstOutput = (): void => {
      if (resolveTimeout) {
        return;
      }

      if (!resolveTimeoutAfterFirstOutput) {
        return;
      }

      if (resolveAfterFirstOutputId) {
        return;
      }

      resolveAfterFirstOutputId = setTimeout(
        resolveByTimeout,
        resolveTimeoutAfterFirstOutput
      );
    };

    cmd.addListener('spawn', () => {
      if (resolveTimeout) {
        setTimeout(
          resolveByTimeout,
          resolveTimeout > MINIMUM_TIMEOUT ? resolveTimeout : MINIMUM_TIMEOUT
        );
      }
    });

    cmd.stdout.on('data', data => {
      const message = data instanceof Buffer ? data.toString() : data;
      const cleanMessage = cleanOutput(message);

      const output = {
        type: ExecuteCommandOutputType.STDOUT,
        pid: cmd.pid,
        data: cleanMessage,
      };

      outputs.push(output);
      enqueueConsoleOutput(output, isAborted);
      resolveAfterFirstOutput();
    });

    cmd.stderr.on('data', data => {
      const message = data instanceof Buffer ? data.toString() : data;
      const cleanMessage = cleanOutput(message);

      const isError =
        !ignoreStderrErrors && containsTerminalError(cleanMessage);

      if (isError) {
        const error = new Error(cleanMessage);
        reject(error);
        clearTimeout(resolveAfterFirstOutputId);
        enqueueConsoleOutput(
          {
            type: ExecuteCommandOutputType.STDERR_ERROR,
            pid: cmd.pid,
            data: error,
          },
          isAborted
        );
      } else {
        const isIgnoredError = isError && ignoreStderrErrors;
        const output = {
          type: ExecuteCommandOutputType.STDERR_WARN,
          pid: cmd.pid,
          data: cleanMessage,
        };

        if (!isIgnoredError) {
          outputs.push(output);
        }

        enqueueConsoleOutput(output, isAborted);
        resolveAfterFirstOutput();
      }
    });

    cmd.on('error', error => {
      reject(error);
      clearTimeout(resolveAfterFirstOutputId);
      enqueueConsoleOutput(
        {
          type: ExecuteCommandOutputType.ERROR,
          pid: cmd.pid,
          data: error,
        },
        isAborted
      );
    });

    cmd.on('close', code => {
      if (exitTimeoutId) {
        clearTimeout(exitTimeoutId);
      }
      resolve(outputs);
      clearTimeout(resolveAfterFirstOutputId);
      enqueueConsoleOutput(
        {
          type: ExecuteCommandOutputType.CLOSE,
          pid: cmd.pid,
          data: code,
        },
        isAborted
      );
    });

    cmd.on('exit', code => {
      if (exitTimeoutId) {
        clearTimeout(exitTimeoutId);
      }
      exitTimeoutId = setTimeout(() => {
        resolve(outputs);
        clearTimeout(resolveAfterFirstOutputId);
        enqueueConsoleOutput(
          {
            type: ExecuteCommandOutputType.EXIT,
            pid: cmd.pid,
            data: code,
          },
          isAborted
        );
      }, EXIT_DELAY);
    });
  });
};

export default class TerminalRepository {
  static executeCommand({
    abortController,
    addIcons = true,
    args = [],
    command,
    cwd,
    groupLogsLabel,
    ignoreStderrErrors,
    resolveTimeout,
    resolveTimeoutAfterFirstOutput,
    syncMode,
    traceOnTime,
  }: ExecuteCommandOptions): Promise<ExecuteCommandOutput[]> {
    if (!cwd) {
      throw new Error('cwd is required');
    }

    if (abortController?.signal?.aborted) {
      throw new Error('Process was aborted');
    }

    const childProcessParams = {
      cwd,
      env: process.env,
      shell: ['win32'].includes(process.platform) ? 'powershell' : true,
      signal: abortController?.signal,
    };

    const icon = addIcons
      ? OutputIcons[Math.floor(Math.random() * OutputIcons.length)]
      : '';

    const argsAsString = args.join(' ');
    const initCommandOutput = `\n   CWD: ${cwd}\n   CMD: ${command} ${argsAsString}`;
    const outputs: ExecuteCommandOutput[] = [];

    let outputStack: ExecuteCommandOutput[] = [];

    const enqueueConsoleOutput = (
      output: ExecuteCommandOutput,
      isAborted?: boolean
    ): void => {
      if (isAborted) {
        return;
      }

      outputStack.push(output);

      const mustDisplay =
        traceOnTime ||
        output.type === ExecuteCommandOutputType.CLOSE ||
        output.type === ExecuteCommandOutputType.EXIT;

      if (mustDisplay) {
        displayLogs({
          abortController,
          groupLogsLabel,
          icon,
          outputStack,
        });
        outputStack = [];
      }
    };

    if (syncMode) {
      return executeCommandSyncMode({
        args,
        childProcessParams,
        command,
        enqueueConsoleOutput,
        ignoreStderrErrors,
        initCommandOutput,
        outputs,
      });
    }

    return executeCommandAsyncMode({
      args,
      childProcessParams,
      command,
      enqueueConsoleOutput,
      ignoreStderrErrors,
      initCommandOutput,
      outputs,
      resolveTimeout,
      resolveTimeoutAfterFirstOutput,
    });
  }
}
