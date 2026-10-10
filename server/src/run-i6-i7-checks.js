/**
 * @file run-i6-i7-checks.js
 * @description Master test runner executing all required verification checks for Tasks I6 and I7.
 */

const { runMediaTests } = require('./modules/media/__tests__/media.test');
const { runReportTests } = require('./modules/reports/__tests__/reports.test');

async function main() {
  console.log('================================================================');
  console.log('CivicSync Verification Runner — Tasks I6 & I7 Acceptance Checks');
  console.log('================================================================\n');

  const mediaResults = await runMediaTests();
  console.log('');
  const reportResults = await runReportTests();

  const allResults = [...mediaResults, ...reportResults];
  const passedCount = allResults.filter((r) => r.passed).length;
  const failedCount = allResults.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${allResults.length} total checks`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
