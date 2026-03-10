type JsonObject = Record<string, unknown>;

export type RolloutConversationSample = {
  prompt?: unknown;
  completion?: unknown;
  answer?: unknown;
};

export type ConversationToolOutput = {
  key: string;
  toolCallId: string | null;
  content: string;
  raw: string;
};

export type ConversationToolCall = {
  id: string;
  name: string;
  arguments: unknown;
  raw: string;
  outputs: ConversationToolOutput[];
};

export type ConversationMessage = {
  key: string;
  role: string;
  content: string;
  toolCalls: ConversationToolCall[];
  toolCallId: string | null;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractToolCalls(value: unknown): ConversationToolCall[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((toolCall, index) => {
    const parsedToolCall = parseMaybeJson(toolCall);
    const objectValue =
      parsedToolCall && typeof parsedToolCall === "object" && !Array.isArray(parsedToolCall)
        ? (parsedToolCall as JsonObject)
        : null;

    const id = typeof objectValue?.id === "string" ? objectValue.id : `tool-call-${index + 1}`;
    const name = typeof objectValue?.name === "string" ? objectValue.name : "tool";
    const argumentsValue = parseMaybeJson(objectValue?.arguments);

    return {
      id,
      name,
      arguments: argumentsValue,
      raw: stringifyContent(toolCall),
      outputs: [],
    };
  });
}

function getToolOutputOwner(
  messages: ConversationMessage[],
  toolCallId: string | null,
): ConversationToolCall | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant") {
      continue;
    }

    if (toolCallId) {
      const matchingToolCall = message.toolCalls.find((toolCall) => toolCall.id === toolCallId);
      if (matchingToolCall) {
        return matchingToolCall;
      }
      continue;
    }

    const lastToolCall = message.toolCalls[message.toolCalls.length - 1];
    if (lastToolCall) {
      return lastToolCall;
    }
  }

  return null;
}

export function extractConversationMessages(
  sample: RolloutConversationSample,
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  const appendMessages = (source: unknown, prefix: string) => {
    const parsed = parseMaybeJson(source);
    if (!Array.isArray(parsed)) {
      return;
    }

    let localIndex = 0;
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const roleRaw = (item as JsonObject).role;
      const contentRaw = (item as JsonObject).content;
      const toolCallIdRaw = (item as JsonObject).tool_call_id;
      const role = typeof roleRaw === "string" ? roleRaw : "message";
      const content = stringifyContent(contentRaw);
      const toolCallId = typeof toolCallIdRaw === "string" ? toolCallIdRaw : null;

      if (role === "tool") {
        const output: ConversationToolOutput = {
          key: `${prefix}:${localIndex}:tool-output`,
          toolCallId,
          content,
          raw: stringifyContent(item),
        };
        const toolCall = getToolOutputOwner(messages, toolCallId);
        if (toolCall) {
          toolCall.outputs.push(output);
        } else {
          messages.push({
            key: `${prefix}:${localIndex}:tool`,
            role,
            content,
            toolCalls: [],
            toolCallId,
          });
        }
        localIndex += 1;
        continue;
      }

      messages.push({
        key: `${prefix}:${localIndex}:${role}`,
        role,
        content,
        toolCalls: extractToolCalls((item as JsonObject).tool_calls),
        toolCallId,
      });
      localIndex += 1;
    }
  };

  appendMessages(sample.prompt, "prompt");
  appendMessages(sample.completion, "completion");

  if (messages.length === 0) {
    const answer = stringifyContent(sample.answer);
    if (answer.trim() !== "") {
      messages.push({
        key: "answer:0:assistant",
        role: "assistant",
        content: answer,
        toolCalls: [],
        toolCallId: null,
      });
    }
  }

  return messages;
}

export function getConversationMessagePreview(message: ConversationMessage): string {
  const directContent = compactText(message.content);
  if (directContent) {
    return directContent;
  }

  for (const toolCall of message.toolCalls) {
    for (const output of toolCall.outputs) {
      const outputContent = compactText(output.content);
      if (outputContent) {
        return outputContent;
      }
    }

    if (toolCall.arguments !== null && toolCall.arguments !== undefined) {
      const argumentPreview = compactText(stringifyContent(toolCall.arguments));
      if (argumentPreview) {
        return argumentPreview;
      }
    }

    const rawPreview = compactText(toolCall.raw);
    if (rawPreview) {
      return rawPreview;
    }
  }

  return "";
}

export function getLastConversationPreview(messages: ConversationMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    const preview = getConversationMessagePreview(message);
    if (preview) {
      return preview;
    }
  }

  return "";
}

export function getLastAssistantMessageKey(messages: ConversationMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message.key;
    }
  }

  return null;
}
