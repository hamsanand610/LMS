#!/usr/bin/env python3
"""Runs one SQL answer against a throwaway in-memory database and prints the result table.

Started by harness.py for every SQL case. The question's schema and rows (trusted, written by the
question's author) are loaded first; then the learner's statements run under an authoriser that
refuses anything reaching outside the database; then either the learner's last result set or the
question's own check query is printed as JSON. Nothing here can reach the application's database:
there is no network in the container and the database lives and dies with this process.

Input (standard input):  {"setup": "...", "caseSetup": "...", "query": "...", "check": "..."}
Output (standard output): {"columns": [...], "rows": [[...]], "rowCount": n, "truncated": bool}
"""

import json
import sqlite3
import sys

MAX_ROWS = 500
MAX_STATEMENTS = 50
MAX_STEPS = 5_000_000
SAFE_PRAGMAS = {"table_info", "table_xinfo", "foreign_key_list", "index_list", "index_info"}
DENIED_FUNCTIONS = {"load_extension", "readfile", "writefile", "edit", "fts3_tokenizer"}


def authoriser(action, first, second, _database, _trigger):
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA and (first or "").lower() not in SAFE_PRAGMAS:
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_FUNCTION and (second or "").lower() in DENIED_FUNCTIONS:
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def statements(script):
    """Splits a script into complete statements the way SQLite itself reads them."""
    buffer = ""
    for line in script.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            if buffer.strip().strip(";").strip():
                yield buffer.strip()
            buffer = ""
    if buffer.strip().strip(";").strip():
        yield buffer.strip()


def cell(value):
    if value is None or isinstance(value, (int, str)):
        return value
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, (bytes, bytearray)):
        return value.hex()
    return str(value)


def table(cursor):
    rows = cursor.fetchmany(MAX_ROWS + 1)
    return {
        "columns": [column[0] for column in cursor.description],
        "rows": [[cell(value) for value in row] for row in rows[:MAX_ROWS]],
        "rowCount": min(len(rows), MAX_ROWS),
        "truncated": len(rows) > MAX_ROWS,
    }


def main():
    job = json.load(sys.stdin)
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(job.get("setup", "") or "")
    connection.executescript(job.get("caseSetup", "") or "")
    connection.commit()

    steps = {"count": 0}

    def budget():
        steps["count"] += 1
        return 1 if steps["count"] * 1000 > MAX_STEPS else 0

    connection.set_progress_handler(budget, 1000)
    connection.set_authorizer(authoriser)

    result = None
    ran = 0
    for statement in statements(job.get("query", "") or ""):
        ran += 1
        if ran > MAX_STATEMENTS:
            raise sqlite3.OperationalError("too many statements in one answer")
        cursor = connection.execute(statement)
        if cursor.description is not None:
            result = table(cursor)
    connection.commit()

    check = (job.get("check", "") or "").strip()
    if check:
        connection.set_authorizer(None)
        result = table(connection.execute(check))
    if result is None:
        result = {"columns": [], "rows": [], "rowCount": 0, "truncated": False}
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except sqlite3.Error as error:
        sys.stderr.write(f"SQL error: {error}\n")
        sys.exit(1)
    except (ValueError, KeyError) as error:
        sys.stderr.write(f"The answer could not be read: {error}\n")
        sys.exit(1)
