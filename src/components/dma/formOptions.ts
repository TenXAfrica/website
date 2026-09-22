import type { SelfServeContact } from '../../../shared/dma/types';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/** Twenty Company.size enum, worded the way an owner would say it. */
export const SIZE_OPTIONS: Choice<SelfServeContact['size']>[] = [
  { value: 'S_1_5', label: '1 to 5 people' },
  { value: 'S_6_20', label: '6 to 20 people' },
  { value: 'S_21_50', label: '21 to 50 people' },
  { value: 'S_51_200', label: '51 to 200 people' },
  { value: 'S_200_PLUS', label: 'More than 200 people' },
];

/** Twenty Company.sector enum. */
export const SECTOR_OPTIONS: Choice<string>[] = [
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional services' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'RETAIL', label: 'Retail and e-commerce' },
  { value: 'HOSPITALITY', label: 'Hospitality and tourism' },
  { value: 'PROPERTY', label: 'Property and real estate' },
  { value: 'FINANCIAL', label: 'Financial services' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'CONSTRUCTION', label: 'Construction and trades' },
  { value: 'EDUCATION', label: 'Education and training' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'NGO_PUBLIC', label: 'Non-profit or public sector' },
  { value: 'OTHER', label: 'Something else' },
];
