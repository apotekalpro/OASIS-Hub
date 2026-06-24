/**
 * Outlet codes in pillar_targets uploads (e.g. "JKJPDA1") sometimes omit the
 * numeric store-id prefix that outlets.code carries (e.g. "0033-JKJPDA1").
 * Normalize by stripping any leading "<digits>-" prefix and non-alphanumerics
 * so both forms compare equal.
 */
export function normalizeOutletCode(code: string | null | undefined): string {
  if (!code) return ''
  return code.trim().toUpperCase().replace(/^\d+-/, '').replace(/[^A-Z0-9]/g, '')
}
