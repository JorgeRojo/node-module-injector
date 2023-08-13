import { CSSProperties } from 'react';

import type DependencyPackage from './DependencyPackage';
import TargetPackage from './TargetPackage';

export default class PackageBunch {
  private _id = crypto.randomUUID();

  public get id(): string {
    return this._id;
  }
  public name?: string;
  public color?: CSSProperties['color'];
  public active = false;
  public targetPackage: TargetPackage = new TargetPackage();
  public dependencies: DependencyPackage[] = [];

  public resetId(): void {
    this._id = crypto.randomUUID();
  }

  public clone(): PackageBunch {
    const packageBunch = new PackageBunch();
    packageBunch.resetId();
    packageBunch.name = this.name;
    packageBunch.color = this.color;
    packageBunch.active = this.active;
    packageBunch.targetPackage = this.targetPackage.clone();
    packageBunch.dependencies = this.dependencies.map(dependency =>
      dependency.clone()
    );
    return packageBunch;
  }
}
