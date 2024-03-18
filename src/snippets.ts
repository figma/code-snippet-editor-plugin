import { snippetIdFromCodegenResult } from "./params";
import { getCodegenResultsFromPluginData } from "./pluginData";

/**
 * The maximum depth we can recurse through children.
 * Hitting this limit would require nesting 12 nodes deep where all have a template.
 */
const MAX_RECURSION = 12;

/**
 * Regular expression for finding symbols, aka {{property.variant}} in a string.
 * Ignores ? and ! which indicate conditional statements.
 * Escape double curly brackets with a single backslash, eg. "\{{hi}}" would be entirely escaped
 * Negative lookbehind at beginning of expression "(?<!\\\)" respects escaping.
 * Three groups:
 *  1. the symbol itself
 *  2. whole filter string
 *  3. subset of filter string that represents the filter value
 */
const regexSymbols = /(?<!\\)\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g;

/**
 * Replacing escaped brackets with standard brackets.
 * Brackets only need to be escaped when used in a way that matches "{{...}}"
 * "\{{hi}}" becomes "{{hi}}"
 */
const unescapeBrackets = (line: string) => line.replace(/\\\{\{/g, "{{");
/**
 * Regular expression conditional group string for finding "single" conditionals aka no "&" or "|"
 */
const regexConditionalSingle = "([^}&|]+)";
/**
 * Regular expression conditional group string for finding "OR" conditionals aka no "&"
 * OR is implied because the above "single" will not match.
 */
const regexConditionalOr = "([^}&]+)";
/**
 * Regular expression conditional group string for finding "AND" conditionals aka no "|"
 * AND is implied because the above "single" and "or" will not match.
 */
const regexConditionalAnd = "([^}|]+)";
/**
 * Regular expression string for conditionals, combining three group strings above into one.
 * https://github.com/figma/code-snippet-editor-plugin#operators
 */
const regexConditionals = [
  regexConditionalSingle,
  regexConditionalOr,
  regexConditionalAnd,
].join("|");
/**
 * Regular expression for conditionals that includes above group parts.
 * https://github.com/figma/code-snippet-editor-plugin#conditionals
 */
const regexConditional = new RegExp(
  `\{\{([\?\!])(${regexConditionals})\}\}`,
  "g"
);

/**
 * Given a node, get all the relevant snippet templates stored in shared plugin data and hydrate them with params.
 * For component-like nodes, this will discover inherited templates (component set > component > instance).
 * @param node the node to find relevant snippets for from plugin data
 * @param codeSnippetParamsMap the map of params that can fill the templates
 * @param globalTemplates CodeSnippetGlobalTemplates
 * @param indent the indentation string
 * @param recursionIndex tracking recursion to prevent infinite loops
 * @param parentCodegenResult If present, template language and title must match this. Used to filter out templates up front during recursion.
 * @returns NodeSnippetTemplateData array containing hydrated snippets for the current node.
 */
export async function nodeSnippetTemplateDataArrayFromNode(
  node: BaseNode,
  codeSnippetParamsMap: CodeSnippetParamsMap,
  globalTemplates: CodeSnippetGlobalTemplates,
  indent: string = "",
  recursionIndex = 0,
  parentCodegenResult?: CodegenResult
): Promise<NodeSnippetTemplateData[]> {
  const nodeSnippetTemplateDataArray: NodeSnippetTemplateData[] = [];

  const templatesWithInheritanceNode =
    await snippetTemplatesWithInheritanceNode(
      node,
      globalTemplates,
      parentCodegenResult
    );

  for (let [
    inheritanceNode,
    snippetTemplates,
  ] of templatesWithInheritanceNode) {
    const nodeSnippetTemplateData = await hydrateSnippets(
      snippetTemplates,
      codeSnippetParamsMap,
      inheritanceNode.type,
      indent,
      recursionIndex,
      globalTemplates
    );
    nodeSnippetTemplateDataArray.push(nodeSnippetTemplateData);
  }

  return nodeSnippetTemplateDataArray;
}

export async function snippetTemplatesWithInheritanceNode(
  node: BaseNode,
  globalTemplates: CodeSnippetGlobalTemplates,
  parentCodegenResult?: CodegenResult
) {
  const seenSnippetTemplates: { [k: string]: number } = {};
  const nodeAndTemplates: [BaseNode, CodegenResult[]][] = [];
  /**
   * Templates via inheritance from component lineage.
   * Starting at the top with component sets, then components, then instances.
   */
  if (
    node.type === "COMPONENT" &&
    node.parent &&
    node.parent.type === "COMPONENT_SET"
  ) {
    const componentSetTemplates = await snippetTemplatesForNode(
      node.parent,
      seenSnippetTemplates,
      globalTemplates,
      parentCodegenResult
    );
    if (componentSetTemplates.length) {
      nodeAndTemplates.push([node.parent, componentSetTemplates]);
    }
  } else if (node.type === "INSTANCE") {
    if (node.mainComponent) {
      if (
        node.mainComponent.parent &&
        node.mainComponent.parent.type === "COMPONENT_SET"
      ) {
        const componentSetTemplates = await snippetTemplatesForNode(
          node.mainComponent.parent,
          seenSnippetTemplates,
          globalTemplates,
          parentCodegenResult
        );
        if (componentSetTemplates.length) {
          nodeAndTemplates.push([
            node.mainComponent.parent,
            componentSetTemplates,
          ]);
        }
      }
      const mainComponentTemplates = await snippetTemplatesForNode(
        node.mainComponent,
        seenSnippetTemplates,
        globalTemplates,
        parentCodegenResult
      );
      if (mainComponentTemplates.length) {
        nodeAndTemplates.push([node.mainComponent, mainComponentTemplates]);
      }
    }
  }

  /**
   * Templates on the given node
   */
  const nodeTemplates = await snippetTemplatesForNode(
    node,
    seenSnippetTemplates,
    globalTemplates,
    parentCodegenResult
  );
  if (nodeTemplates.length) {
    nodeAndTemplates.push([node, nodeTemplates]);
  }

  return nodeAndTemplates;
}

/**
 * Process snippets for any node. Called multiple times up the lineage for component and instance nodes.
 * Instances have the same pluginData as their mainComponent, unless they have overridden the pluginData.
 * This tracks these duplicate cases in seenSnippetTemplates and filters them out.
 * @param snippetNode the node to check for templates in plugin data
 * @param seenSnippetTemplates a memo of seen snippet templates, so duplicates can be ignored
 * @param globalTemplates CodeSnippetGlobalTemplates object
 * @param parentCodegenResult If present, template language and title must match this. Used to filter out templates up front during recursion.
 * @returns Promise<void> will push into nodeSnippetTemplateDataArray.
 */
async function snippetTemplatesForNode(
  snippetNode: BaseNode,
  seenSnippetTemplates: { [k: string]: number },
  globalTemplates: CodeSnippetGlobalTemplates,
  parentCodegenResult?: CodegenResult
) {
  const codegenResults = getCodegenResultsFromPluginData(snippetNode);
  const matchingTemplates = (templates: CodegenResult[]) =>
    templates.filter(
      ({ title, language }) =>
        !parentCodegenResult ||
        (title === parentCodegenResult.title &&
          language === parentCodegenResult.language)
    );
  const matchingCodegenResults = matchingTemplates(codegenResults);
  const codegenResultTemplates: CodegenResult[] = [];
  if (matchingCodegenResults.length) {
    const seenKey = JSON.stringify(matchingCodegenResults);
    if (!seenSnippetTemplates[seenKey]) {
      seenSnippetTemplates[seenKey] = 1;
      codegenResultTemplates.push(...matchingCodegenResults);
    }
  }
  if (globalTemplates.components) {
    const componentTemplates =
      "key" in snippetNode
        ? globalTemplates.components[snippetNode.key] || []
        : [];
    codegenResultTemplates.push(...matchingTemplates(componentTemplates));
  }

  if (globalTemplates.types) {
    const typeTemplates = globalTemplates.types[snippetNode.type] || [];
    const seenKey = JSON.stringify(typeTemplates);
    const defaultTemplates =
      !typeTemplates.length &&
      !Object.keys(seenSnippetTemplates).length &&
      !codegenResultTemplates.length &&
      globalTemplates.types.DEFAULT
        ? globalTemplates.types.DEFAULT
        : [];
    if (!seenSnippetTemplates[seenKey]) {
      seenSnippetTemplates[seenKey] = 1;
      codegenResultTemplates.push(...matchingTemplates(typeTemplates));
      codegenResultTemplates.push(...matchingTemplates(defaultTemplates));
    }
  }
  return codegenResultTemplates;
}

/**
 * Transform a string with a filter
 * https://github.com/figma/code-snippet-editor-plugin#filters
 * @param string the string to transform
 * @param rawString the raw form of the string (returned if filter is "raw")
 * @param filter the snippet string filter to apply to the string
 * @returns transformed string with filter applied
 */
export function transformStringWithFilter(
  string: string,
  rawString: string,
  filter: SnippetStringFilter = "hyphen"
) {
  const splitString = string.split("-");
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.substring(1);
  switch (filter) {
    case "camel":
      return splitString
        .map((word, i) => (i === 0 ? word : capitalize(word)))
        .join("");
    case "constant":
      return splitString.join("_").toUpperCase();
    case "hyphen":
      return splitString.join("-").toLowerCase();
    case "pascal":
      return splitString.map(capitalize).join("");
    case "raw":
      return rawString;
    case "snake":
      return splitString.join("_").toLowerCase();
  }
  return splitString.join(" ");
}

/**
 * Fill templates with code snippet params.
 * @param codegenResultTemplatesArray codegen result array of templates loaded from pluginData or global templates.
 * @param codeSnippetParamsMap the map of raw and sanitized params used to hydrate the template.
 * @param nodeType string for the type of node the template is coming from. used in the title in details mode.
 * @param indent the string to use for indent on children
 * @param recursionIndex how deep are we in recursion
 * @param globalTemplates the global templates object for component key or node type based templates
 * @returns a Promise resolving NodeSnippetTemplateData
 */
export async function hydrateSnippets(
  codegenResultTemplatesArray: CodegenResult[],
  codeSnippetParamsMap: CodeSnippetParamsMap,
  nodeType: string,
  indent: string,
  recursionIndex: number,
  globalTemplates: CodeSnippetGlobalTemplates
): Promise<NodeSnippetTemplateData> {
  const codegenResultArray: CodegenResult[] = [];
  const codegenResultRawTemplatesArray: CodegenResult[] = [];

  const resultPromises = codegenResultTemplatesArray.map(
    async (codegenResult, index) => {
      const snippetId = snippetIdFromCodegenResult(codegenResult);
      const code = await hydrateCodeStringWithParams(
        codegenResult.code,
        codeSnippetParamsMap,
        snippetId,
        indent,
        recursionIndex,
        globalTemplates
      );

      /**
       * Prepend indent to every line.
       */
      const indentedCodeString = indent + code.replace(/\n/g, `\n${indent}`);

      codegenResultArray[index] = {
        title: codegenResult.title,
        language: codegenResult.language,
        code: indentedCodeString,
      };

      codegenResultRawTemplatesArray[index] = {
        title: `${codegenResult.title}: Template (${nodeType})`,
        language: "PLAINTEXT",
        code: codegenResult.code,
      };

      return;
    }
  );

  await Promise.all(resultPromises);

  return {
    codegenResultRawTemplatesArray,
    codegenResultArray,
  };
}

async function hydrateCodeStringWithParams(
  codeString: string,
  codeSnippetParamsMap: CodeSnippetParamsMap,
  snippetId: string,
  indent: string,
  recursionIndex: number,
  globalTemplates: CodeSnippetGlobalTemplates
) {
  const { paramsRaw, params, template } = codeSnippetParamsMap;
  const lines = codeString.split("\n");
  const code: string[] = [];
  const templateChildren = template[snippetId]
    ? template[snippetId].children
    : undefined;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const [matches, qualifies] = lineConditionalMatch(
      line,
      params,
      templateChildren
    );
    matches.forEach((match) => {
      line = line.replace(match[0], "");
    });

    const symbolMatches = [...line.matchAll(regexSymbols)];
    if (qualifies && symbolMatches.length) {
      let succeeded = true;
      for (let j = 0; j < symbolMatches.length; j++) {
        const symbolMatch = symbolMatches[j];
        const [match, param, _, filter] = symbolMatch.map((a) =>
          a ? a.trim() : a
        ) as [string, string, string, SnippetStringFilter];
        if (param in params) {
          const value = transformStringWithFilter(
            params[param],
            paramsRaw[param],
            filter
          );
          line = line.replace(match, value);
        } else if (
          param === "figma.children" &&
          recursionIndex < MAX_RECURSION &&
          templateChildren
        ) {
          const indentMatch = line.match(/^[ \t]+/);
          const indent = indentMatch ? indentMatch[0] : "";
          const childrenValue = await findChildrenSnippets(
            templateChildren,
            indent,
            recursionIndex + 1,
            globalTemplates
          );
          if (childrenValue) {
            line = line.replace(/^[ \t]+/, "");
            line = line.replace(match, childrenValue);
          } else {
            succeeded = false;
          }
        } else {
          succeeded = false;
        }
      }

      if (succeeded) {
        line = unescapeBrackets(line);
        code.push(line);
      }
    } else if (qualifies) {
      line = unescapeBrackets(line);
      code.push(line);
    }
  }

  /**
   * Single line syntax collapses "/" prefix and suffix into single line spaces
   * https://github.com/figma/code-snippet-editor-plugin#single-line-syntax
   */
  const singleLineFormatted = code
    .join(`\n`)
    .replace(/\\\\\n/g, "") // collapse single line leading space
    .replace(/\\\n\\/g, "") // collapse single line trailing space
    .replace(/\\\n/g, " "); // collapse single line

  // Indenting each line
  return indent + singleLineFormatted.split("\n").join(`\n${indent}`);
}

/**
 *
 * @param childrenSnippetParams an array of children snippet params map
 * @param indent indentation string
 * @param recursionIndex tracking recursion to prevent infinite loops
 * @param globalTemplates the CodeSnippetGlobalTemplates to reference
 * @returns a Promise that resolves a string of all children snippets with the right indentation.
 */
async function findChildrenSnippets(
  childrenSnippetParams: CodeSnippetParamsMap[],
  indent: string,
  recursionIndex: number,
  globalTemplates: CodeSnippetGlobalTemplates
): Promise<string> {
  const string: string[] = [];
  for (let childSnippetParams of childrenSnippetParams) {
    const snippetId = Object.keys(childSnippetParams.template)[0];
    const template = childSnippetParams.template[snippetId];
    if (template) {
      const hydrated = await hydrateCodeStringWithParams(
        template.code,
        childSnippetParams,
        snippetId,
        indent,
        recursionIndex,
        globalTemplates
      );
      string.push(hydrated);
    }
  }
  return string.filter(Boolean).join("\n");
}

/**
 * Handling any conditional statements and  on a line of a template and determining whether or not to render.
 * No conditional statements is valid, and the line should render.
 * This only checks for conditional statements, symbols can still invalidate the line if the params dont exist.
 * @param line the line of snippet template to validate
 * @param params the params to use to validate or invalidate the line based on a conditional statement.
 * @returns array of the line's qualifing statements as RegExpMatchArray, and whether or not the line can render.
 */
function lineConditionalMatch(
  line: string,
  params: CodeSnippetParams,
  templateChildren?: CodeSnippetParamsMap[]
): [RegExpMatchArray[], boolean] {
  /**
   * Line conditional statement matches.
   * {{?something=value}}
   * {{!something=value}}
   * {{?something}}
   * {{?something=value|something=other}}
   * {{?something=value&other=value}}
   */
  const matches = [...line.matchAll(regexConditional)];

  // No conditional statement on the line. This is valid.
  if (!matches.length) {
    return [[], true];
  }

  let valid = true;
  matches.forEach((match) => {
    const [_, polarity, statements, matchSingle, matchOr, matchAnd] = match.map(
      (a) => (a ? a.trim() : a)
    );
    const isNegative = polarity === "!";
    const isPositive = polarity === "?";

    const isSingle = Boolean(matchSingle);
    const isOr = Boolean(matchOr);
    const isAnd = Boolean(matchAnd);

    const subStatements = statements.split(isOr ? "|" : "&");

    const results = subStatements.map((match) => {
      const matches = match.match(/([^=]+)(=([^\}]+))?/);
      if (matches) {
        const [_, symbol, equals, value] = matches;
        if (symbol === "figma.children") {
          if (!equals && templateChildren) {
            return Boolean(templateChildren.length);
          }
          return false;
        } else {
          const symbolIsDefined = symbol in params;
          const paramsMatch = params[symbol] === value;
          const presenceOnly = !Boolean(equals);
          return presenceOnly ? symbolIsDefined : paramsMatch;
        }
      } else {
        return false;
      }
    });
    if (isNegative && results.includes(true)) {
      valid = false;
    } else if (isPositive) {
      if (isOr && !results.includes(true)) {
        valid = false;
      } else if ((isSingle || isAnd) && results.includes(false)) {
        valid = false;
      }
    }
  });

  return [matches, valid];
}
