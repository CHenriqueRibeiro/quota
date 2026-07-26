-- CreateEnum
CREATE TYPE "public"."WidgetSecurityLevel" AS ENUM ('STANDARD', 'STRICT');

-- CreateTable
CREATE TABLE "public"."widgets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "allowedDomains" JSONB NOT NULL,
    "securityLevel" "public"."WidgetSecurityLevel" NOT NULL DEFAULT 'STANDARD',
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "logo" TEXT,
    "primaryColor" TEXT,
    "welcomeMessage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."widget_sessions" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widget_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."widget_request_logs" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topicId" TEXT,
    "origin" TEXT,
    "path" TEXT,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widget_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widgets_publicKey_key" ON "public"."widgets"("publicKey");

-- CreateIndex
CREATE INDEX "widgets_tenantId_idx" ON "public"."widgets"("tenantId");

-- CreateIndex
CREATE INDEX "widgets_assistantId_idx" ON "public"."widgets"("assistantId");

-- CreateIndex
CREATE INDEX "widgets_active_idx" ON "public"."widgets"("active");

-- CreateIndex
CREATE UNIQUE INDEX "widget_sessions_token_key" ON "public"."widget_sessions"("token");

-- CreateIndex
CREATE INDEX "widget_sessions_widgetId_idx" ON "public"."widget_sessions"("widgetId");

-- CreateIndex
CREATE INDEX "widget_sessions_expiresAt_idx" ON "public"."widget_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "widget_request_logs_tenantId_idx" ON "public"."widget_request_logs"("tenantId");

-- CreateIndex
CREATE INDEX "widget_request_logs_widgetId_idx" ON "public"."widget_request_logs"("widgetId");

-- CreateIndex
CREATE INDEX "widget_request_logs_createdAt_idx" ON "public"."widget_request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "widget_request_logs_errorCode_idx" ON "public"."widget_request_logs"("errorCode");

-- AddForeignKey
ALTER TABLE "public"."widgets" ADD CONSTRAINT "widgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."widgets" ADD CONSTRAINT "widgets_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "public"."Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."widget_sessions" ADD CONSTRAINT "widget_sessions_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "public"."widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."widget_request_logs" ADD CONSTRAINT "widget_request_logs_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "public"."widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."widget_request_logs" ADD CONSTRAINT "widget_request_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
