// Regression: ISSUE-003 — obsolete and pseudo-region codes appeared as countries
// Found by /qa on 2026-07-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-02.md

import assert from "node:assert/strict";
import { getCountryOptions, isSupportedCountryCode } from "../src/lib/countries";
const obsoleteCodes = ["DD", "DY", "HV", "NH", "RH", "VD", "XA", "XB", "YD"];
const options = getCountryOptions("en");
const optionCodes = new Set(options.map((country) => country.code));

for (const code of obsoleteCodes) {
  assert.equal(isSupportedCountryCode(code), false, `${code} must not pass country validation`);
  assert.equal(optionCodes.has(code), false, `${code} must not appear in the country picker`);
}

for (const code of ["DE", "BJ", "BF", "VU", "VN", "YE", "ZW", "US"]) {
  assert.equal(isSupportedCountryCode(code), true, `${code} must remain selectable`);
  assert.equal(optionCodes.has(code), true, `${code} must appear in the country picker`);
}

console.log("PASS: country options exclude obsolete and pseudo-region codes");
