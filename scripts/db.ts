/**
 * Local development database: a real PostgreSQL 17 server running from node_modules,
 * data kept in ./.data/pg. Production uses a regular managed/installed PostgreSQL instead.
 *
 *   npm run db         start (initialises the cluster on first run)
 *   npm run db stop    stop
 *
 * pg_ctl is used instead of starting postgres.exe directly: on Windows it drops
 * administrator rights, which postgres otherwise refuses to run with.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = 5433;
const PASSWORD = "postgres";

const platform = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
const bin = join(process.cwd(), "node_modules", "@embedded-postgres", platform, "native", "bin");
const exe = (name: string) => join(bin, process.platform === "win32" ? `${name}.exe` : name);

const dataRoot = join(process.cwd(), ".data");
const dataDir = join(dataRoot, "pg");
const logFile = join(dataRoot, "postgres.log");

function run(name: string, args: string[]) {
  execFileSync(exe(name), args, { stdio: "inherit" });
}

function isRunning() {
  try {
    execFileSync(exe("pg_ctl"), ["status", "-D", dataDir], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[2] === "stop") {
  if (isRunning()) run("pg_ctl", ["stop", "-D", dataDir, "-m", "fast"]);
  process.exit(0);
}

if (!existsSync(join(dataDir, "PG_VERSION"))) {
  mkdirSync(dataRoot, { recursive: true });
  const pwFile = join(dataRoot, "pwfile");
  writeFileSync(pwFile, PASSWORD);
  try {
    run("initdb", ["-D", dataDir, "-U", "postgres", "--pwfile", pwFile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
  } finally {
    rmSync(pwFile, { force: true });
  }
}

if (isRunning()) {
  console.log(`PostgreSQL is already running on 127.0.0.1:${PORT}`);
} else {
  // stdio must not be inherited: the detached server would keep this terminal's handles open
  execFileSync(exe("pg_ctl"), ["start", "-D", dataDir, "-l", logFile, "-w", "-o", `-p ${PORT} -c listen_addresses=127.0.0.1`], {
    stdio: "ignore",
  });
  console.log(`PostgreSQL ready on 127.0.0.1:${PORT}. Stop it with: npm run db stop`);
}
