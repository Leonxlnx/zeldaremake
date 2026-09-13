/** Attestation of where a report/take was produced (GAUNTLET.md §4.B2). */
export function attestation(env = process.env) {
  if (env.GITHUB_ACTIONS) {
    const server = env.GITHUB_SERVER_URL || 'https://github.com';
    const repo = env.GITHUB_REPOSITORY || '';
    const runId = env.GITHUB_RUN_ID || null;
    return {
      source: 'ci',
      runId,
      workflow: env.GITHUB_WORKFLOW || null,
      url: runId && repo ? `${server}/${repo}/actions/runs/${runId}` : null,
      sha: env.GITHUB_SHA || null,
      actor: env.GITHUB_ACTOR || null,
    };
  }
  return { source: 'local' };
}
