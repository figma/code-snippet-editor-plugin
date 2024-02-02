import { getPluginData } from "./pluginData";

/**
 * Regular expression for finding symbols, aka {{property.variant}} in a string.
 * Ignores ? and ! which indicate conditional statements.
 * Three groups:
 *  1. the symbol itself
 *  2. whole filter string
 *  3. subset of filter string that represents the filter value
 */
const regexSymbols = /\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g;
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
const regexConditional = new RegExp(`\{\{([\?\!])(${regexConditionals})\}\}`, "g");

/**
 * Given a node, get all the relevant snippet templates stored in shared plugin data and hydrate them with params.
 * For component-like nodes, this will discover inherited templates (component set > component > instance).
 * @param node the node to find relevant snippets for from plugin data
 * @param codeSnippetParamsMap the map of params that can fill the templates
 * @returns NodeSnippetTemplateData array containing hydrated snippets for the current node.
 */
export async function nodeSnippetTemplateDataArrayFromNode(
  node: SceneNode,
  codeSnippetParamsMap: CodeSnippetParamsMap
): Promise<NodeSnippetTemplateData[]> {
  const nodeSnippetTemplateDataArray: NodeSnippetTemplateData[] = [];
  const seenSnippetTemplates: { [k: string]: number } = {};

  /**
   * Process snippets for any node. Called multiple times up the lineage for component and instance nodes.
   * Instances have the same pluginData as their mainComponent, unless they have overridden the pluginData.
   * This tracks these duplicate cases in seenSnippetTemplates and filters them out.
   * @param node the node to check for templates in plugin data
   * @returns Promise<void> will push into nodeSnippetTemplateDataArray.
   */
  async function processSnippetTemplatesForNode(node: SceneNode) {
    const pluginData = getPluginData(node);
    if (pluginData && !seenSnippetTemplates[pluginData]) {
      seenSnippetTemplates[pluginData] = 1;
      const nodeSnippetTemplateData = await hydrateSnippets(
        pluginData,
        codeSnippetParamsMap,
        node.type
      );
      nodeSnippetTemplateDataArray.push(nodeSnippetTemplateData);
    }
  }

  /**
   * Templates on the given node
   */
  await processSnippetTemplatesForNode(node);

  /**
   * Templates via inheritance from component lineage
   */
  if (node.type === "INSTANCE") {
    if (node.mainComponent) {
      await processSnippetTemplatesForNode(node.mainComponent);
      if (
        node.mainComponent.parent &&
        node.mainComponent.parent.type === "COMPONENT_SET"
      ) {
        await processSnippetTemplatesForNode(node.mainComponent.parent);
      }
    }
  } else if (
    node.type === "COMPONENT" &&
    node.parent &&
    node.parent.type === "COMPONENT_SET"
  ) {
    await processSnippetTemplatesForNode(node.parent);
  }

  return nodeSnippetTemplateDataArray;
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
 * @param pluginData string form of the snippet templates loaded from pluginData.
 * @param codeSnippetParamsMap the map of raw and sanitized params used to hydrate the template.
 * @returns a Promise resolving NodeSnippetTemplateData
 */
async function hydrateSnippets(
  pluginData: string,
  codeSnippetParamsMap: CodeSnippetParamsMap,
  nodeType: string
): Promise<NodeSnippetTemplateData> {
  const { paramsRaw, params } = codeSnippetParamsMap;
  const pluginDataArray = JSON.parse(pluginData) as CodegenResult[];
  const codegenResultArray: CodegenResult[] = [];
  const codegenResultRawTemplatesArray: CodegenResult[] = [];

  pluginDataArray.forEach((pluginData) => {
    const lines = pluginData.code.split("\n");
    const code: string[] = [];
    lines.forEach((line) => {
      const [matches, qualifies] = lineConditionalMatch(line, params);
      matches.forEach((match) => {
        line = line.replace(match[0], "");
      });

      const symbolMatches = [...line.matchAll(regexSymbols)];
      if (qualifies && symbolMatches.length) {
        let succeeded = true;
        symbolMatches.forEach((symbolMatch) => {
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
          } else if (param === "figma.children") {
            console.log("HELLO WORLD");
          } else {
            succeeded = false;
          }
        });
        if (succeeded) {
          code.push(line);
        }
      } else if (qualifies) {
        code.push(line);
      }
    });

    /**
     * Single line syntax collapses "/" prefix and suffix into single line spaces
     * https://github.com/figma/code-snippet-editor-plugin#single-line-syntax
     */
    const codeString = code
      .join("\n")
      .replace(/\\\\\n/g, "") // collapse single line leading space
      .replace(/\\\n\\/g, "") // collapse single line trailing space
      .replace(/\\\n/g, " "); // collapse single line

    codegenResultArray.push({
      title: pluginData.title,
      language: pluginData.language,
      code: codeString,
    });

    codegenResultRawTemplatesArray.push({
      title: `${pluginData.title}: Template (${nodeType})`,
      language: "PLAINTEXT",
      code: pluginData.code,
    });
  });

  return {
    codegenResultRawTemplatesArray,
    codegenResultArray,
  };
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
  params: CodeSnippetParams
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
        const symbolIsDefined = symbol in params;
        const paramsMatch = params[symbol] === value;
        const presenceOnly = !Boolean(equals);
        return presenceOnly ? symbolIsDefined : paramsMatch;
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
