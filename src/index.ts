import { Parser } from "yaml";
import { parse as commentParser } from "comment-parser";
import type {
  Token,
  CollectionItem,
  BlockSequence,
  BlockMap,
  Document,
  FlowCollection,
  SourceToken,
  FlowScalar,
} from "yaml/dist/parse/cst";
import type {
  JSONSchema4,
  JSONSchema4Object,
  JSONSchema4TypeName,
} from "json-schema";

import { flattenYaml } from "./flatten";

interface ParsedComment {
  title: string;
  description: string;
  type?: JSONSchema4TypeName | JSONSchema4TypeName[];
  $ref?: string;
  required: boolean;
  items?: JSONSchema4Object;
  isArray?: boolean;
  isEnum?: boolean;
  enumItems?: string[];
  isPattern?: boolean;
  pattern?: string;
  isIntegerRange?: boolean;
  minimum?: number;
  maximum?: number;
  isLengthRange?: boolean;
  minLength?: number;
  maxLength?: number;
}

interface YamlScalar {
  description?: string;
  type?: JSONSchema4TypeName[];
  required?: boolean;
  offset: number;
  key: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  value: any;
  children?: YamlScalar[];
  parent?: Token;
  comment?: ParsedComment;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  items?: any[];
}

function hasSep(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  object: any
): object is
  | CollectionItem
  | BlockSequence["items"][0]
  | BlockMap["items"][0]
  | BlockMap["items"][1] {
  return "sep" in object;
}

const hasKey = hasSep;

function hasValue(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  object: any
): object is
  | CollectionItem
  | Document
  | BlockSequence["items"][0]
  | BlockMap["items"][0]
  | BlockMap["items"][1] {
  return "value" in object;
}

function hasItems(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  object: any
): object is BlockMap | BlockSequence | FlowCollection {
  return "items" in object;
}

/**
 * Parse node comment with JSDoc like annotations
 */
const getCommentsSchema = (
  comments: SourceToken[]
): ParsedComment | undefined => {
  const source = comments.map((n) => n.source).join("\n");
  const parsedLines = commentParser(
    source
      .split("\n")
      .map((row) => row.trim().replace(/^\s*#+\s*-*\s*(.*)/gm, "/** $1 */"))
      .join("\n") // replaces starting with # or # --
  );
  const lastLine = parsedLines[parsedLines.length - 1];
  const description = parsedLines
    .map((line) => line.description)
    .filter(Boolean)
    .join("\n");
  if (lastLine?.tags?.length) {
    const tag = lastLine.tags[0];

    let type: string;
    let isArray = false;
    let isEnum = false;
    let isPattern = false;
    let isIntegerRange = false;
    let isLengthRange = false;
    let pattern: string;
    let enumItems: string[] = [];
    let minimum: number;
    let maximum: number;
    let minLength: number;
    let maxLength: number;
    const regexArray = /^(.*)\[\]$/g;
    const regexEnum = /^enum\{(.*)\}$/g;
    const regexPattern = /^pattern\{(.*)\}$/g;
    const regexIntegerRange = /^integer\{min=(\d+),max=(\d+)\}$/g;
    const regexLengthRange = /^string\{minLength=(\d+),maxLength=(\d+)\}$/g;

    if (tag.type) {
      if (tag.type.match(regexArray)) {
        type = tag.type.replace(regexArray, "$1");
        isArray = true;
      } else if (tag.type.match(regexEnum)) {
        enumItems = regexEnum.exec(tag.type)[1].split(",");
        isEnum = true;
      } else if (tag.type.match(regexPattern)) {
        pattern = regexPattern.exec(tag.type)[1];
        isPattern = true;
      } else if (tag.type.match(regexIntegerRange)) {
        const groups = regexIntegerRange.exec(tag.type);
        minimum = +groups[1];
        maximum = +groups[2];
        isIntegerRange = true;
      } else if (tag.type.match(regexLengthRange)) {
        const groups = regexLengthRange.exec(tag.type);
        minLength = +groups[1];
        maxLength = +groups[2];
        isLengthRange = true;
      } else {
        type = tag.type.replace(/^(.*)$/g, "$1");
      }
    }

    const isExternalref = type && !!type.match(/^https?:\/\//);
    const name = lastLine?.source[0]?.tokens?.name || tag.name; // check if optiona [name]

    const comment: ParsedComment = {
      title: tag.description.replace(/^[\s-]+/g, ""),
      description,
      required: name ? name.indexOf("[") === -1 : true,
    };

    if (isArray) {
      comment.isArray = true;
      comment.type = "array" as JSONSchema4TypeName;
      comment.items = {};

      if (isExternalref) {
        comment.items.$ref = type;
      } else {
        comment.items.type =
          type &&
          (type.replace(/(.*)\?$/, "$1").split(",") as JSONSchema4TypeName[]); // remove question mark
      }
    } else if (isEnum) {
      comment.isEnum = true;
      comment.enumItems = enumItems;
    } else if (isPattern) {
      comment.type = "string" as JSONSchema4TypeName;
      comment.isPattern = true;
      comment.pattern = pattern;
    } else if (isIntegerRange) {
      comment.type = "integer" as JSONSchema4TypeName;
      comment.isIntegerRange = true;
      comment.minimum = minimum;
      comment.maximum = maximum;
    } else if (isLengthRange) {
      comment.type = "string" as JSONSchema4TypeName;
      comment.isLengthRange = true;
      comment.minLength = minLength;
      comment.maxLength = maxLength;
    } else {
      if (isExternalref) {
        comment.$ref = type;
      } else {
        comment.type =
          type &&
          (type.replace(/(.*)\?$/, "$1").split(",") as JSONSchema4TypeName[]); // remove question mark
      }
    }
    return comment;
  }
  const title = lastLine?.source[0]?.tokens?.name;
  if (!title && !description) return;
  return {
    title,
    description,
    required: true,
    type: ["string", "boolean", "number", "object", "array"],
  };
};

const extractValuesFromTree = (
  root: Token[],
  child?: Token | CollectionItem
): YamlScalar[] => {
  const values = [];
  const node = child || root;
  if (hasKey(node) && node.key?.type === "scalar") {
    const scalar: YamlScalar = {
      type: undefined,
      required: undefined,
      offset: node.key.offset,
      key: node.key.source,
      // @ts-ignore
      value: node.value?.source,
      children: [],
      parent: undefined,
    };

    if (hasValue(node) && hasItems(node.value) && node.value.items.length) {
      scalar.children = node.value.items.flatMap((n) => {
        //@ts-ignore
        n.parent = node;
        return extractValuesFromTree(root, n);
      });

      scalar.type = ["object"];

      if (node.value?.type === "block-seq") {
        scalar.type = ["array"];
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        scalar.items = node.value.items.flatMap((item: any) => {
          return item.value?.source;
        });
      }
    }
    values.push(scalar);
  }

  if (hasValue(node) && hasItems(node.value) && node.value.items.length) {
    // biome-ignore lint/complexity/noForEach: <explanation>
    node.value.items.forEach((item) => {
      // @ts-ignore
      if (!item.parent) {
        // @ts-ignore
        item.parent = node;
        values.push(...extractValuesFromTree(root, item));
      }
    });
  }

  return values;
};

const getComments = (nodes: (Token | SourceToken)[], offset: number) => {
  const remaining = nodes.filter((node) => node.offset < offset);
  const comments: SourceToken[] = [];
  let lastType: string;
  let finished = false;
  // biome-ignore lint/complexity/noForEach: <explanation>
  remaining.reverse().forEach((node) => {
    if (finished) {
      return;
    }
    if (node.type === "comment") {
      comments.push(node);
    } else if (node.type === "space" || node.type === "map-value-ind") {
    } else if (node.type === "newline") {
      if (lastType === "newline") {
        finished = true;
      }
    } else {
      finished = true;
    }
    lastType = node.type;
  });
  return comments.reverse();
};

const addCommentsSchemas = (
  values: YamlScalar[],
  nodes: (Token | SourceToken)[]
): void => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  values.forEach((value) => {
    if (value.offset) {
      const comments = getComments(nodes, value.offset);
      if (comments?.length) {
        value.comment = getCommentsSchema(comments);
      }
    }
    if (value.children) {
      addCommentsSchemas(value.children, nodes);
    }
  });
};

const cleanUp = (values: YamlScalar[]) => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  values.forEach((value) => {
    value.offset = undefined;
    if (value.children.length === 0) {
      value.children = undefined;
    } else {
      cleanUp(value.children);
    }
  });
};

const cleanUndefined = (object: YamlScalar[]): YamlScalar[] =>
  JSON.parse(JSON.stringify(object));

export const extractValues = (yaml: string) => {
  const parsed = new Parser().parse(yaml);

  const tokens: Token[] = Array.from(parsed);

  const values = tokens.flatMap((token) =>
    extractValuesFromTree(tokens, token)
  );

  const flattenedNodes = flattenYaml(yaml);

  //@ts-ignore
  addCommentsSchemas(values, flattenedNodes);
  cleanUp(values);
  const cleaned = cleanUndefined(values);
  return cleaned;
};

// @ts-ignore
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const detectType = (some: any) =>
  ["string", "boolean", "number", "object", "array"] as JSONSchema4TypeName[];

const nodeToJsonSchema = (node: YamlScalar, rootProps = {}): JSONSchema4 => {
  const schema: JSONSchema4 = {
    type: node.comment?.type || detectType(node.value),
    ...rootProps,
  };

  if (node.comment?.isArray) {
    schema.type = "array";
  } else if (node.comment?.isEnum) {
    schema.enum = node.comment?.enumItems;
  } else if (node.comment?.isPattern) {
    schema.type = "string";
    schema.pattern = node.comment?.pattern;
  } else if (node.comment?.isIntegerRange) {
    schema.type = "integer";
    schema.minimum = node.comment?.minimum;
    schema.maximum = node.comment?.maximum;
  } else if (node.comment?.isLengthRange) {
    schema.type = "string";
    schema.minLength = node.comment?.minLength;
    schema.maxLength = node.comment?.maxLength;
  } else if (node.comment?.type) {
    schema.type = node.comment.type;
  }

  if (node.comment?.title) {
    schema.title = node.comment.title;
  }
  if (node.comment?.$ref) {
    schema.$ref = node.comment.$ref;
    schema.type = undefined;
  }
  if (node.comment?.items) {
    schema.items = node.comment.items;
  }
  if (node.comment?.description) {
    schema.description = node.comment.description;
  }

  if (schema.type === "array") {
    schema.default = node.items;
  }
  if (node.value) {
    if (node.value.replace(/^\"\"$/, "").length) {
      schema.default = node.value.replace(/^\"\"$/, "");
    }
  }

  if (node.children?.length) {
    schema.type = "object";
    schema.required = node.children
      .filter((c) => c.comment?.required)
      .map((c) => c.key);
    schema.properties = node.children.reduce(
      (a, c) => ({
        // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
        ...a,
        [c.key]: nodeToJsonSchema(c),
      }),
      {}
    );
  }

  return schema;
};

export const toJsonSchema = (yaml: string, rootProps = {}): JSONSchema4 => {
  const values = extractValues(yaml.trim());
  const fullValues: YamlScalar = {
    key: "root",
    value: null,
    offset: 0,
    children: values,
  };
  const schema = nodeToJsonSchema(fullValues, {
    $schema: "http://json-schema.org/draft-07/schema",
    ...rootProps,
  });
  return schema;
};
