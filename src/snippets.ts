import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "./config";

const regexSymbols = /\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g;
const regexQualifierSingle = "([^}&|]+)";
const regexQualifierOr = "([^}&]+)";
const regexQualifierAnd = "([^}|]+)";
const regexQualifiers = [
  regexQualifierSingle,
  regexQualifierOr,
  regexQualifierAnd,
].join("|");
const regexQualifier = new RegExp(`\{\{([\?\!])(${regexQualifiers})\}\}`, "g");

export async function snippetDataFromNode(
  currentNode: SceneNode,
  paramsMap: CodeSnippetParamsMap
) {
  const data: SnippetData[] = [];
  const seenTemplates: { [k: string]: number } = {};

  async function pluginDataForNode(node: SceneNode) {
    const pluginData = node.getSharedPluginData(
      PLUGIN_DATA_NAMESPACE,
      PLUGIN_DATA_KEY
    );
    // skipping duplicates. why?
    // component instances have same pluginData as mainComponent, unless they have override pluginData.
    if (pluginData && !seenTemplates[pluginData]) {
      seenTemplates[pluginData] = 1;
      const { pluginDataArray, codeArray } = await hydrateSnippets(
        pluginData,
        paramsMap
      );
      data.push({ codeArray, pluginDataArray, nodeType: node.type });
    }
  }

  await pluginDataForNode(currentNode);
  if (currentNode.type === "INSTANCE") {
    if (currentNode.mainComponent) {
      await pluginDataForNode(currentNode.mainComponent);
      if (
        currentNode.mainComponent.parent &&
        currentNode.mainComponent.parent.type === "COMPONENT_SET"
      ) {
        await pluginDataForNode(currentNode.mainComponent.parent);
      }
    }
  } else if (
    currentNode.type === "COMPONENT" &&
    currentNode.parent &&
    currentNode.parent.type === "COMPONENT_SET"
  ) {
    await pluginDataForNode(currentNode.parent);
  }
  return data;
}

export function formatStringWithFilter(
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

async function hydrateSnippets(
  pluginData: string,
  { raw, params }: CodeSnippetParamsMap
) {
  const pluginDataArray = JSON.parse(pluginData) as CodegenResult[];
  const codeArray: string[] = [];

  pluginDataArray.forEach((pluginData) => {
    const lines = pluginData.code.split("\n");
    const code: string[] = [];
    lines.forEach((line) => {
      const [matches, qualifies] = lineQualifierMatch(line, params);
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
            const value = formatStringWithFilter(
              params[param],
              raw[param],
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

    const codeString = code
      .join("\n")
      .replace(/\\\\\n/g, "") // collapse single line leading space
      .replace(/\\\n\\/g, "") // collapse single line trailing space
      .replace(/\\\n/g, " "); // collapse single line

    codeArray.push(codeString);
  });

  return { params, pluginDataArray, codeArray };
}

function lineQualifierMatch(
  line: string,
  params: CodeSnippetParams
): [RegExpMatchArray[], boolean] {
  // Line qualifier statement. {{?something=value}} | {{!something=value}} | {{?something}}
  const matches = [...line.matchAll(regexQualifier)];

  // No qualifier statement on the line. This is valid.
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
