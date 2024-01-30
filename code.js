"use strict";
(() => {
  // src/config.ts
  var PLUGIN_DATA_NAMESPACE = "codesnippets";
  var PLUGIN_DATA_KEY = "snippets";

  // src/utils.ts
  function formatString(string, rawString, filter) {
    if (!filter)
      filter = "hyphen";
    const splitString2 = string.split("-");
    const capitalize2 = (s) => s.charAt(0).toUpperCase() + s.substring(1);
    switch (filter) {
      case "camel":
        return splitString2.map((word, i) => i === 0 ? word : capitalize2(word)).join("");
      case "constant":
        return splitString2.join("_").toUpperCase();
      case "hyphen":
        return splitString2.join("-").toLowerCase();
      case "pascal":
        return splitString2.map(capitalize2).join("");
      case "raw":
        return rawString;
      case "snake":
        return splitString2.join("_").toLowerCase();
    }
    return splitString2.join(" ");
  }

  // src/hydrateSnippets.ts
  var regexQualifierSingle = "([^}&|]+)";
  var regexQualifierOr = "([^}&]+)";
  var regexQualifierAnd = "([^}|]+)";
  var regexQualifiers = [
    regexQualifierSingle,
    regexQualifierOr,
    regexQualifierAnd
  ].join("|");
  var regexQualifier = new RegExp(`{{([?!])(${regexQualifiers})}}`, "g");
  async function hydrateSnippets(pluginData, { raw, params }) {
    const pluginDataArray = JSON.parse(pluginData);
    const codeArray = [];
    pluginDataArray.forEach((pluginData2) => {
      const lines = pluginData2.code.split("\n");
      const code = [];
      lines.forEach((line) => {
        const [matches, qualifies] = lineQualifierMatch(line, params);
        matches.forEach((match) => {
          line = line.replace(match[0], "");
        });
        const symbolMatches = [
          ...line.matchAll(/\{\{([^\{\?\}\|]+)(\|([^\{\?\}]+))?\}\}/g)
        ];
        if (qualifies && symbolMatches.length) {
          let succeeded = true;
          symbolMatches.forEach((symbolMatch) => {
            const [match, param, _, filter] = symbolMatch.map(
              (a) => a ? a.trim() : a
            );
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
      const codeString = code.join("\n").replace(/\\\\\n/g, "").replace(/\\\n\\/g, "").replace(/\\\n/g, " ");
      codeArray.push(codeString);
    });
    return { params, pluginDataArray, codeArray };
  }
  function lineQualifierMatch(line, params) {
    const matches = [...line.matchAll(regexQualifier)];
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
    const valueObject = valueObjectFromNode(node);
    const object = {};
    const isDefinitions = isComponentPropertyDefinitionsObject(valueObject);
    const instanceProperties = {};
    for (let propertyName in valueObject) {
      const value = isDefinitions ? valueObject[propertyName].defaultValue : valueObject[propertyName].value;
      const type = valueObject[propertyName].type;
      const cleanName = sanitizePropertyName(propertyName);
      if (value !== void 0) {
        object[cleanName] = object[cleanName] || {};
        if (typeof value === "string") {
          if (type === "VARIANT")
            object[cleanName].VARIANT = value;
          if (type === "TEXT")
            object[cleanName].TEXT = value;
          if (type === "INSTANCE_SWAP") {
            const foundNode = await figma.getNodeById(value);
            const nodeName = nameFromFoundInstanceSwapNode(foundNode);
            object[cleanName].INSTANCE_SWAP = nodeName;
            if (foundNode) {
              instanceProperties[cleanName] = await paramsFromNode(
                foundNode,
                true
              );
            }
          }
        } else {
          object[cleanName].BOOLEAN = value;
        }
      }
    }
    const params = {};
    const raw = {};
    const initial = await initialParamsFromNode(node);
    for (let key in object) {
      const item = object[key];
      const itemKeys = Object.keys(item);
      if (itemKeys.length > 1) {
        itemKeys.forEach((type) => {
          const value = item[type].toString();
          params[`property.${key}.${type.charAt(0).toLowerCase()}`] = splitString(value);
          raw[`property.${key}.${type.charAt(0).toLowerCase()}`] = value;
        });
      } else {
        const value = item[itemKeys[0]].toString();
        params[`property.${key}`] = splitString(value);
        raw[`property.${key}`] = value;
      }
      if (itemKeys.includes("INSTANCE_SWAP") && instanceProperties[key]) {
        const keyPrefix = itemKeys.length > 1 ? `property.${key}.i` : `property.${key}`;
        for (let k in instanceProperties[key].params) {
          params[`${keyPrefix}.${k}`] = splitString(
            instanceProperties[key].params[k]
          );
          raw[`${keyPrefix}.${k}`] = instanceProperties[key].raw[k];
        }
      }
    }
    return propertiesOnly ? {
      params,
      raw
    } : {
      params: Object.assign(params, initial.params),
      raw: Object.assign(raw, initial.raw)
    };
  }
  function nameFromFoundInstanceSwapNode(node) {
    return node && node.parent && node.parent.type === "COMPONENT_SET" ? node.parent.name : node?.name || "";
  }
  async function initialParamsFromNode(node) {
    const componentNode = getComponentNodeFromNode(node);
    const css = await node.getCSSAsync();
    const autolayout = "inferredAutoLayout" in node ? node.inferredAutoLayout : void 0;
    const raw = {
      "node.name": node.name,
      "node.type": node.type
    };
    const params = {
      "node.name": splitString(node.name),
      "node.type": splitString(node.type)
    };
    if ("key" in node) {
      raw["node.key"] = node.key;
      params["node.key"] = node.key;
    }
    if (componentNode && "key" in componentNode) {
      raw["component.key"] = componentNode.key;
      raw["component.type"] = componentNode.type;
      raw["component.name"] = componentNode.name;
      params["component.key"] = componentNode.key;
      params["component.type"] = splitString(componentNode.type);
      params["component.name"] = splitString(componentNode.name);
    }
    for (let key in css) {
      const k = formatString(key, key, "camel");
      params[`css.${k}`] = css[key];
      raw[`css.${k}`] = css[key];
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
              raw[`variables.${key}`] = va.name;
              params[`variables.${key}`] = splitString(va.name);
              for (let syntax in va.codeSyntax) {
                const syntaxKey = syntax.charAt(0).toLowerCase();
                const syntaxName = syntax;
                const value = va.codeSyntax[syntaxName];
                if (value) {
                  raw[`variables.${key}.${syntaxKey}`] = value;
                  params[`variables.${key}.${syntaxKey}`] = splitString(value);
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
          raw[`autolayout.${p}`] = val;
          params[`autolayout.${p}`] = splitString(val);
        }
      });
    }
    return { params, raw };
  }
  function isComponentPropertyDefinitionsObject(object) {
    return object[Object.keys(object)[0]] && "defaultValue" in object[Object.keys(object)[0]];
  }
  function valueObjectFromNode(node) {
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
    } else if (type === "COMPONENT" && isVariant) {
      return parent;
    } else if (type === "INSTANCE") {
      const { mainComponent } = node;
      return mainComponent ? mainComponent.parent?.type === "COMPONENT_SET" ? mainComponent.parent : mainComponent : null;
    }
  }
  function splitString(string = "") {
    string = string.replace(/([^a-zA-Z0-9-_// ])/g, "");
    if (!string.match(/^[A-Z0-9_]+$/)) {
      string = string.replace(/([A-Z])/g, " $1");
    }
    return string.replace(/([a-z])([0-9])/g, "$1 $2").replace(/([-_/])/g, " ").replace(/  +/g, " ").trim().toLowerCase().split(" ").join("-");
  }

  // src/code.ts
  if (figma.mode === "codegen") {
    console.clear();
    figma.codegen.on("preferenceschange", async (event) => {
      if (event.propertyName === "editor") {
        openCodeSnippetEditorUI();
      }
    });
    figma.ui.on("message", async (event) => {
      if (event.type === "INITIALIZE") {
        handleCurrentSelection();
      } else if (event.type === "SAVE") {
        figma.currentPage.selection[0].setSharedPluginData(
          PLUGIN_DATA_NAMESPACE,
          PLUGIN_DATA_KEY,
          event.data
        );
      } else {
        console.log("UNKNOWN EVENT", event);
      }
    });
    figma.on("selectionchange", () => handleCurrentSelection);
    figma.codegen.on("generate", async () => {
      try {
        const currentNode = handleCurrentSelection();
        const paramsMap = await paramsFromNode(currentNode);
        const { detailsMode, defaultSnippet } = figma.codegen.preferences.customSettings;
        const isDetailsMode = detailsMode === "on";
        const hasDefaultMessage = defaultSnippet === "message";
        const snippetData = await findAndGenerateSelectionSnippetData(
          currentNode,
          paramsMap
        );
        const snippets = snippetsFromSnippetData(snippetData, isDetailsMode);
        if (isDetailsMode) {
          snippets.push({
            title: "Node Params",
            code: JSON.stringify(paramsMap.params, null, 2),
            language: "JSON"
          });
          snippets.push({
            title: "Node Params (Raw)",
            code: JSON.stringify(paramsMap.raw, null, 2),
            language: "JSON"
          });
        }
        if (!snippets.length) {
          if (hasDefaultMessage) {
            snippets.push({
              title: "Snippets",
              code: "No snippets on this node. Add snippets via the Snippet Editor.",
              language: "PLAINTEXT"
            });
          }
        }
        return snippets;
      } catch (e) {
        return [
          { language: "JSON", code: JSON.stringify(e, null, 2), title: "Error" }
        ];
      }
    });
  } else {
    figma.ui.on("message", async (event) => {
      if (event.type === "INITIALIZE") {
        handleCurrentSelection();
      } else if (event.type === "COMPONENT_DATA") {
        const jsonString = getComponentDataJSON();
        figma.ui.postMessage({
          type: "COMPONENT_DATA",
          code: jsonString
        });
      } else if (event.type === "NODE_DATA") {
        const jsonString = await getNodeDataJSON();
        figma.ui.postMessage({
          type: "NODE_DATA",
          code: jsonString
        });
      } else if (event.type === "EXPORT") {
        const jsonString = getExportJSON();
        figma.ui.postMessage({
          type: "EXPORT",
          code: jsonString
        });
      } else if (event.type === "IMPORT") {
        const componentsByKey = getComponentsInFileByKey();
        const data = JSON.parse(event.data);
        let componentCount = 0;
        for (let componentKey in data) {
          const dataToSave = JSON.stringify(data[componentKey]);
          const component = componentsByKey[componentKey];
          if (component) {
            componentCount++;
            component.setSharedPluginData(
              PLUGIN_DATA_NAMESPACE,
              PLUGIN_DATA_KEY,
              dataToSave
            );
          }
        }
        const s = componentCount === 1 ? "" : "s";
        figma.notify(`Updated ${componentCount} Component${s}`);
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
  function snippetsFromSnippetData(snippetData, isDetailsMode) {
    const snippets = [];
    snippetData.forEach((pluginDataAndParams) => {
      const { codeArray, pluginDataArray, nodeType } = pluginDataAndParams;
      pluginDataArray.forEach(({ title, code: templateCode, language }, i) => {
        const code = codeArray[i];
        if (isDetailsMode) {
          snippets.push({
            title: `${title}: Template (${nodeType})`,
            code: templateCode,
            language: "PLAINTEXT"
          });
        }
        snippets.push({ title, language, code });
      });
    });
    return snippets;
  }
  async function findAndGenerateSelectionSnippetData(currentNode, paramsMap) {
    const data = [];
    const seenTemplates = {};
    async function pluginDataForNode(node) {
      const pluginData = node.getSharedPluginData(
        PLUGIN_DATA_NAMESPACE,
        PLUGIN_DATA_KEY
      );
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
        if (currentNode.mainComponent.parent?.type === "COMPONENT_SET") {
          await pluginDataForNode(currentNode.mainComponent.parent);
        }
      }
    } else if (currentNode.type === "COMPONENT" && currentNode.parent?.type === "COMPONENT_SET") {
      await pluginDataForNode(currentNode.parent);
    }
    return data;
  }
  function handleCurrentSelection() {
    const node = figma.currentPage.selection[0];
    try {
      const nodePluginData = node ? node.getSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY) : null;
      const nodeId = node ? node.id : null;
      const nodeType = node ? node.type : null;
      figma.ui.postMessage({
        type: "SELECTION",
        nodeId,
        nodeType,
        nodePluginData
      });
      return node;
    } catch (e) {
      return node;
    }
  }
  function getExportJSON() {
    const data = {};
    const components = figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"]
    }) || [];
    components.forEach((component) => {
      const pluginData = component.getSharedPluginData(
        PLUGIN_DATA_NAMESPACE,
        PLUGIN_DATA_KEY
      );
      if (pluginData) {
        data[component.key] = JSON.parse(pluginData);
      }
    });
    return JSON.stringify(data, null, 2);
  }
  function getComponentDataJSON() {
    const components = figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"]
    }) || [];
    const componentData = {};
    const data = components.reduce((into, component) => {
      if (component.parent?.type !== "COMPONENT_SET") {
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
    return JSON.stringify(data, null, 2);
  }
  async function getNodeDataJSON() {
    const nodes = figma.currentPage.selection;
    const data = {};
    await Promise.all(
      nodes.map(async (node) => {
        data[keyFromNode(node)] = await paramsFromNode(node);
        return;
      })
    );
    return JSON.stringify(data, null, 2);
  }
  function keyFromNode(node) {
    return `${node.name} ${node.type} ${node.id}`;
  }
  function getComponentsInFileByKey() {
    const components = figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"]
    }) || [];
    const data = {};
    components.forEach((component) => data[component.key] = component);
    return data;
  }
})();
