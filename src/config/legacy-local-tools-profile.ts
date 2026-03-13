import type { OpenClawConfig } from "./config.js";

const LEGACY_LOCAL_ONBOARDING_MESSAGING_PROFILE_VERSIONS = new Set(["2026.3.2", "2026.3.2-beta.1"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function hasOnlyProfileKey(tools: Record<string, unknown>): boolean {
  const keys = Object.keys(tools).filter((key) => !key.startsWith("__"));
  return keys.length === 1 && keys[0] === "profile";
}

/**
 * v2026.3.2 local onboarding persisted `tools.profile="messaging"` by default.
 * Those onboarding flows already stamped wizard metadata, so use that historical
 * evidence instead of reinterpreting current config shape at runtime.
 */
export function shouldMigrateLegacyLocalOnboardingToolsProfile(
  config:
    | Pick<OpenClawConfig, "agents" | "gateway" | "tools" | "wizard">
    | Record<string, unknown>
    | null
    | undefined,
): boolean {
  if (!isRecord(config)) {
    return false;
  }

  const tools = getRecord(config.tools);
  if (!tools || tools.profile !== "messaging" || !hasOnlyProfileKey(tools)) {
    return false;
  }

  const gateway = getRecord(config.gateway);
  if (!gateway || gateway.mode !== "local") {
    return false;
  }

  const agents = getRecord(config.agents);
  const defaults = getRecord(agents?.defaults);
  const workspace = typeof defaults?.workspace === "string" ? defaults.workspace.trim() : "";
  if (!workspace) {
    return false;
  }

  const wizard = getRecord(config.wizard);
  if (!wizard || wizard.lastRunCommand !== "onboard" || wizard.lastRunMode !== "local") {
    return false;
  }

  const lastRunVersion =
    typeof wizard.lastRunVersion === "string" ? wizard.lastRunVersion.trim() : "";
  return LEGACY_LOCAL_ONBOARDING_MESSAGING_PROFILE_VERSIONS.has(lastRunVersion);
}

export function applyLegacyLocalOnboardingToolsProfileMigration(
  config:
    | Pick<OpenClawConfig, "agents" | "gateway" | "tools" | "wizard">
    | Record<string, unknown>
    | null
    | undefined,
): Record<string, unknown> | null {
  if (!shouldMigrateLegacyLocalOnboardingToolsProfile(config) || !isRecord(config)) {
    return null;
  }

  const next = structuredClone(config) as Record<string, unknown>;
  const tools = getRecord(next.tools);
  if (!tools) {
    return null;
  }
  tools.profile = "coding";
  next.tools = tools;
  return next;
}
