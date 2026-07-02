-- Fork was briefly exposed as an agent platform without a real integration.
-- Preserve affected accounts while moving them to the explicit generic MCP path.
UPDATE "owners"
SET "agent_platform" = 'other_mcp'
WHERE "agent_platform" = 'fork';
