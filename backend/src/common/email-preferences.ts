/** Preferencia en user.metadata.emailCampaigns. Default: true (recibir). */
export const allowsCampaignEmail = (metadata: unknown): boolean => {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  if (meta.emailCampaigns === false || meta.emailCampaigns === 'false' || meta.emailCampaigns === 0) {
    return false;
  }

  return true;
};
