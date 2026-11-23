// The same tiny harness as test/checkout.test.js, for async tests: each test
// runs in order, a failure is printed and sets the exit code, and the file
// ends with a count.

export function harness() {
  const queue = [];
  return {
    section(title) { queue.push({ title }); },
    test(name, fn) { queue.push({ name, fn }); },
    async run() {
      let passed = 0;
      for (const item of queue) {
        if (item.title) { console.log(`\n${item.title}\n`); continue; }
        try {
          await item.fn();
          console.log(`  ok  ${item.name}`);
          passed++;
        } catch (err) {
          console.error(`FAIL  ${item.name}\n      ${String(err && (err.stack || err.message)).split("\n").join("\n      ")}`);
          process.exitCode = 1;
        }
      }
      console.log(`\n${passed} checks passed\n`);
      return passed;
    }
  };
}
