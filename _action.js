const { Octokit } = require("@octokit/rest");
const core = require("@actions/core");
const glob = require("@actions/glob");
const io = require("@actions/io");
const exec = require("@actions/exec");


const github = new Octokit({
  auth: "ghp_xxxxxx",
  userAgent: "github-actions"
});

const context = {
  repo: {
    owner: "btinworth",
    repo: "test-proj"
  },
  //sha: ""
}

async function main() {

  const inputs = {
    submodules: `
      modules/submodule1: main
      modules/submodule2: test-branch
      `
  };

  async function getSubmodulePaths() {
    let submodules = [];

    const options = {
      silent: true,
      listeners: {
        stdout: (data) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (line.includes(".path")) {
              submodules.push(line.split(".path")[1].trim());
            }
          }
        }
      }
    };

    await exec.exec("git", ["config", "--file", ".gitmodules", "--get-regexp", "path"], options);

    return submodules;
  }

  function getInputRef(submodulePath) {
    const ref = inputs.submodules.split("\n").find((line) => line.includes(submodulePath));
    return ref ? ref.split(":")[1].trim() : null;
  }

  async function updateSubmodule(submodulePath, ref) {

    console.log(`Checking out ${ref} in submodule at ${submodulePath}`);

    const options = {
      silent: true,
      cwd: submodulePath
    };

    await exec.exec("git", ["checkout", ref], options);
  }

  const submodulePaths = await getSubmodulePaths();

  let updated = [];

  for (const i in submodulePaths) {
    const submodulePath = submodulePaths[i];

    console.log(`Found submodule at ${submodulePath}`);

    const ref = getInputRef(submodulePath);
    if (!ref) {
      console.log(`Skipping ${submodulePath}, no input ref specified`);
      continue;
    }

    await updateSubmodule(submodulePath, ref);

    if (await exec.exec("git", ["diff", "--exit-code", submodulePath], { silent: true, ignoreReturnCode: true }) == 1) {
      console.log(`${submodulePath} has been updated`);

      await exec.exec("git", ["add", submodulePath], { silent: true });
      updated.push(`${submodulePath} to ${ref}`);
    } else {
      console.log(`${submodulePath} has NOT been updated`);
    }

    console.log();
  }

  if (updated.length !== 0) {
    await exec.exec("git", ["config", "user.name", "github-actions"], { silent: true });
    await exec.exec("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"], { silent: true });

    console.log("Committing changes");

    const message = `Update submodules:\n${updated.join("\n")}`;

    await exec.exec("git", ["commit", "-m", message], { silent: true });
  }

}

main();

