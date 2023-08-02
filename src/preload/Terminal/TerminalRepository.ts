import { spawn } from 'child_process';

import {
  ExecuteCommandOutputType,
  OutputBadIcons,
  OutputColor,
  OutputGoodIcons,
  OutputTypeToColor,
} from './TerminalConstants';
import {
  type ExecuteCommandOptions,
  type ExecuteCommandOutput,
} from './TerminalTypes';

const cleanOutput = (output: string): string =>
  output.replace(/[^a-z0-9-\n\s\r\t{}()"',:_\\/\\*+.@]/gi, '').trim();

const getConsoleInitColorizedFlag = (
  type: ExecuteCommandOutput['type'],
  icon: string
): string[] => {
  const typeColor = OutputTypeToColor[type];
  return [
    `%c> terminal ${icon} %c${type}`,
    `color:${OutputColor}`,
    `color:${typeColor}`,
  ];
};

const consoleLog = (
  type: ExecuteCommandOutput['type'],
  icon: string,
  ...params
): void =>
  // eslint-disable-next-line no-console
  console.log(...getConsoleInitColorizedFlag(type, icon), ...params);
const consoleError = (
  type: ExecuteCommandOutput['type'],
  icon: string,
  ...params
): void =>
  // eslint-disable-next-line no-console
  console.error(...getConsoleInitColorizedFlag(type, icon), ...params);

const displayLogs = (outputStack: ExecuteCommandOutput[]): void => {
  const hasErrors = outputStack.some(
    ({ type }) =>
      type === ExecuteCommandOutputType.ERROR ||
      type === ExecuteCommandOutputType.STDERR_ERROR
  );
  const randIcon = hasErrors
    ? OutputBadIcons[Math.floor(Math.random() * OutputBadIcons.length)]
    : OutputGoodIcons[Math.floor(Math.random() * OutputGoodIcons.length)];

  outputStack.forEach(({ type, data }) => {
    switch (type) {
      case ExecuteCommandOutputType.CLOSE:
      case ExecuteCommandOutputType.EXIT:
      case ExecuteCommandOutputType.INIT:
      case ExecuteCommandOutputType.STDOUT:
        consoleLog(type, randIcon, data);
        break;
      case ExecuteCommandOutputType.ERROR:
      case ExecuteCommandOutputType.STDERR_ERROR:
        consoleError(type, randIcon, data);
        break;
      default:
        break;
    }
  });
};

const exitDelay = 500;
let exitTimeoutId: NodeJS.Timeout;
export default class TerminalRepository {
  static executeCommand({
    command,
    args = [],
    cwd,
  }: ExecuteCommandOptions): Promise<ExecuteCommandOutput[]> {
    return new Promise((resolve, reject) => {
      if (!cwd) {
        reject(new Error('cwd is required'));
      }

      const commandTrace = `${cwd} ${command} ${args.join(' ')}`;
      const outputs: ExecuteCommandOutput[] = [];
      const outputStack: ExecuteCommandOutput[] = [];
      outputStack.push({
        type: ExecuteCommandOutputType.INIT,
        data: commandTrace,
      });

      const soShell = ['win32'].includes(process.platform)
        ? 'powershell'
        : 'bash';

      const cmd = spawn(command, args, {
        cwd,
        env: process.env,
        shell: soShell,
      });

      cmd.stdout.on('data', data => {
        const message = data instanceof Buffer ? data.toString() : data;
        const cleanMessage = cleanOutput(message);
        const output = {
          type: ExecuteCommandOutputType.STDOUT,
          data: cleanMessage,
        };
        outputs.push(output);
        outputStack.push(output);
      });

      cmd.stderr.on('data', data => {
        const message = data instanceof Buffer ? data.toString() : data;
        const cleanMessage = cleanOutput(message);
        const isError = [
          new RegExp('fatal:', 'gi'),
          new RegExp('error', 'gi'),
          new RegExp('command not found', 'gi'),
        ].some(regExp => regExp.test(cleanMessage));

        if (isError) {
          const error = new Error(cleanMessage);
          const output = {
            type: ExecuteCommandOutputType.STDERR_ERROR,
            data: error,
          };
          outputStack.push(output);
          displayLogs(outputStack);
          reject(error);
        } else {
          const output = {
            type: ExecuteCommandOutputType.STDERR_WARN,
            data: cleanMessage,
          };
          outputs.push(output);
          outputStack.push(output);
        }
      });

      cmd.on('error', error => {
        const output = {
          type: ExecuteCommandOutputType.ERROR,
          data: error,
        };
        outputStack.push(output);
        displayLogs(outputStack);
        reject(error);
      });

      cmd.on('close', code => {
        if (exitTimeoutId) {
          clearTimeout(exitTimeoutId);
        }
        const output = {
          type: ExecuteCommandOutputType.CLOSE,
          data: code,
        };
        outputStack.push(output);
        displayLogs(outputStack);
        resolve(outputs);
      });

      cmd.on('exit', code => {
        if (exitTimeoutId) {
          clearTimeout(exitTimeoutId);
        }
        exitTimeoutId = setTimeout(() => {
          const output = {
            type: ExecuteCommandOutputType.EXIT,
            data: code,
          };
          outputStack.push(output);
          displayLogs(outputStack);
          resolve(outputs);
        }, exitDelay);
      });
    });
  }
}
