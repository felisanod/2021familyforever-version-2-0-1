/** Map raw backend errors to friendly, user-facing messages (Kiswahili). */
export function friendlyError(err: unknown): string {
  if (!err) return 'Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.'
  const message = typeof err === 'string' ? err : (err as { message?: string }).message ?? ''
  const lower = message.toLowerCase()

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Haupo mtandaoni. Tafadhali angalia muunganisho wako kisha ujaribu tena.'
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Namba ya simu au neno la siri si sahihi. Tafadhali jaribu tena.'
  }
  if (lower.includes('only administrators')) {
    return 'Hauna ruhusa ya kufanya kitendo hiki.'
  }
  if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('42501')) {
    return 'Hauna ruhusa ya kufanya kitendo hiki.'
  }
  if (lower.includes('already closed')) {
    return 'Mchango huu umefungwa tayari.'
  }
  if (lower.includes('no longer accepted')) {
    return 'Mchango huu umefungwa. Malipo mapya hayakubaliki tena.'
  }
  if (lower.includes('not active')) {
    return 'Akaunti ya mwanachama huyu haipo hai.'
  }
  if (lower.includes('greater than zero') || lower.includes('amount')) {
    return 'Tafadhali weka kiasi sahihi kinachozidi sifuri.'
  }
  if (lower.includes('title is required')) {
    return 'Tafadhali weka kichwa.'
  }
  if (lower.includes('message is required')) {
    return 'Tafadhali weka ujumbe.'
  }
  if (lower.includes('selected members')) {
    return 'Tafadhali chagua angalau mwanachama mmoja.'
  }
  if (lower.includes('jwt expired') || lower.includes('token')) {
    return 'Muda wa kipindi chako umeisha. Tafadhali ingia tena.'
  }
  if (lower.includes('duplicate key')) {
    return 'Rekodi hii ipo tayari.'
  }

  // Never show raw technical errors.
  return 'Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.'
}