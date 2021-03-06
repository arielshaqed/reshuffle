import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'jju';
import once from 'lodash.once';
import { execSync } from 'child_process';

interface RushConfig {
  rushVersion: string;
  projects: Array<{
    packageName: string,
    projectFolder: string,
  }>;
}

const importInstallRunScript = once(() => import(join(process.cwd(), './common/scripts/install-run')));
const getRushConfig = once(async () => {
  const { findRushJsonFolder, RUSH_JSON_FILENAME } = await importInstallRunScript();
  const rushConfigContent = readFileSync(join(findRushJsonFolder(), RUSH_JSON_FILENAME), 'utf-8');
  return parse(rushConfigContent) as RushConfig;
});

const getRushVersion = once(() => getRushConfig().then((cfg) => cfg.rushVersion));
export const getProjectFolders = async (excludePackages: string[]) => {
  const { projects } = await getRushConfig();
  return projects.filter((p) => !excludePackages.includes(p.packageName)).map((p) => p.projectFolder);
};

export async function updateRushShrinkwrapFile(): Promise<void> {
  const { installAndRun } = await importInstallRunScript();
  const statusCode = installAndRun('@microsoft/rush', await getRushVersion(), 'rush', ['update', '--full']);
  if (statusCode !== 0) {
    throw new Error(`'rush update' exited with code ${statusCode}`);
  }
}

export function generateRushChangeFiles(): void {
  // yes "" is for answering all the "Describe changes, or ENTER if no changes" questions with ENTER
  execSync('yes "" | node common/scripts/install-run-rush.js change', {
    stdio: 'inherit',
  });
}
