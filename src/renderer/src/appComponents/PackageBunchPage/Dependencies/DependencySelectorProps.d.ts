import { type DependencyMode } from '@renderer/models/DependencyConstants';
import type DependencyPackage from '@renderer/models/DependencyPackage';
import PackageScript from '@renderer/models/PackageScript';

export type DependencySelectorProps = {
  disabled?: boolean;
  dependency: DependencyPackage;
  isTargetSynchronizable: boolean;
  onClickRemove: (dependency: DependencyPackage) => void;
  onGitPullChange: (dependency: DependencyPackage, checked?: boolean) => void;
  onPathChange: (
    dependency: DependencyPackage,
    cwd: string,
    isValidPackage: boolean
  ) => void;
  onModeChange: (
    dependency: DependencyPackage,
    mode: (typeof DependencyMode)[keyof typeof DependencyMode]
  ) => void;
  onScriptsChange: (
    dependency: DependencyPackage,
    scripts: PackageScript[]
  ) => void;
};
