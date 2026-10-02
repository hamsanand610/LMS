#!/usr/bin/env python3
"""The sandbox harness: compiles and runs one job inside a throwaway container.

It is part of the image and is trusted; the learner's code is data it writes under /work. The
runner service (apps/runner) starts one container per job with no network, a read-only root,
no capabilities and CPU, memory and process limits, pipes the job in and reads one JSON document
back. Expected outputs are never sent here: the API compares what this prints with what it holds.

Job, on standard input (validated by the runner against sandboxJobSchema in packages/shared):
  {"language": "java" | "python" | "javascript" | "php" | "sql" | "web",
   "code": "...",
   "cases": [{"id": "...", "stdin": "...", "timeMs"?: n, "memoryMb"?: n}],
   "limits": {"timeMs": 5000, "memoryMb": 128, "outputBytes": 65536},
   "sql": {"setup": "...", "check": "..."}}            # sql only; "stdin" is the case's own setup
For "web" the code is the encoded bundle of the page's files and each case's "stdin" is one
structured check (ADR-0019).

Result, on standard output:
  {"compile": {"ok": true, "output": "", "durationMs": 0},
   "cases": [{"id", "stdout", "stderr", "exitCode", "signal", "timedOut", "memoryExceeded",
              "durationMs", "memoryKb", "truncated"}]}
A case's durationMs is the CPU time it used, which is also what its time limit is judged on.

Nothing a case starts outlives it: once a case's program has exited, every other process the
sandbox user still has is stopped before the next step runs.
"""

import ctypes
import json
import os
import resource
import signal
import subprocess
import sys
import time

WORK = "/work"
HARNESS_VERSION = 1
COMPILE_TIMEOUT_S = 30
COMPILE_OUTPUT_BYTES = 16 * 1024

# What each runtime needs before the learner's first line runs, added to the time allowance.
# A web page's allowance covers loading jsdom and the page, which happen before its scripts run.
STARTUP_MS = {"java": 1500, "python": 400, "javascript": 500, "php": 400, "sql": 500, "web": 4000}
# A case is judged on the CPU time it uses, so a busy or cold host cannot fail a correct answer.
# The wall clock is only a backstop, for code that waits instead of computing: twice the CPU
# allowance plus this slack. apps/runner (docker-args.ts) and the API size their deadlines on it.
WALL_FACTOR = 2
WALL_SLACK_MS = 2000

# The Web Lab's checker (webcheck.js) runs once per job, after the pages, on the harness's limits,
# not the learner's: a page's time limit is for the page. Its wall clock is counted once per case
# in every deadline (packages/shared caseWallMs), which leaves the runner and the API room to spare.
WEB_JUDGE_TIME_MS = 10_000
WEB_JUDGE_MEMORY_MB = 256
WEB_JUDGE_WALL_MS = 25_000
WEB_SNAPSHOT_BYTES = 4 * 1024 * 1024
# How many times the sweep looks again for processes that are still being started.
SWEEP_ROUNDS = 50


def cpu_allowance_ms(language, time_ms):
    return time_ms + STARTUP_MS[language]


def wall_allowance_s(language, time_ms):
    return (cpu_allowance_ms(language, time_ms) * WALL_FACTOR + WALL_SLACK_MS) / 1000


def case_wall_s(language, time_ms):
    """Everything one case may take on the wall clock, the web checker included."""
    extra = WEB_JUDGE_WALL_MS / 1000 if language == "web" else 0
    return wall_allowance_s(language, time_ms) + extra


SOURCE = {
    "java": "Main.java",
    "python": "main.py",
    "javascript": "main.js",
    "php": "main.php",
    "sql": "query.sql",
    "web": "bundle.json",
}
MEMORY_MARKERS = (
    "java.lang.OutOfMemoryError",
    "MemoryError",
    "heap out of memory",
    "Allowed memory size of",
)
ENV = {"PATH": os.environ.get("PATH", ""), "HOME": f"{WORK}/tmp", "LANG": "C.UTF-8"}


def protect_self():
    """Stop the code under test reading this process's descriptors or attaching to it."""
    try:
        ctypes.CDLL(None).prctl(4, 0, 0, 0, 0)  # PR_SET_DUMPABLE = 4
    except Exception:
        pass


def command(language, memory_mb):
    if language == "java":
        return [
            "java",
            "-XX:-UsePerfData",
            "-XX:+UseSerialGC",
            "-XX:TieredStopAtLevel=1",
            "-Xss32m",
            f"-Xmx{memory_mb}m",
            f"-Djava.io.tmpdir={WORK}/tmp",
            "-cp",
            f"{WORK}/classes",
            "Main",
        ]
    if language == "python":
        return ["python3", "-I", f"{WORK}/main.py"]
    if language == "javascript":
        return ["node", f"--max-old-space-size={memory_mb}", f"{WORK}/main.js"]
    if language == "php":
        return [
            "php",
            "-d",
            f"memory_limit={memory_mb}M",
            "-d",
            "display_errors=stderr",
            "-d",
            "log_errors=0",
            f"{WORK}/main.php",
        ]
    if language == "sql":
        return ["python3", "-I", "/opt/lms/sqlrun.py"]
    if language == "web":
        return [
            "node",
            f"--max-old-space-size={memory_mb}",
            "/opt/lms/web/webpage.js",
            f"{WORK}/bundle.json",
        ]
    raise ValueError(f"unsupported language: {language}")


def limits_for(language, time_ms, memory_mb, file_bytes):
    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        cpu = max(1, (time_ms + STARTUP_MS[language]) // 1000 + 1)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (file_bytes, file_bytes))
        if language in ("python", "sql"):
            # The interpreters that respect an address-space cap; the JVM, Node and PHP take
            # their limit as a flag instead and reserve far more address space than they use.
            cap = (memory_mb + 96) * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (cap, cap))

    return apply


def judge_limits():
    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        cpu = WEB_JUDGE_TIME_MS // 1000
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))

    return apply


def read_capped(path, cap):
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as handle:
            data = handle.read(cap)
        return data.decode("utf-8", errors="replace"), size > cap
    except OSError:
        return "", False


def fresh(path):
    """An empty file at path, whatever a previous case left there (a link, a pipe or a file)."""
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass
    os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600))


def ancestors():
    """This process and the ones above it, which the sweep must leave alone."""
    keep, pid = set(), os.getpid()
    while pid > 0 and pid not in keep:
        keep.add(pid)
        try:
            with open(f"/proc/{pid}/stat", "r", encoding="utf-8", errors="replace") as handle:
                stat = handle.read()
            pid = int(stat[stat.rindex(")") + 2 :].split()[1])
        except (OSError, ValueError, IndexError):
            break
    return keep


def reap():
    """Collects the processes that were handed to this one when their parents died."""
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return
        if pid == 0:
            return


def sweep():
    """Stops every process the sandbox user still has apart from this harness and its ancestors.

    A program can leave processes behind in a new session, out of reach of its process group.
    Returns False when processes were still appearing after every round, which a case reports as
    an error rather than carrying on beside them.
    """
    keep = ancestors()
    for _ in range(SWEEP_ROUNDS):
        found = False
        for name in os.listdir("/proc"):
            if not name.isdigit() or int(name) in keep:
                continue
            try:
                with open(f"/proc/{name}/stat", "r", encoding="utf-8", errors="replace") as handle:
                    stat = handle.read()
                if stat[stat.rindex(")") + 2] in "ZX":
                    continue
                os.kill(int(name), signal.SIGKILL)
                found = True
            except (OSError, ValueError, IndexError):
                continue
        reap()
        if not found:
            return True
        time.sleep(0.01)
    return False


def compile_java(memory_mb):
    started = time.monotonic()
    os.makedirs(f"{WORK}/classes", exist_ok=True)
    os.makedirs(f"{WORK}/tmp", exist_ok=True)
    try:
        done = subprocess.run(
            [
                "javac",
                "-J-XX:-UsePerfData",
                "-J-XX:+UseSerialGC",
                "-J-XX:TieredStopAtLevel=1",
                f"-J-Djava.io.tmpdir={WORK}/tmp",
                "-encoding",
                "UTF-8",
                "-nowarn",
                "-d",
                f"{WORK}/classes",
                f"{WORK}/Main.java",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=COMPILE_TIMEOUT_S,
            check=False,
        )
        output = done.stdout[:COMPILE_OUTPUT_BYTES].decode("utf-8", errors="replace")
        ok = done.returncode == 0
    except subprocess.TimeoutExpired:
        output, ok = "The compiler did not finish in time.", False
    return {
        "ok": ok,
        "output": output.replace(f"{WORK}/", ""),
        "durationMs": int((time.monotonic() - started) * 1000),
    }


def execute(argv, stdin, out_path, err_path, preexec, cpu_budget_ms, wall_s):
    """Runs one program to the end under its limits and reports how it ended and what it cost."""
    fresh(out_path)
    fresh(err_path)
    started = time.monotonic()
    with open(out_path, "wb") as out, open(err_path, "wb") as err:
        process = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=out,
            stderr=err,
            cwd=WORK,
            env=ENV,
            preexec_fn=preexec,
        )
        try:
            process.stdin.write(stdin.encode("utf-8"))
            process.stdin.close()
        except (BrokenPipeError, OSError):
            pass

        timed_out = False
        status, usage = 0, None
        deadline = started + wall_s
        while True:
            pid, status, usage = os.wait4(process.pid, os.WNOHANG)
            if pid != 0:
                break
            if time.monotonic() > deadline:
                timed_out = True
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                _, status, usage = os.wait4(process.pid, 0)
                break
            time.sleep(0.005)
        process.returncode = 0  # already reaped above; keeps Popen from waiting again

    # Whatever the program left running in its session goes with it.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass

    exit_code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else None
    sig = os.WTERMSIG(status) if os.WIFSIGNALED(status) else None
    # The time a case is judged on, and the time it reports: CPU used by the program.
    cpu_ms = int(round((usage.ru_utime + usage.ru_stime) * 1000)) if usage else 0
    if sig == signal.SIGXCPU or cpu_ms > cpu_budget_ms:
        timed_out = True
    return {
        "exitCode": exit_code,
        "signal": sig,
        "timedOut": timed_out,
        "cpuMs": cpu_ms,
        "memoryKb": int(usage.ru_maxrss) if usage else 0,
    }


def case_result(case, ran, stdout, stderr, truncated):
    return {
        "id": case.get("id", ""),
        "stdout": stdout,
        "stderr": stderr.replace(f"{WORK}/", ""),
        "exitCode": ran["exitCode"],
        "signal": ran["signal"],
        "timedOut": ran["timedOut"],
        "memoryExceeded": (not ran["timedOut"])
        and any(marker in stderr for marker in MEMORY_MARKERS),
        "durationMs": ran["cpuMs"],
        "memoryKb": ran["memoryKb"],
        "truncated": truncated,
    }


def run_case(language, case, job, time_ms, memory_mb, output_bytes):
    out_path, err_path = f"{WORK}/tmp/stdout", f"{WORK}/tmp/stderr"
    stdin = case.get("stdin", "")
    if language == "sql":
        stdin = json.dumps(
            {
                "setup": job.get("sql", {}).get("setup", ""),
                "caseSetup": stdin,
                "query": job["code"],
                "check": job.get("sql", {}).get("check", ""),
            }
        )
    ran = execute(
        command(language, memory_mb),
        stdin,
        out_path,
        err_path,
        limits_for(language, time_ms, memory_mb, output_bytes * 4),
        cpu_allowance_ms(language, time_ms),
        wall_allowance_s(language, time_ms),
    )
    clean = sweep()
    stdout, out_cut = read_capped(out_path, output_bytes)
    stderr, err_cut = read_capped(err_path, output_bytes)
    if not clean:
        ran = {**ran, "exitCode": ran["exitCode"] or 1}
        stderr = f"{stderr}\nThe program left processes running.".strip()
    return case_result(case, ran, stdout, stderr, out_cut or err_cut)


def clamp_case(case, time_ms, memory_mb):
    """A case may carry its own limits; they are clamped to the same bounds as the job's."""
    case_time = int(min(max(case.get("timeMs", time_ms), 100), 30000))
    case_memory = int(min(max(case.get("memoryMb", memory_mb), 16), 512))
    return case_time, case_memory


def run_web_job(cases, time_ms, memory_mb, output_bytes):
    """A Web Lab job (ADR-0019): pages first, then one checker, never at the same time.

    The page (webpage.js) runs the learner's scripts and is given a check's steps, never its
    assertion; it prints a snapshot of the page. The checks without steps look at the same freshly
    loaded page, so they share one; each interaction check gets a fresh page of its own. After each
    page every process it left is stopped. Only then does the checker (webcheck.js), which runs
    none of the page's code, read the snapshots and the checks and decide each one. A page's limits
    are the learner's; the checker's are the harness's own, and its time is not charged to them.
    """
    results = [None] * len(cases)
    failed = {"exitCode": 2, "signal": None, "timedOut": False, "cpuMs": 0, "memoryKb": 0}
    pages, static = [], []
    for index, case in enumerate(cases):
        case_time, case_memory = clamp_case(case, time_ms, memory_mb)
        try:
            check = json.loads(case.get("stdin", ""))
        except ValueError:
            check = None
        if not isinstance(check, dict):
            results[index] = case_result(case, failed, "", "The check could not be read.", False)
        elif check.get("kind") == "interaction":
            steps = check.get("steps", [])
            pages.append({"steps": steps, "cases": [index], "time": case_time, "memory": case_memory})
        else:
            static.append((index, case_time, case_memory))
    if static:
        pages.insert(
            0,
            {
                "steps": [],
                "cases": [index for index, _, _ in static],
                "time": min(case_time for _, case_time, _ in static),
                "memory": max(case_memory for _, _, case_memory in static),
            },
        )

    judged = []
    for number, page in enumerate(pages):
        snapshot, errors_path = f"{WORK}/tmp/page-{number}.json", f"{WORK}/tmp/page-{number}.err"
        ran = execute(
            command("web", page["memory"]),
            json.dumps({"steps": page["steps"]}),
            snapshot,
            errors_path,
            limits_for("web", page["time"], page["memory"], WEB_SNAPSHOT_BYTES * 2),
            cpu_allowance_ms("web", page["time"]),
            wall_allowance_s("web", page["time"]),
        )
        clean = sweep()
        page_errors, _ = read_capped(errors_path, output_bytes)
        for index in page["cases"]:
            case = cases[index]
            if not clean:
                stopped = {**ran, "exitCode": ran["exitCode"] or 1}
                results[index] = case_result(
                    case, stopped, "", "The page left processes running.", False
                )
            elif ran["timedOut"] or ran["exitCode"] != 0:
                results[index] = case_result(case, ran, "", page_errors, False)
            else:
                judged.append({"index": index, "ran": ran, "errors": page_errors, "snapshot": snapshot})

    if judged:
        out_path, err_path = f"{WORK}/tmp/stdout", f"{WORK}/tmp/stderr"
        entries = [{"check": cases[j["index"]].get("stdin", ""), "snapshot": j["snapshot"]} for j in judged]
        decided = execute(
            [
                "node",
                f"--max-old-space-size={WEB_JUDGE_MEMORY_MB}",
                "/opt/lms/web/webcheck.js",
            ],
            json.dumps(entries),
            out_path,
            err_path,
            judge_limits(),
            WEB_JUDGE_TIME_MS,
            WEB_JUDGE_WALL_MS / 1000,
        )
        sweep()
        verdicts = None
        if not decided["timedOut"] and decided["exitCode"] == 0:
            text, cut = read_capped(out_path, 2 * 1024 * 1024)
            try:
                verdicts = None if cut else json.loads(text)
            except ValueError:
                verdicts = None
        if not isinstance(verdicts, list) or len(verdicts) != len(judged):
            problem, _ = read_capped(err_path, 2000)
            verdicts = [{"error": problem.strip() or "The checks could not be completed."}] * len(judged)
        for entry, outcome in zip(judged, verdicts):
            case = cases[entry["index"]]
            outcome = outcome if isinstance(outcome, dict) else {}
            if isinstance(outcome.get("verdict"), str):
                line = outcome["verdict"][:output_bytes]
                results[entry["index"]] = case_result(case, entry["ran"], f"{line}\n", entry["errors"], False)
            else:
                problem = str(outcome.get("error") or "The check could not be completed.")
                results[entry["index"]] = case_result(
                    case, {**entry["ran"], "exitCode": 2, "signal": None}, "", problem, False
                )
    return results


def main():
    protect_self()
    job = json.load(sys.stdin)
    language = job["language"]
    if language not in SOURCE:
        raise ValueError(f"unsupported language: {language}")
    limits = job.get("limits", {})
    time_ms = int(min(max(limits.get("timeMs", 5000), 100), 30000))
    memory_mb = int(min(max(limits.get("memoryMb", 128), 16), 512))
    output_bytes = int(min(max(limits.get("outputBytes", 65536), 1024), 1024 * 1024))
    cases = job.get("cases", [])[:50]
    # The last resort set at start-up, widened to this job: the compiler and every case's
    # wall-clock backstop, so a job still inside its limits is never cut short here.
    allowance_s = (COMPILE_TIMEOUT_S if language == "java" else 0) + sum(
        case_wall_s(language, int(min(max(case.get("timeMs", time_ms), 100), 30000)))
        for case in cases
    )
    signal.alarm(max(170, int(allowance_s) + 30))

    os.makedirs(f"{WORK}/tmp", exist_ok=True)
    with open(f"{WORK}/{SOURCE[language]}", "w", encoding="utf-8") as handle:
        handle.write(job["code"])

    compiled = {"ok": True, "output": "", "durationMs": 0}
    if language == "java":
        compiled = compile_java(memory_mb)

    results = []
    if compiled["ok"] and language == "web":
        results = run_web_job(cases, time_ms, memory_mb, output_bytes)
    elif compiled["ok"]:
        for case in cases:
            case_time, case_memory = clamp_case(case, time_ms, memory_mb)
            results.append(run_case(language, case, job, case_time, case_memory, output_bytes))

    sys.stdout.write(
        json.dumps({"harness": HARNESS_VERSION, "compile": compiled, "cases": results})
    )
    sys.stdout.flush()


if __name__ == "__main__":
    # A last resort: the runner enforces its own deadline, this keeps the container from outliving it.
    signal.alarm(170)
    try:
        main()
    except Exception as error:  # noqa: BLE001 - reported to the runner, never to the learner
        sys.stdout.write(json.dumps({"harness": HARNESS_VERSION, "error": str(error)[:500]}))
        sys.exit(2)
