// This script is used to update submodules in a GitHub repository.

const core = require('@actions/core');
const exec = require('@actions/exec');

async function main() {
  async function gitExec(cmd, extraOptions) {
    let output = '';

    const options = {
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data) => {
          output += data.toString();
        }
      }
    };

    if (extraOptions && Object.hasOwn(extraOptions, 'cwd')) {
      options.cwd = extraOptions.cwd;
    }

    const returnCode = await exec.exec('git', cmd, options);

    return {
      returnCode: returnCode,
      output: output
    };
  }

  async function getSubmodulePaths() {
    const { output } = await gitExec(['config', '--file', '.gitmodules', '--get-regexp', 'path']);

    let submodules = [];

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('.path')) {
        submodules.push(line.split('.path')[1].trim());
      }
    }

    return submodules;
  }

  function getInputRef(submodulePath) {
    const input_submodules = core.getInput('submodules');
    const ref = input_submodules.split('\n').find((line) => line.includes(submodulePath));
    return ref ? ref.split(':')[1].trim() : null;
  }

  async function updateSubmodule(submodulePath, ref) {
    console.log(`Checking out ${ref} in submodule at ${submodulePath}`);
    await gitExec(['checkout', ref], { cwd: submodulePath });
  }

  async function addChanges(submodulePath, ref) {
    const { returnCode } = await gitExec(['diff', '--exit-code']);
    if (returnCode === 1) {
      console.log(`${submodulePath} has been updated`);

      await gitExec(['add', submodulePath]);
      return `${submodulePath} to ${ref}`;
    } else {
      console.log(`${submodulePath} has NOT been updated`);
    }

    return null;
  }

  const submodulePaths = await getSubmodulePaths();

  let updatedMessage = [];

  for (const i in submodulePaths) {
    const submodulePath = submodulePaths[i];

    console.log(`Found submodule at ${submodulePath}`);

    const ref = getInputRef(submodulePath);
    if (!ref) {
      console.log(`Skipping ${submodulePath}, no input ref specified\n`);
      continue;
    }

    await updateSubmodule(submodulePath, ref);

    const message = await addChanges(submodulePath, ref);
    if (message) {
      updatedMessage.push(message);
    }

    console.log();
  }

  if (updatedMessage.length !== 0) {
    await gitExec(['config', 'user.name', 'github-actions']);
    await gitExec(['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);

    console.log('Committing changes');

    const message = `Update submodules:\n${updatedMessage.join('\n')}`;

    await gitExec(['commit', '-m', message]);
  }
}

main();

