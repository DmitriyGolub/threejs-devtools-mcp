/**
 * Simple test runner with pass/fail tracking.
 */
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

export function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ name, status: 'pass', detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  } else {
    failed++;
    results.push({ name, status: 'fail', detail });
    console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
  }
}

export function skip(name, reason = '') {
  skipped++;
  results.push({ name, status: 'skip', detail: reason });
  console.log(`  ⊘ ${name}${reason ? ': ' + reason : ''} (skipped)`);
}

export function toolOk(name, resp) {
  const text = resp.result?.content?.[0]?.text || '';
  const isError = resp.result?.isError;
  if (isError) {
    ok(name, false, text.substring(0, 150));
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function summary() {
  const parts = [`${passed} passed`, `${failed} failed`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  console.log(`\n═══ ${parts.join(', ')} ═══\n`);
  return failed === 0;
}
