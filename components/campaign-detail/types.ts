import type { CriteriaFieldType } from "@/lib/types";

// ── Catalog field draft (used when creating / editing catalog sets) ─────
export type CatalogFieldDraft = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  description: string;
  state_mapping: "abbr_to_name" | "name_to_abbr" | null;
};

// ── IPQS config types ──────────────────────────────────────────────────
export interface IpqsCriterionFraud {
  enabled: boolean;
  operator: "lte" | "gte" | "eq";
  value: number;
}
export interface IpqsCriterionValid {
  enabled: boolean;
}
export interface IpqsCriterionCountry {
  enabled: boolean;
  allowed: string;
}
export interface IpqsCriterionBool {
  enabled: boolean;
  allowed: boolean;
}
export interface IpqsConfig {
  enabled: boolean;
  phone: {
    enabled: boolean;
    criteria: {
      valid: IpqsCriterionValid;
      fraud_score: IpqsCriterionFraud;
      country: IpqsCriterionCountry;
    };
  };
  email: {
    enabled: boolean;
    criteria: {
      valid: IpqsCriterionValid;
      fraud_score: IpqsCriterionFraud;
    };
  };
  ip: {
    enabled: boolean;
    criteria: {
      fraud_score: IpqsCriterionFraud;
      country_code: IpqsCriterionCountry;
      proxy: IpqsCriterionBool;
      vpn: IpqsCriterionBool;
    };
  };
}

export const defaultIpqsConfig: IpqsConfig = {
  enabled: false,
  phone: {
    enabled: true,
    criteria: {
      valid: { enabled: true },
      fraud_score: { enabled: true, operator: "lte", value: 85 },
      country: { enabled: false, allowed: "" },
    },
  },
  email: {
    enabled: true,
    criteria: {
      valid: { enabled: true },
      fraud_score: { enabled: true, operator: "lte", value: 85 },
    },
  },
  ip: {
    enabled: false,
    criteria: {
      fraud_score: { enabled: true, operator: "lte", value: 85 },
      country_code: { enabled: false, allowed: "" },
      proxy: { enabled: false, allowed: false },
      vpn: { enabled: false, allowed: false },
    },
  },
};
