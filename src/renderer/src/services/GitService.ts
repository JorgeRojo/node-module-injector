import PathService from './PathService';
import TerminalService, { type TerminalResponse } from './TerminalService';

const REMOTE_BRANCH_PATTERN = new RegExp(`(.*remotes/origin/)(.*)`);

const isValidBranch = (line: string): boolean =>
  REMOTE_BRANCH_PATTERN.test(line) && !line.includes('HEAD -');

const getLocalBranch = (line: string): string =>
  line.replace(REMOTE_BRANCH_PATTERN, '$2');

export default class GitService {
  static async executeCommand(
    cwd: string,
    gitCommand: string | string[]
  ): Promise<TerminalResponse> {
    return await TerminalService.executeCommand({
      command: 'git',
      args: [gitCommand].flat(),
      cwd,
    });
  }

  static async checkout(
    cwd: string,
    branch: string
  ): Promise<TerminalResponse> {
    return await TerminalService.executeCommand({
      command: 'git',
      args: ['checkout', branch],
      cwd,
    });
  }

  static async pull(cwd: string): Promise<TerminalResponse> {
    return await TerminalService.executeCommand({
      command: 'git',
      args: ['pull'],
      cwd,
    });
  }

  static async getCurrentBranch(
    cwd: string,
    abortController?: AbortController,
    ignoreStderrErrors?: boolean
  ): Promise<string> {
    const { content } = await TerminalService.executeCommand({
      command: 'git',
      args: ['rev-parse', '--abbrev-ref', 'HEAD'],
      cwd,
      abortController,
      ignoreStderrErrors,
    });
    const value = (content ?? '').trim();
    return value;
  }

  static async getBranches(
    cwd: string,
    abortController?: AbortController
  ): Promise<string[]> {
    const { content } = await TerminalService.executeCommand({
      command: 'git',
      args: ['branch', '-l', '-a'],
      cwd,
      abortController,
    });
    const value = (content ?? '')
      .split('\n')
      .map(line => (isValidBranch(line) ? getLocalBranch(line) : ''))
      .filter(value => value)
      .toSorted();
    return value;
  }

  static async gitignoreAdd(
    cwd: string,
    paths: string[],
    abortController?: AbortController
  ): Promise<TerminalResponse> {
    return await TerminalService.executeCommand({
      command: 'bash',
      args: [
        PathService.getExtraResourcesScriptPath('node_pi_gitignore_add.sh'),
        ...paths.map(cwd => `"${cwd}"`),
      ],
      cwd,
      abortController,
    });
  }

  static async checkGit(
    cwd: string,
    abortController?: AbortController
  ): Promise<boolean> {
    try {
      const branch = await GitService.getCurrentBranch(
        cwd,
        abortController,
        true
      );
      return Boolean(branch);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return false;
    }
  }
}
