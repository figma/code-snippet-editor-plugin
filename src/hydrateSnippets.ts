import { StringFilter, formatString } from "./utils";

const regexQualifierSingle = "([^}&|]+)";
const regexQualifierOr = "([^}&]+)";
const regexQualifierAnd = "([^}|]+)";
const regexQualifiers = [
  regexQualifierSingle,
  regexQualifierOr,
  regexQualifierAnd,
].join("|");
const regexQualifier = new RegExp(`\{\{([\?\!])(${regexQualifiers})\}\}`, "g");

export async function hydrateSnippets(
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

      const symbolMatches = [
        ...line.matchAll(/\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g),
      ];
      if (qualifies && symbolMatches.length) {
        let succeeded = true;
        symbolMatches.forEach((symbolMatch) => {
          const [match, param, _, filter] = symbolMatch.map((a) =>
            a ? a.trim() : a
          ) as [string, string, string, StringFilter];
          if (param in params) {
            const value = formatString(params[param], raw[param], filter);
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
