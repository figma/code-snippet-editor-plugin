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
  var regexSymbols = /(?<!\\)\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g;
  console.log(
    `{{as1df}}
{{as2df}}`.split("\n").map((line) => line.match(regexSymbols))
  );
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
  async function nodeSnippetTemplateDataArrayFromNode(node, codeSnippetParamsMap, globalTemplates) {
    const nodeSnippetTemplateDataArray = [];
    const seenSnippetTemplates = {};
    async function processSnippetTemplatesForNode(node2) {
      const codegenResults = getCodegenResultsFromPluginData(node2);
      const codegenResultTemplates = [];
      if (codegenResults.length) {
        const seenKey = JSON.stringify(codegenResults);
        if (!seenSnippetTemplates[seenKey]) {
          seenSnippetTemplates[seenKey] = 1;
          codegenResultTemplates.push(...codegenResults);
        }
      }
      if (globalTemplates) {
        const componentTemplates = "key" in node2 ? globalTemplates.components[node2.key] || [] : [];
        const typeTemplates = globalTemplates.types[node2.type] || [];
        codegenResultTemplates.push(...componentTemplates);
        codegenResultTemplates.push(...typeTemplates);
      }
      const nodeSnippetTemplateData = await hydrateSnippets(
        codegenResultTemplates,
        codeSnippetParamsMap,
        node2.type
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

  // src/bulk.ts
  var bulk = {
    performImport,
    performExport,
    performGetComponentData,
    performGetNodeData
  };
  function performImport(data) {
    const componentsByKey = getComponentsInFileByKey();
    let componentCount = 0;
    for (let componentKey in data) {
      const component = componentsByKey[componentKey];
      if (component) {
        componentCount++;
        setCodegenResultsInPluginData(component, data[componentKey]);
      }
    }
    const s = componentCount === 1 ? "" : "s";
    figma.notify(`Updated ${componentCount} Component${s}`);
  }
  function performExport() {
    const data = {};
    const components = findComponentNodesInFile();
    components.forEach((component) => {
      const codegenResults = getCodegenResultsFromPluginData(component);
      if (codegenResults) {
        data[component.key] = codegenResults;
      }
    });
    const message = {
      type: "EXPORT",
      code: JSON.stringify(data, null, 2)
    };
    figma.ui.postMessage(message);
  }
  function performGetComponentData() {
    const components = findComponentNodesInFile();
    const componentData = {};
    const data = components.reduce((into, component) => {
      if (component.parent && component.parent.type !== "COMPONENT_SET") {
        const lineage = [];
        let node = component.parent;
        if (node) {
          while (node && node.type !== "PAGE") {
            lineage.push(node.name);
            node = node.parent;
          }
        }
        lineage.reverse();
        into[component.key] = {
          name: component.name,
          description: component.description,
          lineage: lineage.join("/")
        };
      }
      return into;
    }, componentData);
    const message = {
      type: "COMPONENT_DATA",
      code: JSON.stringify(data, null, 2)
    };
    figma.ui.postMessage(message);
  }
  async function performGetNodeData() {
    const nodes = figma.currentPage.selection;
    const data = {};
    await Promise.all(
      nodes.map(async (node) => {
        data[keyFromNode(node)] = await paramsFromNode(node);
        return;
      })
    );
    const message = {
      type: "NODE_DATA",
      code: JSON.stringify(data, null, 2)
    };
    figma.ui.postMessage(message);
  }
  function keyFromNode(node) {
    return `${node.name} ${node.type} ${node.id}`;
  }
  function findComponentNodesInFile() {
    if (figma.currentPage.parent) {
      return figma.currentPage.parent.findAllWithCriteria({
        types: ["COMPONENT", "COMPONENT_SET"]
      }) || [];
    }
    return [];
  }
  function getComponentsInFileByKey() {
    const components = findComponentNodesInFile();
    const data = {};
    components.forEach((component) => data[component.key] = component);
    return data;
  }

  // src/code.ts
  if (figma.mode === "codegen") {
    initializeCodegenMode();
  } else {
    initializeDesignMode();
  }
  function initializeCodegenMode() {
    figma.codegen.on("preferenceschange", async (event) => {
      if (event.propertyName === "editor") {
        openCodeSnippetEditorUI();
      }
    });
    figma.ui.on("message", async (event) => {
      if (event.type === "INITIALIZE") {
        handleCurrentSelection();
      } else if (event.type === "SAVE") {
        setCodegenResultsInPluginData(figma.currentPage.selection[0], event.data);
      } else {
        console.log("UNKNOWN EVENT", event);
      }
    });
    figma.on("selectionchange", () => handleCurrentSelection);
    figma.codegen.on("generate", async () => {
      try {
        const { detailsMode, defaultSnippet } = figma.codegen.preferences.customSettings;
        const isDetailsMode = detailsMode === "on";
        const hasDefaultMessage = defaultSnippet === "message";
        const currentNode = handleCurrentSelection();
        const paramsMap = await paramsFromNode(currentNode);
        const nodeSnippetTemplateDataArray = await nodeSnippetTemplateDataArrayFromNode(currentNode, paramsMap);
        const snippets = codegenResultsFromNodeSnippetTemplateDataArray(
          nodeSnippetTemplateDataArray,
          isDetailsMode
        );
        if (isDetailsMode) {
          snippets.push({
            title: "Node Params",
            code: JSON.stringify(paramsMap.params, null, 2),
            language: "JSON"
          });
          snippets.push({
            title: "Node Params (Raw)",
            code: JSON.stringify(paramsMap.paramsRaw, null, 2),
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
  function initializeDesignMode() {
    figma.ui.on("message", async (event) => {
      if (event.type === "INITIALIZE") {
        handleCurrentSelection();
      } else if (event.type === "COMPONENT_DATA") {
        bulk.performGetComponentData();
      } else if (event.type === "NODE_DATA") {
        await bulk.performGetNodeData();
      } else if (event.type === "EXPORT") {
        bulk.performExport();
      } else if (event.type === "IMPORT") {
        bulk.performImport(event.data);
      }
    });
    figma.showUI(__uiFiles__.bulk, {
      width: 600,
      height: 600,
      themeColors: true
    });
  }
  function openCodeSnippetEditorUI() {
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
        type: "SELECTION",
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
