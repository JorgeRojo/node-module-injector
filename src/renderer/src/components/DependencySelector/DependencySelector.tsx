import PackageSelector from '../PackageSelector/PackageSelector';
import { c } from 'fratch-ui/helpers/classNameHelpers';
import { Button, InputCheck } from 'fratch-ui';
import DependencyConfig, {
  DependencyMode,
} from '@renderer/models/DependencyConfig';
import IconClose from 'fratch-ui/components/Icon/IconClose';

import styles from './DependencySelector.module.css';

function DependencySelector({
  disabled,
  dependencyConfig,
  excludedDirectories,
  onClickRemove,
  onGitPullChange,
  onPathChange,
  onSyncModeChange,
  onYarnInstallChange,
}: {
  disabled?: boolean;
  dependencyConfig: DependencyConfig;
  excludedDirectories: string[];
  onClickRemove?: (dependencyConfig: DependencyConfig) => void;
  onGitPullChange: (
    dependencyConfig: DependencyConfig,
    checked?: boolean
  ) => void;
  onPathChange: (
    dependencyConfig: DependencyConfig,
    cwd: string,
    isValidPackage: boolean
  ) => void;
  onSyncModeChange: (
    dependencyConfig: DependencyConfig,
    mode: (typeof DependencyMode)[keyof typeof DependencyMode]
  ) => void;
  onYarnInstallChange: (
    dependencyConfig: DependencyConfig,
    checked?: boolean
  ) => void;
}): JSX.Element {
  const handlePathChange = (cwd: string, isValidPackage): void => {
    onPathChange(dependencyConfig, cwd, isValidPackage);
  };

  return (
    <div className={c(styles.dependency)}>
      <PackageSelector
        disabled={disabled}
        excludedDirectories={excludedDirectories}
        additionalComponent={
          <InputCheck
            disabled={disabled}
            checked={dependencyConfig.mode === DependencyMode.SYNC}
            label="sync mode"
            onChange={(event): void => {
              onSyncModeChange(
                dependencyConfig,
                event.target.checked
                  ? DependencyMode.SYNC
                  : DependencyMode.BUILD
              );
            }}
          />
        }
        packageConfig={dependencyConfig}
        onPathChange={handlePathChange}
        onGitPullChange={(checked): void => {
          onGitPullChange(dependencyConfig, checked);
        }}
        onYarnInstallChange={(checked): void => {
          onYarnInstallChange(dependencyConfig, checked);
        }}
      />
      {onClickRemove && (
        <div className={c(styles.buttons)}>
          <Button
            disabled={disabled}
            size="small"
            label="Remove dependencyConfig"
            onClick={(): void => onClickRemove(dependencyConfig)}
            Icon={IconClose}
            isRound
          />
        </div>
      )}
    </div>
  );
}

export default DependencySelector;
