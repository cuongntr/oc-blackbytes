export type CommandDefinition = {
  template: string
  description: string
  agent?: string
  model?: string
  subtask?: boolean
}
