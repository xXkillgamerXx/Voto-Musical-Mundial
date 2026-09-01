export type UpdateModerationDictionaryDto = {
  customPromo?: Array<{ id?: string; phrase: string }>;
  customDiversion?: Array<{ id?: string; phrase: string }>;
  disabledKeys?: string[];
};

export type TestModerationDictionaryDto = {
  text: string;
};
