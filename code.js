"use strict";
(() => {
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
  function setCodegenResultsInPluginData(node, codegenResultArray) {
    if (node && arrayContainsCodegenResults(codegenResultArray))
      return node.setSharedPluginData(
        PLUGIN_DATA_NAMESPACE,
        PLUGIN_DATA_KEY,
        JSON.stringify(codegenResultArray)
      );
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
    const templatesWithInheritanceNode = await snippetTemplatesWithInheritanceNode(
      node,
      globalTemplates,
      parentCodegenResult
    );
    for (let [
      inheritanceNode,
      snippetTemplates
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
  async function snippetTemplatesWithInheritanceNode(node, globalTemplates, parentCodegenResult) {
    const seenSnippetTemplates = {};
    const nodeAndTemplates = [];
    if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") {
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
        if (node.mainComponent.parent && node.mainComponent.parent.type === "COMPONENT_SET") {
          const componentSetTemplates = await snippetTemplatesForNode(
            node.mainComponent.parent,
            seenSnippetTemplates,
            globalTemplates,
            parentCodegenResult
          );
          if (componentSetTemplates.length) {
            nodeAndTemplates.push([
              node.mainComponent.parent,
              componentSetTemplates
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
  async function snippetTemplatesForNode(snippetNode, seenSnippetTemplates, globalTemplates, parentCodegenResult) {
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
    if (globalTemplates.components) {
      const componentTemplates = "key" in snippetNode ? globalTemplates.components[snippetNode.key] || [] : [];
      codegenResultTemplates.push(...matchingTemplates(componentTemplates));
    }
    if (!Object.keys(seenSnippetTemplates).length && !codegenResultTemplates.length && globalTemplates.types) {
      const typeTemplates = globalTemplates.types[snippetNode.type] || [];
      const seenKey = JSON.stringify(typeTemplates);
      if (!seenSnippetTemplates[seenKey]) {
        seenSnippetTemplates[seenKey] = 1;
        const defaultTemplates = !typeTemplates.length && globalTemplates.types.DEFAULT ? globalTemplates.types.DEFAULT : [];
        codegenResultTemplates.push(...matchingTemplates(typeTemplates));
        codegenResultTemplates.push(...matchingTemplates(defaultTemplates));
      }
    }
    return codegenResultTemplates;
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
  async function hydrateSnippets(codegenResultTemplatesArray, codeSnippetParamsMap, nodeType, indent, recursionIndex, globalTemplates) {
    const codegenResultArray = [];
    const codegenResultRawTemplatesArray = [];
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
        const indentedCodeString = indent + code.replace(/\n/g, `
${indent}`);
        codegenResultArray[index] = {
          title: codegenResult.title,
          language: codegenResult.language,
          code: indentedCodeString
        };
        codegenResultRawTemplatesArray[index] = {
          title: `${codegenResult.title}: Template (${nodeType})`,
          language: "PLAINTEXT",
          code: codegenResult.code
        };
        return;
      }
    );
    await Promise.all(resultPromises);
    return {
      codegenResultRawTemplatesArray,
      codegenResultArray
    };
  }
  async function hydrateCodeStringWithParams(codeString, codeSnippetParamsMap, snippetId, indent, recursionIndex, globalTemplates) {
    const { paramsRaw, params, template } = codeSnippetParamsMap;
    const lines = codeString.split("\n");
    const code = [];
    const templateChildren = template[snippetId] ? template[snippetId].children : void 0;
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
          } else if (param === "figma.children" && recursionIndex < MAX_RECURSION && templateChildren) {
            const indentMatch = line.match(/^[ \t]+/);
            const indent2 = indentMatch ? indentMatch[0] : "";
            const childrenValue = await findChildrenSnippets(
              templateChildren,
              indent2,
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
    const singleLineFormatted = code.join(`
`).replace(/\\\\\n/g, "").replace(/\\\n\\/g, "").replace(/\\\n/g, " ");
    return indent + singleLineFormatted.split("\n").join(`
${indent}`);
  }
  async function findChildrenSnippets(childrenSnippetParams, indent, recursionIndex, globalTemplates) {
    const string = [];
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
  function lineConditionalMatch(line, params, templateChildren) {
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
      return { params, paramsRaw, template: {} };
    }
    const initial = await initialParamsFromNode(node);
    return {
      params: Object.assign(params, initial.params),
      paramsRaw: Object.assign(paramsRaw, initial.paramsRaw),
      template: {}
    };
  }
  function snippetIdFromCodegenResult(codegenResult) {
    return `${codegenResult.title}-${codegenResult.language}`;
  }
  async function recursiveParamsFromNode(node, globalTemplates, specificSnippetId) {
    const children = "children" in node ? node.children.filter((n) => "visible" in n ? n.visible : true) : [];
    const childrenTemplatesObject = {};
    for (let child of children) {
      const templatesArray = await snippetTemplatesWithInheritanceNode(
        child,
        globalTemplates
      );
      const templates = templatesArray.flatMap((result) => result[1]);
      templates.forEach((template) => {
        const snippetId = snippetIdFromCodegenResult(template);
        if (!specificSnippetId || snippetId === specificSnippetId) {
          childrenTemplatesObject[snippetId] = childrenTemplatesObject[snippetId] || [];
          childrenTemplatesObject[snippetId].push(child);
        }
      });
    }
    const nodeTemplatesArray = await snippetTemplatesWithInheritanceNode(
      node,
      globalTemplates
    );
    const nodeTemplates = nodeTemplatesArray.flatMap((result) => result[1]);
    const nodeTemplatesObject = {};
    for (let template of nodeTemplates) {
      const snippetId = snippetIdFromCodegenResult(template);
      if (!specificSnippetId || snippetId === specificSnippetId) {
        nodeTemplatesObject[snippetId] = nodeTemplatesObject[snippetId] || {
          code: template.code
        };
        if (template.code.match(/\{\{ *figma.children *\}\}/)) {
          if (childrenTemplatesObject[snippetId]) {
            nodeTemplatesObject[snippetId].children = await Promise.all(
              childrenTemplatesObject[snippetId].map(
                async (child) => await recursiveParamsFromNode(child, globalTemplates, snippetId)
              )
            );
          }
        }
        if (template.code.match(/\{\{ *figma.svg *\}\}/) && "exportAsync" in node) {
          nodeTemplatesObject[snippetId].svg = (await node.exportAsync({ format: "SVG" })).toString();
        }
      }
    }
    const { params, paramsRaw } = await paramsFromNode(node);
    return {
      params,
      paramsRaw,
      template: nodeTemplatesObject
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
    if (node.type === "TEXT") {
      paramsRaw["node.characters"] = node.characters;
      params["node.characters"] = safeString(node.characters);
      if (node.textStyleId) {
        if (node.textStyleId === figma.mixed) {
          paramsRaw["node.textStyle"] = "figma.mixed";
          params["node.textStyle"] = "figma.mixed";
        } else {
          const style = figma.getStyleById(node.textStyleId);
          if (style) {
            paramsRaw["node.textStyle"] = style.name;
            params["node.textStyle"] = safeString(style.name);
          }
        }
      }
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
    return { params, paramsRaw, template: {} };
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

  // src/templates.ts
  var CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY = "global-templates";
  var TEMPLATE_VARIABLE_COLLECTION_NAME = "Code Snippet Editor Global Templates";
  function templatesIsCodeSnippetGlobalTemplates(templates) {
    if (typeof templates === "object" && !Array.isArray(templates)) {
      const keys = Object.keys(templates);
      if (keys.find((k) => k !== "components" && k !== "types")) {
        return false;
      }
      return true;
    }
    return false;
  }
  async function getEncodedGlobalTemplatesFromTeamLibrary() {
    const collectionsFromTeamLibraries = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const collection = collectionsFromTeamLibraries.find(
      (collection2) => collection2.name === TEMPLATE_VARIABLE_COLLECTION_NAME
    );
    if (collection) {
      const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
        collection.key
      );
      return libraryVariables[0].name || null;
    }
    return null;
  }
  async function loadTemplatesFromPage() {
    const templates = {};
    templates.types = {};
    figma.currentPage.children.forEach((node) => {
      const result = getCodegenResultsFromPluginData(node);
      if (templates.types && result.length) {
        templates.types[node.name] = result;
      }
    });
    if (Object.keys(templates.components || {}).length || Object.keys(templates.types).length) {
      return templates;
    } else {
      return null;
    }
  }
  async function getGlobalTemplatesFromClientStorage() {
    const templates = await figma.clientStorage.getAsync(
      CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY
    );
    return templates && templatesIsCodeSnippetGlobalTemplates(templates) ? templates : null;
  }
  async function setGlobalTemplatesInTeamLibrary(templatesEncodedString) {
    const collections = figma.variables.getLocalVariableCollections();
    const collection = collections.find(
      (collection2) => collection2.name === TEMPLATE_VARIABLE_COLLECTION_NAME
    ) || figma.variables.createVariableCollection(TEMPLATE_VARIABLE_COLLECTION_NAME);
    const variable = collection.variableIds.length ? figma.variables.getVariableById(collection.variableIds[0]) : null;
    if (variable) {
      variable.name = templatesEncodedString;
    } else {
      const vari = figma.variables.createVariable(
        templatesEncodedString,
        collection.id,
        "STRING"
      );
      vari.setValueForMode(collection.defaultModeId, "DO NOT TOUCH");
    }
  }
  async function setGlobalTemplatesInClientStorage(templates) {
    await figma.clientStorage.setAsync(
      CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY,
      templates
    );
    return;
  }

  // src/code.ts
  initializeUIMessageHandler();
  if (figma.mode === "codegen") {
    initializeCodegenMode();
  } else {
    openGlobalTemplateUI();
  }
  function initializeUIMessageHandler() {
    figma.ui.on(
      "message",
      async (event) => {
        switch (event.type) {
          case "EDITOR_INITIALIZE":
            handleCurrentSelection();
            break;
          case "EDITOR_SAVE":
            setCodegenResultsInPluginData(
              figma.currentPage.selection[0],
              event.data
            );
            figma.notify("Saved to node!");
            break;
          case "TEMPLATES_SAVE":
            if (event.saveToTeamLibrary && event.dataEncodedString) {
              setGlobalTemplatesInTeamLibrary(event.dataEncodedString);
              figma.notify("Saved to team library!");
            } else {
              setGlobalTemplatesInClientStorage(event.data);
              figma.notify("Saved to client storage!");
            }
            const message = { type: "TEMPLATES_SAVE_RESULT" };
            figma.ui.postMessage(message);
            break;
          case "TEMPLATES_LOAD":
            if (event.loadFromTeamLibrary) {
              const templates = await getEncodedGlobalTemplatesFromTeamLibrary();
              const message2 = {
                type: "TEMPLATES_LOAD_TEAM_LIBRARY_RESULT",
                templates
              };
              figma.ui.postMessage(message2);
              if (!templates) {
                figma.notify("No templates defined in team library");
              }
            } else {
              const templates = await loadTemplatesFromPage();
              const message2 = {
                type: "TEMPLATES_LOAD_PAGE_RESULT",
                templates
              };
              figma.ui.postMessage(message2);
              if (!templates) {
                figma.notify("No templates defined on this page");
              }
            }
            break;
          default:
            console.log("UNKNOWN EVENT", event);
        }
      }
    );
  }
  async function initializeCodegenMode() {
    figma.codegen.on("preferenceschange", async (event) => {
      if (event.propertyName === "editor") {
        openCodeSnippetEditorUI();
      } else if (event.propertyName === "templates") {
        openGlobalTemplateUI();
      }
    });
    figma.on("selectionchange", () => handleCurrentSelection);
    figma.codegen.on("generate", async () => {
      try {
        const { detailsMode, defaultSnippet } = figma.codegen.preferences.customSettings;
        const isDetailsMode = detailsMode === "on";
        const hasDefaultMessage = defaultSnippet === "message";
        const currentNode = handleCurrentSelection();
        const templates = await getGlobalTemplatesFromClientStorage() || {};
        const recursiveParamsMap = await recursiveParamsFromNode(
          currentNode,
          templates
        );
        const nodeSnippetTemplateDataArray = await nodeSnippetTemplateDataArrayFromNode(
          currentNode,
          recursiveParamsMap,
          templates
        );
        const snippets = codegenResultsFromNodeSnippetTemplateDataArray(
          nodeSnippetTemplateDataArray,
          isDetailsMode
        );
        if (isDetailsMode) {
          snippets.push({
            title: "Params",
            code: JSON.stringify(recursiveParamsMap, null, 2),
            language: "JSON"
          });
        }
        if (!snippets.length && hasDefaultMessage) {
          snippets.push({
            title: "Snippets",
            code: "No snippets on this node. Add snippets via the Snippet Editor.",
            language: "PLAINTEXT"
          });
        }
        return snippets;
      } catch (e) {
        console.error(e);
        return [
          {
            language: "PLAINTEXT",
            code: typeof e === "string" ? e : `${e}`,
            title: "Error"
          }
        ];
      }
    });
  }
  async function openCodeSnippetEditorUI() {
    const { x, y, width, height } = figma.viewport.bounds;
    const absWidth = width * figma.viewport.zoom;
    const absHeight = height * figma.viewport.zoom;
    const finalWidth = Math.round(
      Math.max(Math.min(absWidth, 400), Math.min(absWidth * 0.6, 700))
    );
    const finalHeight = Math.round(Math.min(absHeight, 600));
    const realX = x + Math.round(absWidth - finalWidth);
    figma.showUI(__uiFiles__.editor, {
      position: { x: realX, y },
      width: finalWidth,
      height: finalHeight,
      themeColors: true
    });
  }
  async function openGlobalTemplateUI() {
    figma.showUI(__uiFiles__.templates, {
      width: 600,
      height: 600,
      themeColors: true
    });
    const templates = await getGlobalTemplatesFromClientStorage() || {};
    sendTemplatesInitializeMessage(templates);
  }
  async function sendTemplatesInitializeMessage(templates) {
    const hasLibraryTemplates = Boolean(
      await getEncodedGlobalTemplatesFromTeamLibrary()
    );
    const message = {
      type: "TEMPLATES_INITIALIZE",
      templates,
      hasLibraryTemplates,
      editorType: figma.editorType
    };
    figma.ui.postMessage(message);
  }
  function codegenResultsFromNodeSnippetTemplateDataArray(nodeSnippetTemplateDataArray, isDetailsMode) {
    const codegenResult = [];
    nodeSnippetTemplateDataArray.forEach((nodeSnippetTemplateData) => {
      const { codegenResultArray, codegenResultRawTemplatesArray } = nodeSnippetTemplateData;
      if (isDetailsMode) {
        codegenResultArray.forEach((result, i) => {
          codegenResult.push(codegenResultRawTemplatesArray[i]);
          codegenResult.push(result);
        });
      } else {
        codegenResult.push(...codegenResultArray);
      }
    });
    return codegenResult;
  }
  function handleCurrentSelection() {
    const node = figma.currentPage.selection[0];
    try {
      const nodePluginData = node ? getCodegenResultsFromPluginData(node) : null;
      const nodeId = node ? node.id : null;
      const nodeType = node ? node.type : null;
      const message = {
        type: "EDITOR_SELECTION",
        nodeId,
        nodeType,
        nodePluginData
      };
      figma.ui.postMessage(message);
      return node;
    } catch (e) {
      return node;
    }
  }
})();
