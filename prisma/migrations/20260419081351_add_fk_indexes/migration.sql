-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");

-- CreateIndex
CREATE INDEX "experience_sessions_experienceId_idx" ON "experience_sessions"("experienceId");

-- CreateIndex
CREATE INDEX "experience_sessions_userId_idx" ON "experience_sessions"("userId");

-- CreateIndex
CREATE INDEX "experiences_authorId_idx" ON "experiences"("authorId");

-- CreateIndex
CREATE INDEX "experiences_orgId_idx" ON "experiences"("orgId");

-- CreateIndex
CREATE INDEX "generated_nodes_sessionId_idx" ON "generated_nodes"("sessionId");

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");
