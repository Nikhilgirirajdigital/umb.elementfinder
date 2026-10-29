export type CleanupRisk = 'Low' | 'Moderate' | 'Review' | 'High';

export type UsageReferenceType =
  | 'Content'
  | 'DocumentType'
  | 'ElementType'
  | 'DataType'
  | 'Composition'
  | 'BlockList'
  | 'BlockGrid';

export type UsageReference = {
  key?: string;
  name: string;
  referenceType: UsageReferenceType;
  propertyAlias?: string;
  dataTypeName?: string;
  dataTypeKey?: string;
  contentTypeAlias?: string;
};

export type CleanupCandidate = {
  key: string;
  name: string;
  alias: string;
  type: string;
  usageCount: number;
  risk: CleanupRisk;
  summary: string;
  dependencies: string[];
  usages: UsageReference[];
};

export type CleanerSummary = {
  totalItems: number;
  lowRisk: number;
  moderate: number;
  review: number;
  highRisk: number;
};

export type CleanerScanResponse = {
  summary: CleanerSummary;
  items: CleanupCandidate[];
  scannedAtUtc: string;
};

export type CleanerPagedResponse = {
  items: CleanupCandidate[];
  total: number;
  skip: number;
  take: number;
  scannedAtUtc: string;
};
