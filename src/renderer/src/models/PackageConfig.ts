import { v4 as uuid } from 'uuid';

export default class PackageConfig {
  public id = uuid();

  public cwd?: string;
  public isValidPackage = false;
  public performGitPull = false;
  public performYarnInstall = false;

  public clone(): PackageConfig {
    const clone = new PackageConfig();

    clone.id = this.id;

    clone.cwd = this.cwd;
    clone.isValidPackage = this.isValidPackage;
    clone.performGitPull = this.performGitPull;
    clone.performYarnInstall = this.performYarnInstall;

    return clone;
  }
}
