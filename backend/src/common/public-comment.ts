import { serialize } from './serialize';

export const toPublicComment = (comment: Record<string, unknown>) => {
  const payload = serialize(comment) as Record<string, unknown>;
  delete payload.botCampaignId;
  return payload;
};
