import { ContentReportStatus } from '@prisma/client';

export type ReporterTrustCounts = {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  actionTaken: number;
};

export type ReporterTrustLabel = 'nuevo' | 'confiable' | 'regular' | 'sospechoso';

export type ReporterTrust = ReporterTrustCounts & {
  resolved: number;
  helpfulRate: number | null;
  score: number;
  label: ReporterTrustLabel;
};

type StatusCountRow = {
  status: ContentReportStatus;
  _count: { _all: number } | number;
};

const countOf = (row: StatusCountRow) =>
  typeof row._count === 'number' ? row._count : Number(row._count?._all || 0);

export const emptyReporterTrust = (): ReporterTrust => ({
  total: 0,
  pending: 0,
  reviewed: 0,
  dismissed: 0,
  actionTaken: 0,
  resolved: 0,
  helpfulRate: null,
  score: 50,
  label: 'nuevo',
});

export const buildReporterTrust = (
  counts: Partial<ReporterTrustCounts> = {},
): ReporterTrust => {
  const pending = Math.max(0, Number(counts.pending || 0));
  const reviewed = Math.max(0, Number(counts.reviewed || 0));
  const dismissed = Math.max(0, Number(counts.dismissed || 0));
  const actionTaken = Math.max(0, Number(counts.actionTaken || 0));
  const total = Math.max(
    0,
    Number(counts.total ?? pending + reviewed + dismissed + actionTaken),
  );
  const resolved = actionTaken + dismissed;
  const helpfulRate = resolved > 0 ? Math.round((actionTaken / resolved) * 100) : null;
  const raw = total > 0
    ? (actionTaken * 1 + reviewed * 0.25 - dismissed * 0.85) / total
    : 0;
  const score = Math.max(0, Math.min(100, Math.round(50 + raw * 50)));

  let label: ReporterTrustLabel = 'nuevo';
  if (resolved >= 3 || total >= 5) {
    if (score >= 70) {
      label = 'confiable';
    } else if (score >= 40) {
      label = 'regular';
    } else {
      label = 'sospechoso';
    }
  }

  return {
    total,
    pending,
    reviewed,
    dismissed,
    actionTaken,
    resolved,
    helpfulRate,
    score,
    label,
  };
};

export const reporterTrustFromStatusRows = (rows: StatusCountRow[]): ReporterTrust => {
  const counts: ReporterTrustCounts = {
    total: 0,
    pending: 0,
    reviewed: 0,
    dismissed: 0,
    actionTaken: 0,
  };

  for (const row of rows) {
    const n = countOf(row);
    counts.total += n;

    if (row.status === ContentReportStatus.pending) {
      counts.pending += n;
    } else if (row.status === ContentReportStatus.reviewed) {
      counts.reviewed += n;
    } else if (row.status === ContentReportStatus.dismissed) {
      counts.dismissed += n;
    } else if (row.status === ContentReportStatus.action_taken) {
      counts.actionTaken += n;
    }
  }

  return buildReporterTrust(counts);
};
