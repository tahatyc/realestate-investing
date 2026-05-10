export const TRIAGE_STATUSES = ['new', 'watching', 'needs_call', 'visited', 'made_offer', 'rejected'];

export function statusLabel(status) {
  const labels = {
    new: 'New',
    watching: 'Watching',
    needs_call: 'Needs call',
    visited: 'Visited',
    made_offer: 'Made offer',
    rejected: 'Rejected'
  };
  return labels[status] ?? status;
}

export function shouldHideRejected(item, includeRejected) {
  return item.triage?.status === 'rejected' && !includeRejected;
}
