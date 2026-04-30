import { Fragment } from "react";
import { View } from "react-native";
import type { AssistantReference } from "@/features/assistant/grounding";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type InlineSegment =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "boldItalic"; content: string }
  | { type: "code"; content: string };

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

const INLINE_PATTERN =
  /(\*\*\*[^*][\s\S]*?\*\*\*|\*\*[^*][\s\S]*?\*\*|__[^_][\s\S]*?__|`[^`]+`|\*[^*\n][\s\S]*?\*|_[^_\n][\s\S]*?_)/g;

function parseInline(text: string) {
  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index == null) {
      continue;
    }

    if (match.index > cursor) {
      segments.push({
        type: "text",
        content: text.slice(cursor, match.index),
      });
    }

    const value = match[0];
    if (value.startsWith("***") && value.endsWith("***")) {
      segments.push({ type: "boldItalic", content: value.slice(3, -3) });
    } else if (
      (value.startsWith("**") && value.endsWith("**")) ||
      (value.startsWith("__") && value.endsWith("__"))
    ) {
      segments.push({ type: "bold", content: value.slice(2, -2) });
    } else if (value.startsWith("`") && value.endsWith("`")) {
      segments.push({ type: "code", content: value.slice(1, -1) });
    } else {
      segments.push({ type: "italic", content: value.slice(1, -1) });
    }

    cursor = match.index + value.length;
  }

  if (cursor < text.length) {
    segments.push({
      type: "text",
      content: text.slice(cursor),
    });
  }

  return segments.length ? segments : [{ type: "text", content: text }];
}

function parseBlocks(content: string) {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraphLines: string[] = [];
  let listBlock: { ordered: boolean; items: string[] } | null = null;

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ").trim(),
    });
    paragraphLines = [];
  }

  function flushList() {
    if (!listBlock?.items.length) {
      listBlock = null;
      return;
    }

    blocks.push({
      type: "list",
      ordered: listBlock.ordered,
      items: [...listBlock.items],
    });
    listBlock = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "blockquote",
        text: blockquoteMatch[1].trim(),
      });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!listBlock || !listBlock.ordered) {
        flushList();
        listBlock = { ordered: true, items: [] };
      }
      listBlock.items.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (!listBlock || listBlock.ordered) {
        flushList();
        listBlock = { ordered: false, items: [] };
      }
      listBlock.items.push(unorderedMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function InlineText({
  content,
  className,
  entities,
  consumedEntityKeys,
  onPressEntity,
}: {
  content: string;
  className?: string;
  entities?: AssistantReference[];
  consumedEntityKeys?: Set<string>;
  onPressEntity?: (entity: AssistantReference) => void;
}) {
  const segments = parseInline(content);

  const sortedEntities = [...(entities ?? [])].sort((a, b) => b.name.length - a.name.length);

  function renderEntityAwareText(text: string, textClassName?: string) {
    if (!sortedEntities.length || !text.trim()) {
      return text;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    const lower = text.toLowerCase();

    while (cursor < text.length) {
      let nextMatch:
        | {
            entity: AssistantReference;
            index: number;
          }
        | undefined;

      for (const entity of sortedEntities) {
        const entityKey = `${entity.type}:${entity.id}`;
        if (consumedEntityKeys?.has(entityKey)) {
          continue;
        }
        const entityLower = entity.name.toLowerCase();
        const index = lower.indexOf(entityLower, cursor);
        if (index < 0) {
          continue;
        }

        const before = index === 0 ? "" : lower[index - 1] ?? "";
        const after = lower[index + entityLower.length] ?? "";
        const beforeIsBoundary = !before || /[^a-z0-9]/.test(before);
        const afterIsBoundary = !after || /[^a-z0-9]/.test(after);

        if (!beforeIsBoundary || !afterIsBoundary) {
          continue;
        }

        if (!nextMatch || index < nextMatch.index) {
          nextMatch = { entity, index };
        }
      }

      if (!nextMatch) {
        nodes.push(
          <Fragment key={`plain-${cursor}`}>{text.slice(cursor)}</Fragment>,
        );
        break;
      }

      if (nextMatch.index > cursor) {
        nodes.push(
          <Fragment key={`plain-${cursor}`}>
            {text.slice(cursor, nextMatch.index)}
          </Fragment>,
        );
      }

      const matchedText = text.slice(nextMatch.index, nextMatch.index + nextMatch.entity.name.length);
      nodes.push(
        <Text
          key={`${nextMatch.entity.type}-${nextMatch.entity.id}-${nextMatch.index}`}
          className={cn("underline", textClassName)}
          style={{ textDecorationStyle: "dotted" }}
          onPress={() => onPressEntity?.(nextMatch.entity)}
        >
          {matchedText}
        </Text>,
      );
      consumedEntityKeys?.add(`${nextMatch.entity.type}:${nextMatch.entity.id}`);
      cursor = nextMatch.index + nextMatch.entity.name.length;
    }

    return nodes;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "bold") {
          return (
            <Text key={`${segment.type}-${index}`} className={cn("font-semibold", className)}>
              {renderEntityAwareText(segment.content, className)}
            </Text>
          );
        }

        if (segment.type === "italic") {
          return (
            <Text key={`${segment.type}-${index}`} className={cn("italic", className)}>
              {renderEntityAwareText(segment.content, className)}
            </Text>
          );
        }

        if (segment.type === "boldItalic") {
          return (
            <Text key={`${segment.type}-${index}`} className={cn("font-semibold italic", className)}>
              {renderEntityAwareText(segment.content, className)}
            </Text>
          );
        }

        if (segment.type === "code") {
          return (
            <Text
              key={`${segment.type}-${index}`}
              className={cn("rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[13px]", className)}
            >
              {segment.content}
            </Text>
          );
        }

        return (
          <Fragment key={`${segment.type}-${index}`}>
            {renderEntityAwareText(segment.content, className)}
          </Fragment>
        );
      })}
    </>
  );
}

export function RichTextMessage({
  content,
  className,
  entities,
  onPressEntity,
}: {
  content: string;
  className?: string;
  entities?: AssistantReference[];
  onPressEntity?: (entity: AssistantReference) => void;
}) {
  const blocks = parseBlocks(content);
  const consumedEntityKeys = new Set<string>();

  return (
    <View className="gap-2.5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const sizeClassName =
            block.level === 1
              ? "text-[18px] font-bold"
              : block.level === 2
                ? "text-[16px] font-semibold"
                : "text-[15px] font-semibold";

          return (
            <Text key={`heading-${index}`} className={cn(sizeClassName, className)}>
              <InlineText
                content={block.text}
                className={className}
                entities={entities}
                consumedEntityKeys={consumedEntityKeys}
                onPressEntity={onPressEntity}
              />
            </Text>
          );
        }

        if (block.type === "blockquote") {
          return (
            <View key={`quote-${index}`} className="rounded-2xl border-l-2 border-primary/50 bg-muted/35 px-3 py-2">
              <Text className={cn("text-[14px] italic leading-6", className)}>
                <InlineText
                  content={block.text}
                  className={className}
                  entities={entities}
                  consumedEntityKeys={consumedEntityKeys}
                  onPressEntity={onPressEntity}
                />
              </Text>
            </View>
          );
        }

        if (block.type === "list") {
          return (
            <View key={`list-${index}`} className="gap-2">
              {block.items.map((item, itemIndex) => (
                <View key={`item-${itemIndex}`} className="flex-row gap-2.5">
                  <Text className={cn("mt-0.5 text-[14px] font-semibold", className)}>
                    {block.ordered ? `${itemIndex + 1}.` : "•"}
                  </Text>
                  <Text className={cn("min-w-0 flex-1 text-[14px] leading-6", className)}>
                    <InlineText
                      content={item}
                      className={className}
                      entities={entities}
                      consumedEntityKeys={consumedEntityKeys}
                      onPressEntity={onPressEntity}
                    />
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={`paragraph-${index}`} className={cn("text-[15px] leading-6", className)}>
            <InlineText
              content={block.text}
              className={className}
              entities={entities}
              consumedEntityKeys={consumedEntityKeys}
              onPressEntity={onPressEntity}
            />
          </Text>
        );
      })}
    </View>
  );
}
