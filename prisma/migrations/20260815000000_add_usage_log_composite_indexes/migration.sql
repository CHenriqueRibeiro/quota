-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_createdAt_idx" ON "usage_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_provider_createdAt_idx" ON "usage_logs"("tenantId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_model_createdAt_idx" ON "usage_logs"("tenantId", "model", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_project_createdAt_idx" ON "usage_logs"("tenantId", "project", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_agent_createdAt_idx" ON "usage_logs"("tenantId", "agent", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_logs_tenantId_billingGroupId_createdAt_idx" ON "usage_logs"("tenantId", "billingGroupId", "createdAt");
