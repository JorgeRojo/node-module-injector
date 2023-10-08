import { useContext, useState } from 'react';

import { Button, Icons, Spinner, ToasterListContext } from 'fratch-ui';
import { ToasterType } from 'fratch-ui/components/Toaster/ToasterConstants';
import { c } from 'fratch-ui/helpers/classNameHelpers';
import useDeepCompareEffect from 'use-deep-compare-effect';

import StartService from '../../services/RunService/StartService';
import useGlobalData from '../GlobalDataProvider/useGlobalData';

import styles from './RunProcess.module.css';

const STATUSES = {
  IDLE: { value: 'idle', label: 'Idle' } as const,
  FAILURE: { value: 'failure', label: 'Failure' } as const,
  SUCCESS: { value: 'success', label: 'Success' } as const,
  RUNNING: { value: 'running', label: 'Running' } as const,
  BUILDING: { value: 'building', label: 'Building' } as const,
  BUILDING_DEPENDENCIES: {
    value: 'building_dependencies',
    label: 'Building Dependencies',
  } as const,
  SYNCING: {
    value: 'syncing',
    label: 'Syncing',
  },
  SYNC_PREPARE: {
    value: 'sync_prepare',
    label: 'Preparing for syncing',
  },
  AFTER_BUILD: {
    value: 'after_build',
    label: 'Running after build',
  } as const,
} as const;

type STATUS = (typeof STATUSES)[keyof typeof STATUSES];

export default function RunProcess(): JSX.Element {
  const { addToaster } = useContext(ToasterListContext);
  const {
    additionalPackageScripts,
    activeTargetPackage,
    activeDependencies,
    isWSLActive,
  } = useGlobalData();

  const [status, setStatus] = useState<STATUS>(STATUSES.IDLE);
  const [abortController, setAbortController] =
    useState<AbortController | null>();

  useDeepCompareEffect(() => {
    let isSyncing = false;
    const handleAbort = (): void => {
      console.log('>>>----->> handleAbort', { isSyncing });
      // TODO: stop sync by SyncProcessService
    };

    const run = async (): Promise<void> => {
      const mustRun =
        abortController?.signal != null && !abortController.signal.aborted;

      if (!mustRun) {
        return;
      }

      abortController.signal.addEventListener('abort', handleAbort);

      setStatus(STATUSES.RUNNING);

      const output = await StartService.run({
        additionalPackageScripts,
        targetPackage: activeTargetPackage,
        dependencies: activeDependencies,
        abortController,
        isWSLActive,
        onTargetBuildStart: () => {
          setStatus(STATUSES.BUILDING);
        },
        onDependenciesBuildStart: () => {
          setStatus(STATUSES.BUILDING_DEPENDENCIES);
        },
        onAfterBuildStart: () => {
          setStatus(STATUSES.AFTER_BUILD);
        },
        onDependenciesSyncPrepare: () => {
          setStatus(STATUSES.SYNC_PREPARE);
          isSyncing = true;
        },
        onDependenciesSyncStart: () => {
          setStatus(STATUSES.SYNCING);
        },
      });

      const hasErrors = output.some(({ error }) => !!error);
      output.forEach(({ title, content, error }, index) => {
        const type = error
          ? ToasterType.ERROR
          : hasErrors
          ? ToasterType.INFO
          : ToasterType.SUCCESS;
        const isError = type === ToasterType.ERROR;
        const duration = isError ? 15000 : 3000;
        addToaster({
          title,
          message: content || error || '',
          type,
          nlToBr: true,
          duration: duration + index * 200,
          stoppable: isError,
        });
      });

      if (!isSyncing) {
        setStatus(hasErrors ? STATUSES.FAILURE : STATUSES.SUCCESS);
        setAbortController(null);
      }
    };

    run();

    return (): void => {
      abortController?.signal.removeEventListener('abort', handleAbort);
    };
  }, [
    additionalPackageScripts,
    addToaster,
    activeTargetPackage,
    activeDependencies,
    abortController,
    isWSLActive,
  ]);

  const handleRunClick = (): void => {
    setAbortController(new AbortController());
  };

  const handleStopClick = (): void => {
    abortController?.abort();
    setStatus(STATUSES.IDLE);
    setAbortController(null);
  };

  const processMsg = status.label;
  const isBuilding = (
    [
      STATUSES.AFTER_BUILD.value,
      STATUSES.BUILDING_DEPENDENCIES.value,
      STATUSES.RUNNING.value,
      STATUSES.BUILDING.value,
    ] as string[]
  ).includes(status.value);
  const isSyncing =
    status.value === STATUSES.SYNC_PREPARE.value ||
    status.value === STATUSES.SYNCING.value;

  const isRunning = isBuilding || isSyncing;

  const isRunEnabled =
    activeTargetPackage?.isValidPackage &&
    activeDependencies?.every(d => d.isValidPackage);

  return (
    <>
      {isRunning && (
        <Spinner
          cover
          inverted={isSyncing}
          type={isSyncing ? 'primary' : 'secondary'}
          label={processMsg}
        />
      )}
      {!isRunning ? (
        <Button
          disabled={!isRunEnabled}
          Icon={Icons.IconPlay}
          className={c(styles.run_button)}
          label="Run"
          type="primary"
          onClick={handleRunClick}
        />
      ) : (
        <Button
          Icon={Icons.IconPause}
          className={c(styles.stop_button)}
          label="Pause"
          type={isSyncing ? 'tertiary' : 'secondary'}
          onClick={handleStopClick}
        />
      )}
    </>
  );
}
