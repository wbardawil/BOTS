#!/usr/bin/env python3
"""Collected-count guard: a skip cannot green-wash the API suites.

Usage: python scripts/ci_guard.py <junit.xml> <baseline-file>

Reads pytest's junit XML (as written by --junitxml, with or without xdist) and the baseline file (one
integer; lines starting with '#' are comments) and prints the counts. Exit 1 when any of these holds:
  - tests that ran to a verdict (collected minus plain skips minus expected failures) < baseline
  - any plain skip (a module-level skip shows up as one skipped testcase per module)
  - any error (collection, setup or teardown) or any failure
  - an expected failure (pytest.mark.xfail) without a reason
Expected failures do not count as run: marking a failing test xfail lowers the count exactly as deleting
it would, so it cannot pad the baseline; every one is listed with its reason so the reviewer sees it.
Exit 2 on a usage or parse problem.
"""
import sys
import xml.etree.ElementTree as ET


def read_baseline(path: str) -> int:
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#"):
                return int(line)
    raise ValueError(f"{path}: no baseline number found")


def summarise(junit_path: str) -> dict:
    root = ET.parse(junit_path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    if not suites:
        raise ValueError(f"{junit_path}: no <testsuite> element")
    counts = {"tests": 0, "errors": 0, "failures": 0}
    for suite in suites:
        for key in counts:
            counts[key] += int(suite.get(key) or 0)
    plain_skips, xfails = [], []
    for case in root.iter("testcase"):
        label = f"{case.get('classname') or ''}::{case.get('name') or ''}".strip(":")
        for skipped in case.findall("skipped"):
            message = (skipped.get("message") or "").strip()
            detail = (skipped.text or "").strip().splitlines()
            if detail and detail[-1] != message:
                message = f"{message} {detail[-1]}".strip()
            if skipped.get("type") == "pytest.xfail":
                xfails.append((label, (skipped.get("message") or "").strip()))
            else:
                plain_skips.append((label, message))
    counts["skipped"] = len(plain_skips)
    counts["xfailed"] = len(xfails)
    counts["run"] = counts["tests"] - counts["skipped"] - counts["xfailed"]
    return {**counts, "plain_skips": plain_skips, "xfails": xfails}


def main(argv) -> int:
    if len(argv) != 3:
        print(__doc__.strip())
        return 2
    junit_path, baseline_path = argv[1], argv[2]
    try:
        baseline = read_baseline(baseline_path)
        s = summarise(junit_path)
    except (OSError, ValueError, ET.ParseError) as e:
        print(f"ci_guard: cannot read inputs: {e}")
        return 2
    print(f"ci_guard: collected={s['tests']} run={s['run']} baseline={baseline} skipped={s['skipped']} "
          f"xfailed={s['xfailed']} failures={s['failures']} errors={s['errors']}")
    for label, reason in s["xfails"]:
        print(f"  xfail  {label}: {reason or '(no reason)'}")
    for label, reason in s["plain_skips"]:
        print(f"  SKIP   {label}: {reason}")
    problems = []
    if s["run"] < baseline:
        problems.append(f"only {s['run']} tests ran to a verdict; the baseline is {baseline}")
    if s["skipped"]:
        problems.append(f"{s['skipped']} test(s) skipped; skips are not allowed in CI")
    if s["errors"]:
        problems.append(f"{s['errors']} error(s) recorded")
    if s["failures"]:
        problems.append(f"{s['failures']} failure(s) recorded")
    without_reason = [label for label, reason in s["xfails"] if not reason]
    if without_reason:
        problems.append("xfail without a reason: " + ", ".join(without_reason))
    if problems:
        for p in problems:
            print(f"ci_guard: FAIL: {p}")
        return 1
    print("ci_guard: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
