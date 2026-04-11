export type PluginComponents = {
  commands: Record<string, unknown>;
  skills: Record<string, unknown>;
  agents: Record<string, unknown>;
  mcpServers: Record<string, unknown>;
  hooksConfigs: Array<{ hooks?: Record<string, unknown> }>;
  plugins: Array<{ name: string; version: string }>;
  errors: Array<{ pluginKey: string; installPath: string; error: string }>;
};