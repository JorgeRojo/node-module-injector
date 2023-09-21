import { promiseAllSequentially } from '@renderer/helpers/promisesHelpers';
import DependencyPackage from '@renderer/models/DependencyPackage';
import NodePackage from '@renderer/models/NodePackage';
import GitService from '@renderer/services/GitService';
import { type TerminalResponse } from '@renderer/services/TerminalService';

import BuildProcessService from './BuildProcessService';
import NodeService from './NodeService/NodeService';
import { RelatedDependencyProjection } from './NodeService/NodeServiceTypes';
import PathService from './PathService';

type ProcessServiceResponse = TerminalResponse & { title: string };

const hasError = (responses: ProcessServiceResponse[]): boolean =>
  responses.some(response => Boolean(response.error));

export default class RunProcessService {
  public static async run({
    targetPackage,
    dependencies,
    abortController,
    isWSLActive,
  }: {
    targetPackage: NodePackage;
    dependencies: DependencyPackage[];
    abortController?: AbortController;
    isWSLActive?: boolean;
  }): Promise<ProcessServiceResponse[]> {
    const tmpDir = await PathService.getTmpDir({
      isWSLActive,
      skipWSLRoot: true,
      traceOnTime: true,
    });
    if (!tmpDir) {
      abortController?.abort();
      return [
        {
          error: 'Temporals (/tmp) system directory is not reachable',
          title: 'System error',
        },
      ];
    }

    const outputTitle = 'Invalid package';

    if (!targetPackage.cwd) {
      abortController?.abort();
      return [{ error: 'Package cwd is not valid', title: outputTitle }];
    }

    const cwd = targetPackage.cwd ?? '';

    const packageName = await NodeService.getPackageName(cwd);
    if (!packageName) {
      abortController?.abort();
      return [
        {
          error: 'There is no dependency name in package.json',
          title: outputTitle,
        },
      ];
    }

    // package git pull
    const gitPullResponses = await RunProcessService.gitPullPackage({
      nodePackage: targetPackage,
      packageName,
    });
    if (hasError(gitPullResponses)) {
      abortController?.abort();
      return gitPullResponses;
    }

    // Run package scripts
    const scriptsResponses = await BuildProcessService.runPackageScripts({
      packageScripts: targetPackage.scripts,
      cwd,
      packageName,
      abortController,
    });
    if (hasError(scriptsResponses)) {
      abortController?.abort();
      return scriptsResponses;
    }

    // Run dependencies in build mode
    const dependenciesResponses = await RunProcessService.runDependencies({
      dependencies,
      tmpDir,
      abortController,
    });
    if (hasError(dependenciesResponses.flat())) {
      abortController?.abort();
      return dependenciesResponses.flat();
    }

    // Inject dependencies
    const injectDependenciesResponses =
      await BuildProcessService.injectDependencies({
        targetPackage,
        dependencies,
        tmpDir,
        abortController,
      });
    if (hasError(injectDependenciesResponses)) {
      abortController?.abort();
      return injectDependenciesResponses;
    }

    return dependenciesResponses.flat();
  }

  private static async gitPullPackage({
    nodePackage,
    packageName,
  }: {
    nodePackage: NodePackage;
    packageName: string;
  }): Promise<ProcessServiceResponse[]> {
    if (nodePackage.performGitPull) {
      const output = await GitService.pull(nodePackage.cwd ?? '');

      if (output.error) {
        return [{ ...output, title: `Git pull: ${packageName}` }];
      }
    }

    return [];
  }

  private static async runDependencies({
    dependencies,
    tmpDir,
    abortController,
  }: {
    dependencies: DependencyPackage[];
    tmpDir: string;
    abortController?: AbortController;
  }): Promise<ProcessServiceResponse[][]> {
    const sortedRelatedDependencies =
      await NodeService.getDependenciesSortedByHierarchy(dependencies);

    const gitPullDependenciesResponses =
      await RunProcessService.gitPullDependencies(sortedRelatedDependencies);

    if (hasError(gitPullDependenciesResponses.flat())) {
      abortController?.abort();
      return gitPullDependenciesResponses;
    }

    const dependenciesResponses = await BuildProcessService.buildDependencies({
      sortedRelatedDependencies,
      tmpDir,
      abortController,
    });

    return dependenciesResponses;
  }

  private static async gitPullDependencies(
    sortedRelatedDependencies: RelatedDependencyProjection[]
  ): Promise<ProcessServiceResponse[][]> {
    const gitPullDependenciesPromises = sortedRelatedDependencies.map(
      ({ dependencyName, dependency }) =>
        () =>
          RunProcessService.gitPullPackage({
            nodePackage: dependency,
            packageName: dependencyName,
          })
    );
    const gitPullDependenciesResponses = await promiseAllSequentially<
      ProcessServiceResponse[]
    >(gitPullDependenciesPromises);

    return gitPullDependenciesResponses;
  }
}
