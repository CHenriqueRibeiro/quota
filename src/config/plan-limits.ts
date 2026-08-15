import { Plan } from "@prisma/client";

export interface PlanLimits {
  monthlyRequests: number;
  retentionDays: number;
  dbRetentionDays: number;
  maxUsers: number;
  maxProjects: number;
  maxAgents: number;
  maxBillingGroups: number;
  maxEnvironments: number;
  maxAssistants: number;
  maxWidgets: number;
  maxCliKeys: number;
  maxTagsPerRequest: number;
  canScheduleReports: boolean;
  canExportReports: boolean;
  canAutoBlockBudget: boolean;
  canCreateAlerts: boolean;
  canUseBI: boolean;
  canRawDataDownload: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.STARTER]: {
    monthlyRequests: 50_000,
    retentionDays: 90, // 3 meses de visualização
    dbRetentionDays: 365, // 1 ano de expurgo físico no banco
    maxUsers: 5,
    maxProjects: 5,
    maxAgents: 5,
    maxBillingGroups: 5,
    maxEnvironments: 2,
    maxAssistants: 1,
    maxWidgets: 1,
    maxCliKeys: 5,
    maxTagsPerRequest: 10,
    canScheduleReports: false,
    canExportReports: false,
    canAutoBlockBudget: false,
    canCreateAlerts: false,
    canUseBI: false,
    canRawDataDownload: false,
  },
  [Plan.PRO]: {
    monthlyRequests: 300_000,
    retentionDays: 180, // 6 meses de visualização
    dbRetentionDays: 730, // 2 anos de expurgo físico no banco
    maxUsers: 20,
    maxProjects: 20,
    maxAgents: 20,
    maxBillingGroups: 20,
    maxEnvironments: 15,
    maxAssistants: 5,
    maxWidgets: 5,
    maxCliKeys: 20,
    maxTagsPerRequest: 50,
    canScheduleReports: true,
    canExportReports: true,
    canAutoBlockBudget: true,
    canCreateAlerts: true,
    canUseBI: false,
    canRawDataDownload: false,
  },
  [Plan.ENTERPRISE]: {
    monthlyRequests: Infinity,
    retentionDays: 730, // 2 anos de visualização
    dbRetentionDays: 1460, // 4 anos de expurgo físico no banco
    maxUsers: Infinity,
    maxProjects: Infinity,
    maxAgents: Infinity,
    maxBillingGroups: Infinity,
    maxEnvironments: Infinity,
    maxAssistants: Infinity,
    maxWidgets: Infinity,
    maxCliKeys: Infinity,
    maxTagsPerRequest: Infinity,
    canScheduleReports: true,
    canExportReports: true,
    canAutoBlockBudget: true,
    canCreateAlerts: true,
    canUseBI: true,
    canRawDataDownload: true,
  },
};

export function getPlanLimits(plan?: string | Plan | null): PlanLimits {
  if (!plan || !PLAN_LIMITS[plan as Plan]) {
    return PLAN_LIMITS[Plan.STARTER];
  }
  return PLAN_LIMITS[plan as Plan];
}
