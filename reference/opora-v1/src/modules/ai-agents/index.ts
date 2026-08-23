export { AGENTS, CANNED, AI_WEEK, TODAY_AI_RESOLVED, getAgent } from './data/fixtures';
export type { AgentFixture } from './data/fixtures';
export { classifyIntent, type IntentId, type IntentMatch } from './domain/intents';
export {
  buildAssistantReply,
  type AgentRef,
  type AssistantContext,
} from './domain/replies';
