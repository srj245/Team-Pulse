const { spawn } = require("child_process");
const path = require("path");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        DB_PROVIDER: "mongo",
      },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function main() {
  const nodeCommand = process.execPath;

  if (process.platform === "win32") {
    await run("cmd.exe", ["/d", "/s", "/c", "npm run test:unit"]);
  } else {
    await run("npm", ["run", "test:unit"]);
  }
  await run(nodeCommand, ["scripts/smoke-test.js"]);
  await run(nodeCommand, ["scripts/security-test.js"]);
  await run(nodeCommand, ["scripts/auth-test.js"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
