#!/usr/bin/env python3
"""The sandbox harness: compiles and runs one job inside a throwaway container.

It is part of the image and is trusted; the learner's code is data it writes under /work. The
runner service (apps/runner) starts one container per job with no network, a read-only root,
no capabilities and CPU, memory and process limits, pipes the job in and reads one JSON document
back. Expected outputs are never sent here: the API compares what this prints with what it holds.

Job, on standard input (validated by the runner against sandboxJobSchema in packages/shared):
  {"language": "java" | "python" | "javascript" | "php" | "sql",
   "code": "...",
   "cases": [{"id": "...", "stdin": "...", "timeMs"?: n, "memoryMb"?: n}],
   "limits": {"timeMs": 5000, "memoryMb": 128, "outputBytes": 65536},
   "sql": {"setup": "...", "check": "..."}}            # sql only; "stdin" is the case's own setup

Result, on standard output:
  {"compile": {"ok": true, "output": "", "durationMs": 0},
   "cases": [{"id", "stdout", "stderr", "exitCode", "signal", "timedOut", "memoryExceeded",
              "durationMs", "memoryKb", "truncated"}]}
A case's durationMs is the CPU time it used, which is also what its time limit is judged on.
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
STARTUP_MS = {"java": 1500, "python": 400, "javascript": 500, "php": 400, "sql": 500}
# A case is judged on the CPU time it uses, so a busy or cold host cannot fail a correct answer.
# The wall clock is only a backstop, for code that waits instead of computing: twice the CPU
# allowance plus this slack. apps/runner (docker-args.ts) and the API size their deadlines on it.
WALL_FACTOR = 2
WALL_SLACK_MS = 2000


def cpu_allowance_ms(language, time_ms):
    return time_ms + STARTUP_MS[language]


def wall_allowance_s(language, time_ms):
    return (cpu_allowance_ms(language, time_ms) * WALL_FACTOR + WALL_SLACK_MS) / 1000
SOURCE = {
    "java": "Main.java",
    "python": "main.py",
    "javascript": "main.js",
    "php": "main.php",
    "sql": "query.sql",
}
MEMORY_MARKERS = (
    "java.lang.OutOfMemoryError",
    "MemoryError",
    "heap out of memory",
    "Allowed memory size of",
)


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
    raise ValueError(f"unsupported language: {language}")


def limits_for(language, time_ms, memory_mb, output_bytes):
    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        cpu = max(1, (time_ms + STARTUP_MS[language]) // 1000 + 1)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (output_bytes * 4, output_bytes * 4))
        if language in ("python", "sql"):
            # The interpreters that respect an address-space cap; the JVM, Node and PHP take
            # their limit as a flag instead and reserve far more address space than they use.
            cap = (memory_mb + 96) * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (cap, cap))

    return apply


def read_capped(path, cap):
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as handle:
            data = handle.read(cap)
        return data.decode("utf-8", errors="replace"), size > cap
    except OSError:
        return "", False


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
    cpu_budget_ms = cpu_allowance_ms(language, time_ms)
    wall_s = wall_allowance_s(language, time_ms)
    started = time.monotonic()
    with open(out_path, "wb") as out, open(err_path, "wb") as err:
        process = subprocess.Popen(
            command(language, memory_mb),
            stdin=subprocess.PIPE,
            stdout=out,
            stderr=err,
            cwd=WORK,
            env={"PATH": os.environ.get("PATH", ""), "HOME": f"{WORK}/tmp", "LANG": "C.UTF-8"},
            preexec_fn=limits_for(language, time_ms, memory_mb, output_bytes),
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
    stdout, out_cut = read_capped(out_path, output_bytes)
    stderr, err_cut = read_capped(err_path, output_bytes)
    memory_kb = int(usage.ru_maxrss) if usage else 0
    return {
        "id": case.get("id", ""),
        "stdout": stdout,
        "stderr": stderr.replace(f"{WORK}/", ""),
        "exitCode": exit_code,
        "signal": sig,
        "timedOut": timed_out,
        "memoryExceeded": (not timed_out) and any(marker in stderr for marker in MEMORY_MARKERS),
        "durationMs": cpu_ms,
        "memoryKb": memory_kb,
        "truncated": out_cut or err_cut,
    }


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
        wall_allowance_s(language, int(min(max(case.get("timeMs", time_ms), 100), 30000)))
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
    if compiled["ok"]:
        for case in cases:
            # A case may carry its own limits; they are clamped to the same bounds as the job's.
            case_time = int(min(max(case.get("timeMs", time_ms), 100), 30000))
            case_memory = int(min(max(case.get("memoryMb", memory_mb), 16), 512))
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
