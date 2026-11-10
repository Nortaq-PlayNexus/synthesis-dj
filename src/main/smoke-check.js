/** Fail closed on rejected, invalid or stalled renderer analysis. */
function runSmokeCheck(analyze, exit, timeoutMs = 30000) {
  let finished = false;
  const finish = (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    exit(code);
  };
  const timer = setTimeout(() => finish(1), timeoutMs);
  Promise.resolve()
    .then(analyze)
    .then((result) => finish(result === true ? 0 : 1))
    .catch(() => finish(1));
}

module.exports = { runSmokeCheck };
