"use strict";
(() => {
  // src/params.ts
  async function paramsFromNode(node, propertiesOnly = false) {
    const { componentPropValuesMap, instanceParamsMap } = await componentPropertyDataFromNode(node);
    const params = {};
    const paramsRaw = {};
    for (let key in componentPropValuesMap) {
      const item = componentPropValuesMap[key];
      const itemKeys = Object.keys(item);
      if (itemKeys.length > 1) {
        itemKeys.forEach((type) => {
          const value = `${item[type]}`;
          const lowerChar = type.charAt(0).toLowerCase();
          params[`property.${key}.${lowerChar}`] = safeString(value);
          paramsRaw[`property.${key}.${lowerChar}`] = value;
        });
      } else {
        const value = `${item[itemKeys[0]]}`;
        params[`property.${key}`] = safeString(value);
        paramsRaw[`property.${key}`] = value;
      }
      if (itemKeys.includes("INSTANCE_SWAP") && instanceParamsMap[key]) {
        const keyPrefix = itemKeys.length > 1 ? `property.${key}.i` : `property.${key}`;
        for (let k in instanceParamsMap[key].params) {
          params[`${keyPrefix}.${k}`] = safeString(
            instanceParamsMap[key].params[k]
          );
          paramsRaw[`${keyPrefix}.${k}`] = instanceParamsMap[key].paramsRaw[k];
        }
      }
    }
    if (propertiesOnly) {
      return { params, paramsRaw };
    }
    const initial = await initialParamsFromNode(node);
    return {
      params: Object.assign(params, initial.params),
      paramsRaw: Object.assign(paramsRaw, initial.paramsRaw)
    };
  }
  async function componentPropertyDataFromNode(node) {
    const componentPropObject = componentPropObjectFromNode(node);
    const componentPropValuesMap = {};
    const isDefinitions = isComponentPropertyDefinitionsObject(componentPropObject);
    const instanceParamsMap = {};
    for (let propertyName in componentPropObject) {
      const value = isDefinitions ? componentPropObject[propertyName].defaultValue : componentPropObject[propertyName].value;
      const type = componentPropObject[propertyName].type;
      const cleanName = sanitizePropertyName(propertyName);
      if (value !== void 0) {
        componentPropValuesMap[cleanName] = componentPropValuesMap[cleanName] || {};
        if (typeof value === "string") {
          if (type === "VARIANT")
            componentPropValuesMap[cleanName].VARIANT = value;
          if (type === "TEXT")
            componentPropValuesMap[cleanName].TEXT = value;
          if (type === "INSTANCE_SWAP") {
            const foundNode = await figma.getNodeById(value);
            const nodeName = nameFromFoundInstanceSwapNode(foundNode);
            componentPropValuesMap[cleanName].INSTANCE_SWAP = nodeName;
            if (foundNode) {
              instanceParamsMap[cleanName] = await paramsFromNode(
                foundNode,
                true
              );
            }
          }
        } else {
          componentPropValuesMap[cleanName].BOOLEAN = value;
        }
      }
    }
    return { componentPropValuesMap, instanceParamsMap };
  }
  function nameFromFoundInstanceSwapNode(node) {
    return node && node.parent && node.parent.type === "COMPONENT_SET" ? node.parent.name : node ? node.name : "";
  }
  async function initialParamsFromNode(node) {
    const componentNode = getComponentNodeFromNode(node);
    const css = await node.getCSSAsync();
    const autolayout = "inferredAutoLayout" in node ? node.inferredAutoLayout : void 0;
    const paramsRaw = {
      "node.name": node.name,
      "node.type": node.type
    };
    const params = {
      "node.name": safeString(node.name),
      "node.type": safeString(node.type)
    };
    if ("key" in node) {
      paramsRaw["node.key"] = node.key;
      params["node.key"] = node.key;
    }
    if ("children" in node) {
      const childCount = node.children.length.toString();
      paramsRaw["node.children"] = childCount;
      params["node.children"] = childCount;
    }
    if (componentNode && "key" in componentNode) {
      paramsRaw["component.key"] = componentNode.key;
      paramsRaw["component.type"] = componentNode.type;
      paramsRaw["component.name"] = componentNode.name;
      params["component.key"] = componentNode.key;
      params["component.type"] = safeString(componentNode.type);
      params["component.name"] = safeString(componentNode.name);
    }
    for (let key in css) {
      const k = transformStringWithFilter(key, key, "camel");
      params[`css.${k}`] = css[key];
      paramsRaw[`css.${k}`] = css[key];
    }
    if ("boundVariables" in node && node.boundVariables) {
      const boundVariables = node.boundVariables;
      for (let key in boundVariables) {
        let vars = boundVariables[key];
        if (vars) {
          if (!Array.isArray(vars)) {
            vars = [vars];
          }
          vars.forEach((v) => {
            const va = figma.variables.getVariableById(v.id);
            if (va) {
              paramsRaw[`variables.${key}`] = va.name;
              params[`variables.${key}`] = safeString(va.name);
              for (let syntax in va.codeSyntax) {
                const syntaxKey = syntax.charAt(0).toLowerCase();
                const syntaxName = syntax;
                const value = va.codeSyntax[syntaxName];
                if (value) {
                  paramsRaw[`variables.${key}.${syntaxKey}`] = value;
                  params[`variables.${key}.${syntaxKey}`] = safeString(value);
                }
              }
            }
          });
        }
      }
    }
    if (autolayout) {
      const props = [
        "layoutMode",
        "layoutWrap",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
        "itemSpacing",
        "counterAxisSpacing",
        "primaryAxisAlignItems",
        "counterAxisAlignItems"
      ];
      props.forEach((p) => {
        const val = autolayout[p] + "";
        if (val !== "undefined" && val !== "null") {
          paramsRaw[`autolayout.${p}`] = val;
          params[`autolayout.${p}`] = safeString(val);
        }
      });
    }
    return { params, paramsRaw };
  }
  function isComponentPropertyDefinitionsObject(object) {
    return object[Object.keys(object)[0]] && "defaultValue" in object[Object.keys(object)[0]];
  }
  function componentPropObjectFromNode(node) {
    if (node.type === "INSTANCE")
      return node.componentProperties;
    if (node.type === "COMPONENT_SET")
      return node.componentPropertyDefinitions;
    if (node.type === "COMPONENT") {
      if (node.parent && node.parent.type === "COMPONENT_SET") {
        const initialProps = Object.assign(
          {},
          node.parent.componentPropertyDefinitions
        );
        const nameProps = node.name.split(", ");
        nameProps.forEach((prop) => {
          const [propName, propValue] = prop.split("=");
          initialProps[propName].defaultValue = propValue;
        });
        return initialProps;
      } else {
        return node.componentPropertyDefinitions;
      }
    }
    return {};
  }
  function capitalize(name) {
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }
  function downcase(name) {
    return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }
  function numericGuard(name = "") {
    if (name.charAt(0).match(/\d/)) {
      name = `N${name}`;
    }
    return name;
  }
  function capitalizedNameFromName(name = "") {
    name = numericGuard(name);
    return name.split(/[^a-zA-Z\d]+/g).map(capitalize).join("");
  }
  function sanitizePropertyName(name) {
    name = name.replace(/#[^#]+$/g, "");
    return downcase(capitalizedNameFromName(name).replace(/^\d+/g, ""));
  }
  function getComponentNodeFromNode(node) {
    const { type, parent } = node;
    const parentType = parent ? parent.type : "";
    const isVariant = parentType === "COMPONENT_SET";
    if (type === "COMPONENT_SET" || type === "COMPONENT" && !isVariant) {
      return node;
    } else if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") {
      return node.parent;
    } else if (type === "INSTANCE") {
      const { mainComponent } = node;
      return mainComponent ? mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET" ? mainComponent.parent : mainComponent : null;
    }
    return null;
  }
  function safeString(string = "") {
    string = string.replace(/([^a-zA-Z0-9-_// ])/g, "");
    if (!string.match(/^[A-Z0-9_]+$/)) {
      string = string.replace(/([A-Z])/g, " $1");
    }
    return string.replace(/([a-z])([0-9])/g, "$1 $2").replace(/([-_/])/g, " ").replace(/  +/g, " ").trim().toLowerCase().split(" ").join("-");
  }

  // src/pluginData.ts
  var PLUGIN_DATA_NAMESPACE = "codesnippets";
  var PLUGIN_DATA_KEY = "snippets";
  var CODEGEN_LANGUAGES = [
    "BASH",
    "CPP",
    "CSS",
    "GO",
    "GRAPHQL",
    "HTML",
    "JAVASCRIPT",
    "JSON",
    "KOTLIN",
    "PLAINTEXT",
    "PYTHON",
    "RUBY",
    "RUST",
    "SQL",
    "SWIFT",
    "TYPESCRIPT"
  ];
  function getCodegenResultsFromPluginData(node) {
    const pluginData = node.getSharedPluginData(
      PLUGIN_DATA_NAMESPACE,
      PLUGIN_DATA_KEY
    );
    return pluginDataStringAsValidCodegenResults(pluginData) || [];
  }
  function valueIsCodegenLanguage(value) {
    return CODEGEN_LANGUAGES.includes(value);
  }
  function objectIsCodegenResult(object) {
    if (typeof object !== "object")
      return false;
    if (Object.keys(object).length !== 3)
      return false;
    if (!("title" in object && "code" in object && "language" in object))
      return false;
    if (typeof object.title !== "string" || typeof object.code !== "string")
      return false;
    return valueIsCodegenLanguage(object.language);
  }
  function arrayContainsCodegenResults(array) {
    let valid = true;
    if (Array.isArray(array)) {
      array.forEach((object) => {
        if (!objectIsCodegenResult(object)) {
          valid = false;
        }
      });
    } else {
      valid = false;
    }
    return valid;
  }
  function pluginDataStringAsValidCodegenResults(pluginDataString) {
    if (!pluginDataString)
      return null;
    try {
      const parsed = JSON.parse(pluginDataString);
      return arrayContainsCodegenResults(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  // src/snippets.ts
  var MAX_RECURSION = 12;
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
  async function nodeSnippetTemplateDataArrayFromNode(node, codeSnippetParamsMap, globalTemplates, indent = "", recursionIndex = 0, parentCodegenResult) {
    const nodeSnippetTemplateDataArray = [];
    const seenSnippetTemplates = {};
    async function processSnippetTemplatesForNode(snippetNode) {
      const codegenResults = getCodegenResultsFromPluginData(snippetNode);
      const matchingTemplates = (templates) => templates.filter(
        ({ title, language }) => !parentCodegenResult || title === parentCodegenResult.title && language === parentCodegenResult.language
      );
      const matchingCodegenResults = matchingTemplates(codegenResults);
      const codegenResultTemplates = [];
      if (matchingCodegenResults.length) {
        const seenKey = JSON.stringify(matchingCodegenResults);
        if (!seenSnippetTemplates[seenKey]) {
          seenSnippetTemplates[seenKey] = 1;
          codegenResultTemplates.push(...matchingCodegenResults);
        }
      }
      if (globalTemplates) {
        const componentTemplates = "key" in snippetNode && globalTemplates.components ? globalTemplates.components[snippetNode.key] || [] : [];
        const typeTemplates = globalTemplates.types ? globalTemplates.types[snippetNode.type] || [] : [];
        codegenResultTemplates.push(...matchingTemplates(componentTemplates));
        codegenResultTemplates.push(...matchingTemplates(typeTemplates));
      }
      const children = "children" in node ? node.children : [];
      const nodeSnippetTemplateData = await hydrateSnippets(
        codegenResultTemplates,
        codeSnippetParamsMap,
        snippetNode.type,
        children,
        indent,
        recursionIndex,
        globalTemplates
      );
      nodeSnippetTemplateDataArray.push(nodeSnippetTemplateData);
    }
    await processSnippetTemplatesForNode(node);
    if (node.type === "INSTANCE") {
      if (node.mainComponent) {
        await processSnippetTemplatesForNode(node.mainComponent);
        if (node.mainComponent.parent && node.mainComponent.parent.type === "COMPONENT_SET") {
          await processSnippetTemplatesForNode(node.mainComponent.parent);
        }
      }
    } else if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") {
      await processSnippetTemplatesForNode(node.parent);
    }
    return nodeSnippetTemplateDataArray;
  }
  function transformStringWithFilter(string, rawString, filter = "hyphen") {
    const splitString = string.split("-");
    const capitalize2 = (s) => s.charAt(0).toUpperCase() + s.substring(1);
    switch (filter) {
      case "camel":
        return splitString.map((word, i) => i === 0 ? word : capitalize2(word)).join("");
      case "constant":
        return splitString.join("_").toUpperCase();
      case "hyphen":
        return splitString.join("-").toLowerCase();
      case "pascal":
        return splitString.map(capitalize2).join("");
      case "raw":
        return rawString;
      case "snake":
        return splitString.join("_").toLowerCase();
    }
    return splitString.join(" ");
  }
  async function hydrateSnippets(codegenResultTemplatesArray, codeSnippetParamsMap, nodeType, nodeChildren, indent, recursionIndex, globalTemplates) {
    const { paramsRaw, params } = codeSnippetParamsMap;
    const codegenResultArray = [];
    const codegenResultRawTemplatesArray = [];
    const resultPromises = codegenResultTemplatesArray.map(
      async (codegenResult) => {
        const lines = codegenResult.code.split("\n");
        const code = [];
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          const [matches, qualifies] = lineConditionalMatch(line, params);
          matches.forEach((match) => {
            line = line.replace(match[0], "");
          });
          const symbolMatches = [...line.matchAll(regexSymbols)];
          if (qualifies && symbolMatches.length) {
            let succeeded = true;
            for (let j = 0; j < symbolMatches.length; j++) {
              const symbolMatch = symbolMatches[j];
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
              } else if (param === "figma.children" && recursionIndex < MAX_RECURSION) {
                const indentMatch = line.match(/^[ \t]+/);
                const indent2 = indentMatch ? indentMatch[0] : "";
                const value = await findChildrenSnippets(
                  codegenResult,
                  nodeChildren,
                  indent2,
                  recursionIndex + 1,
                  globalTemplates
                );
                if (value) {
                  line = line.replace(/^[ \t]+/, "");
                  line = line.replace(match, value);
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
        const codeString = code.join("\n").replace(/\\\\\n/g, "").replace(/\\\n\\/g, "").replace(/\\\n/g, " ");
        const indentedCodeString = indent + codeString.replace(/\n/g, `
${indent}`);
        codegenResultArray.push({
          title: codegenResult.title,
          language: codegenResult.language,
          code: indentedCodeString
        });
        codegenResultRawTemplatesArray.push({
          title: `${codegenResult.title}: Template (${nodeType})`,
          language: "PLAINTEXT",
          code: codegenResult.code
        });
        return;
      }
    );
    await Promise.all(resultPromises);
    return {
      codegenResultRawTemplatesArray,
      codegenResultArray
    };
  }
  async function findChildrenSnippets(codegenResult, nodeChildren, indent, recursionIndex, globalTemplates) {
    const string = [];
    const childPromises = nodeChildren.map(async (child) => {
      const paramsMap = await paramsFromNode(child);
      const snippets = await nodeSnippetTemplateDataArrayFromNode(
        child,
        paramsMap,
        globalTemplates,
        indent,
        recursionIndex + 1,
        codegenResult
      );
      const snippet = snippets.map(
        (s) => s.codegenResultArray.find(
          (r) => r.title === codegenResult.title && r.language === codegenResult.language
        )
      ).find(Boolean);
      if (snippet) {
        string.push(snippet.code);
      }
      return;
    });
    await Promise.all(childPromises);
    return string.join("\n");
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
    "{{?1=1&2=2}}{{!hello=cheese}}compound": "compound",
    "{{figma.children}}": "",
    "Hello, {{figma.children}}": "",
    "{{1}}{{hello}}{{2}}": "1world2",
    "{{1}}{{invalid}}{{2}}": ""
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
      "INSTANCE",
      [],
      "",
      0,
      {}
    );
    const code = result.codegenResultArray[0].code;
    if (code === SNIPPET_TEST_CODE_EXPECTATION) {
      return true;
    }
    throw `Snippet hydration broken. Got: "${code}"`;
  }
  test().then(console.log).catch(console.error);
})();
