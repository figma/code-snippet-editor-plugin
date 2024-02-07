"use strict";
(() => {
  // src/snippets.ts
  var regexSymbols = /(?<!\\)\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g;
  var unescapeBrackets = (line) => line.replace(/\\\{\{/g, "{{");
  var regexConditionalSingle = "([^}&|]+)";
  var regexConditionalOr = "([^}&]+)";
  var regexConditionalAnd = "([^}|]+)";
  var regexConditionals = [
    regexConditionalSingle,
    regexConditionalOr,
    regexConditionalAnd
  ].join("|");
  var regexConditional = new RegExp(
    `{{([?!])(${regexConditionals})}}`,
    "g"
  );
  function transformStringWithFilter(string, rawString, filter = "hyphen") {
    const splitString = string.split("-");
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.substring(1);
    switch (filter) {
      case "camel":
        return splitString.map((word, i) => i === 0 ? word : capitalize(word)).join("");
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
  async function hydrateSnippets(codegenResultTemplatesArray, codeSnippetParamsMap, nodeType) {
    const { paramsRaw, params } = codeSnippetParamsMap;
    const codegenResultArray = [];
    const codegenResultRawTemplatesArray = [];
    codegenResultTemplatesArray.forEach((codegenResult) => {
      const lines = codegenResult.code.split("\n");
      const code = [];
      lines.forEach((line) => {
        const [matches, qualifies] = lineConditionalMatch(line, params);
        matches.forEach((match) => {
          line = line.replace(match[0], "");
        });
        const symbolMatches = [...line.matchAll(regexSymbols)];
        if (qualifies && symbolMatches.length) {
          let succeeded = true;
          symbolMatches.forEach((symbolMatch) => {
            const [match, param, _, filter] = symbolMatch.map(
              (a) => a ? a.trim() : a
            );
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
            line = unescapeBrackets(line);
            code.push(line);
          }
        } else if (qualifies) {
          line = unescapeBrackets(line);
          code.push(line);
        }
      });
      const codeString = code.join("\n").replace(/\\\\\n/g, "").replace(/\\\n\\/g, "").replace(/\\\n/g, " ");
      codegenResultArray.push({
        title: codegenResult.title,
        language: codegenResult.language,
        code: codeString
      });
      codegenResultRawTemplatesArray.push({
        title: `${codegenResult.title}: Template (${nodeType})`,
        language: "PLAINTEXT",
        code: codegenResult.code
      });
    });
    return {
      codegenResultRawTemplatesArray,
      codegenResultArray
    };
  }
  function lineConditionalMatch(line, params) {
    const matches = [...line.matchAll(regexConditional)];
    if (!matches.length) {
      return [[], true];
    }
    let valid = true;
    matches.forEach((match) => {
      const [_, polarity, statements, matchSingle, matchOr, matchAnd] = match.map(
        (a) => a ? a.trim() : a
      );
      const isNegative = polarity === "!";
      const isPositive = polarity === "?";
      const isSingle = Boolean(matchSingle);
      const isOr = Boolean(matchOr);
      const isAnd = Boolean(matchAnd);
      const subStatements = statements.split(isOr ? "|" : "&");
      const results = subStatements.map((match2) => {
        const matches2 = match2.match(/([^=]+)(=([^\}]+))?/);
        if (matches2) {
          const [_2, symbol, equals, value] = matches2;
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

  // src/test.ts
  var SNIPPET_TEST_PARAMS = {
    hello: "world",
    1: "1",
    2: "2"
  };
  var SNIPPET_TESTS = {
    "{{hello}}": "world",
    "\\{{escaped}}": "{{escaped}}",
    "{{?1=1&2=2}}1and2": "1and2",
    "{{?1=1|2=3}}1": "1",
    "{{?1=2|2=3}}1or2": "",
    "{{!1=1}}not1": "",
    "{{!1=2}}not1": "not1",
    "{{?1=1&2=2}}{{!hello=cheese}}compound": "compound"
  };
  var SNIPPET_TEST_CODE = Object.keys(SNIPPET_TESTS).join("\n");
  var SNIPPET_TEST_CODE_EXPECTATION = Object.values(SNIPPET_TESTS).filter(Boolean).join("\n");
  async function test() {
    try {
      await testSnippets();
      return "Tests succeed!";
    } catch (e) {
      throw e;
    }
  }
  async function testSnippets() {
    const result = await hydrateSnippets(
      [{ language: "PLAINTEXT", code: SNIPPET_TEST_CODE, title: "test" }],
      { params: SNIPPET_TEST_PARAMS, paramsRaw: SNIPPET_TEST_PARAMS },
      "INSTANCE"
    );
    const code = result.codegenResultArray[0].code;
    if (code === SNIPPET_TEST_CODE_EXPECTATION) {
      return true;
    }
    throw `Snippet hydration broken. Got: "${code}"`;
  }
  test().then(console.log).catch(console.error);
})();
