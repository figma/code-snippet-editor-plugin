const PLUGIN_DATA_NAMESPACE = "codesnippets";
const PLUGIN_DATA_KEY = "snippets";

if (figma.mode === "codegen") {
  console.clear();

  figma.codegen.on("preferenceschange", async (event) => {
    if (event.propertyName === "editor") {
      figma.showUI(__uiFiles__.editor, {
        width: 600,
        height: 600,
        themeColors: true,
      });
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

  figma.codegen.on("generate", async (event) => {
    const currentNode = handleCurrentSelection();
    const { params, raw } = await paramsFromNode(currentNode);
    const { detailsMode, defaultSnippet } =
      figma.codegen.preferences.customSettings;
    const isDetailsMode = detailsMode === "on";
    const hasDefaultMessage = defaultSnippet === "message";

    const snippetData = await findAndGenerateSelectionSnippetData(
      currentNode,
      params,
      raw
    );

    const snippets = snippetsFromSnippetData(snippetData, isDetailsMode);

    if (isDetailsMode) {
      snippets.push({
        title: "Node Params",
        code: JSON.stringify(params, null, 2),
        language: "JSON",
      });
      snippets.push({
        title: "Node Params (Raw)",
        code: JSON.stringify(raw, null, 2),
        language: "JSON",
      });
    }

    if (!snippets.length) {
      if (hasDefaultMessage) {
        snippets.push({
          title: "Snippets",
          code: "No snippets on this node. Add snippets via the Snippet Editor.",
          language: "PLAINTEXT",
        });
      }
    }

    return snippets;
  });
} else {
  figma.ui.on("message", async (event) => {
    if (event.type === "INITIALIZE") {
      handleCurrentSelection();
    } else if (event.type === "COMPONENT_DATA") {
      const jsonString = getComponentDataJSON();
      figma.ui.postMessage({
        type: "COMPONENT_DATA",
        code: jsonString,
      });
    } else if (event.type === "NODE_DATA") {
      const jsonString = await getNodeDataJSON();
      figma.ui.postMessage({
        type: "NODE_DATA",
        code: jsonString,
      });
    } else if (event.type === "EXPORT") {
      const jsonString = getExportJSON();
      figma.ui.postMessage({
        type: "EXPORT",
        code: jsonString,
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
    themeColors: true,
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
          language: "PLAINTEXT",
        });
      }
      snippets.push({ title, language, code });
    });
  });
  return snippets;
}

async function findAndGenerateSelectionSnippetData(currentNode, params, raw) {
  const data = [];
  const seenTemplates = {};

  async function pluginDataForNode(node) {
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
        currentNode,
        params,
        raw
      );
      data.push({ codeArray, pluginDataArray, nodeType: node.type });
    }
  }

  await pluginDataForNode(currentNode);
  if (currentNode.type === "INSTANCE") {
    await pluginDataForNode(currentNode.mainComponent);
    if (currentNode.mainComponent.parent.type === "COMPONENT_SET") {
      await pluginDataForNode(currentNode.mainComponent.parent);
    }
  } else if (
    currentNode.type === "COMPONENT" &&
    currentNode.parent.type === "COMPONENT_SET"
  ) {
    await pluginDataForNode(currentNode.parent);
  }
  return data;
}

function handleCurrentSelection() {
  const node = figma.currentPage.selection[0];
  try {
    const nodePluginData = node
      ? node.getSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY)
      : null;
    const nodeId = node ? node.id : null;
    const nodeType = node ? node.type : null;
    figma.ui.postMessage({
      type: "SELECTION",
      nodeId,
      nodeType,
      nodePluginData,
    });
    return node;
  } catch (e) {
    // no ui open. ignore this.
    return node;
  }
}

async function hydrateSnippets(pluginData, currentNode, params, raw) {
  const pluginDataArray = JSON.parse(pluginData);
  const codeArray = [];

  pluginDataArray.forEach((pluginData) => {
    const lines = pluginData.code.split("\n");
    const code = [];
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
          );
          if (param in params) {
            const value = filterString(params[param], raw[param], filter);
            line = line.replace(match, value);
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

function filterString(string, rawString, filter) {
  if (!filter) filter = "hyphen";
  string = string.split("-");
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.substring(1);
  switch (filter) {
    case "camel":
      return string
        .map((word, i) => (i === 0 ? word : capitalize(word)))
        .join("");
    case "constant":
      return string.join("_").toUpperCase();
    case "hyphen":
      return string.join("-").toLowerCase();
    case "pascal":
      return string.map(capitalize).join("");
    case "raw":
      return rawString;
    case "snake":
      return string.join("_").toLowerCase();
  }
  return string.join(" ");
}

function lineQualifierMatch(line, params) {
  // Line qualifier statement. {{?something=value}} | {{!something=value}} | {{?something}}
  const matches = [...line.matchAll(/\{\{([\?\!])([^=]+)(=([^\}]+))?\}\}/g)];

  // No qualifier statement on the line. This is valid.
  if (!matches.length) {
    return [[], true];
  }

  let valid = true;
  matches.forEach((match) => {
    const [_, polarity, symbol, equals, value] = match.map((a) =>
      a ? a.trim() : a
    );

    const symbolIsDefined = symbol in params;
    const paramsMatch = params[symbol] === value;
    const isNegative = polarity === "!";
    const isPositive = polarity === "?";
    const presenceOnly = !Boolean(equals);
    const presenceOnlyValid =
      presenceOnly &&
      ((isNegative && !symbolIsDefined) || (isPositive && symbolIsDefined));
    const paramsMatchValid =
      !presenceOnly &&
      symbolIsDefined &&
      ((isNegative && !paramsMatch) || (isPositive && paramsMatch));
    if (!presenceOnlyValid && !paramsMatchValid) {
      valid = false;
    }
  });

  return [matches, valid];
}

async function paramsFromNode(node) {
  const valueObject = valueObjectFromNode(node);
  const object = {};
  const isDefinitions =
    valueObject[Object.keys(valueObject)[0]] &&
    "defaultValue" in valueObject[Object.keys(valueObject)[0]];
  for (let propertyName in valueObject) {
    const value = isDefinitions
      ? valueObject[propertyName].defaultValue
      : valueObject[propertyName].value;
    const type = valueObject[propertyName].type;
    const cleanName = sanitizePropertyName(propertyName, type);
    if (value !== undefined) {
      object[cleanName] = object[cleanName] || {};
      if (typeof value === "string") {
        if (type === "VARIANT") object[cleanName].VARIANT = value;
        if (type === "TEXT") object[cleanName].TEXT = value;
        if (type === "INSTANCE_SWAP") {
          const foundNode = await figma.getNodeById(value);
          object[cleanName].INSTANCE_SWAP = foundNode
            ? foundNode.name || ""
            : "";
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
        params[`property.${key}.${type.charAt(0).toLowerCase()}`] =
          splitString(value);
        raw[`property.${key}.${type.charAt(0).toLowerCase()}`] = value;
      });
    } else {
      const value = item[itemKeys[0]].toString();
      params[`property.${key}`] = splitString(value);
      raw[`property.${key}`] = value;
    }
  }

  return {
    params: Object.assign(params, initial.params),
    raw: Object.assign(raw, initial.raw),
  };
}

async function initialParamsFromNode(node) {
  const componentNode = getComponentNodeFromNode(node) || {};
  const css = await node.getCSSAsync();
  const autolayout = node.inferredAutoLayout;
  const boundVariables = node.boundVariables;
  const raw = {
    "node.name": node.name,
    "node.type": node.type,
    "node.key": node.key,
  };
  const params = {
    "node.name": splitString(node.name),
    "node.type": splitString(node.type),
    "node.key": node.key,
  };
  if (componentNode.key) {
    raw["component.key"] = componentNode.key;
    raw["component.type"] = componentNode.type;
    raw["component.name"] = componentNode.name;
    params["component.key"] = componentNode.key;
    params["component.type"] = splitString(componentNode.type);
    params["component.name"] = splitString(componentNode.name);
  }
  for (let key in css) {
    const k = filterString(key, key, "camel");
    params[`css.${k}`] = css[key];
    raw[`css.${k}`] = css[key];
  }
  if (boundVariables) {
    for (let key in boundVariables) {
      let vars = boundVariables[key];
      if (!Array.isArray(vars)) {
        vars = [vars];
      }
      vars.forEach((v) => {
        const va = figma.variables.getVariableById(v.id);
        raw[`variables.${key}`] = va.name;
        params[`variables.${key}`] = splitString(va.name);
        for (let syntax in va.codeSyntax) {
          const syntaxKey = syntax.charAt(0).toLowerCase();
          raw[`variables.${key}.${syntaxKey}`] = va.codeSyntax[syntax];
          params[`variables.${key}.${syntaxKey}`] = splitString(
            va.codeSyntax[syntax]
          );
        }
      });
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
    ];
    props.forEach((p) => {
      const val = autolayout[p] + "";
      raw[`autolayout.${p}`] = val;
      params[`autolayout.${p}`] = splitString(val);
    });
  }
  return { params, raw };
}

function getComponentNodeFromNode(node) {
  const { type, parent } = node;
  const parentType = parent.type;
  const isVariant = parentType === "COMPONENT_SET";
  if (type === "COMPONENT_SET" || (type === "COMPONENT" && !isVariant)) {
    return node;
  } else if (type === "COMPONENT" && isVariant) {
    return parent;
  } else if (type === "INSTANCE") {
    const { mainComponent } = node;
    return mainComponent.parent.type === "COMPONENT_SET"
      ? mainComponent.parent
      : mainComponent;
  }
}

function splitString(string = "") {
  string = string.replace(/([^a-zA-Z0-9-_// ])/g, "");
  if (!string.match(/^[A-Z0-9_]+$/)) {
    string = string.replace(/([A-Z])/g, " $1");
  }
  return string
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([-_/])/g, " ")
    .replace(/  +/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .join("-");
}

function optionNameFromVariant(name = "") {
  const clean = name.replace(/[^a-zA-Z\d-_ ]/g, "");
  if (clean.match("-")) {
    return clean.replace(/ +/g, "-").toLowerCase();
  } else if (clean.match("_")) {
    return clean.replace(/ +/g, "_").toLowerCase();
  } else if (clean.match(" ") || clean.match(/^[A-Z]/)) {
    return clean
      .split(/ +/)
      .map((a, i) => {
        let text =
          i > 0
            ? `${a.charAt(0).toUpperCase()}${a.substring(1).toLowerCase()}`
            : a.toLowerCase();
        return text;
      })
      .join("");
  } else return clean;
}

function valueObjectFromNode(node) {
  if (node.type === "INSTANCE") return node.componentProperties;
  if (node.type === "COMPONENT_SET") return node.componentPropertyDefinitions;
  if (node.type === "COMPONENT") {
    if (node.parent.type === "COMPONENT_SET") {
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
  return name
    .split(/[^a-zA-Z\d]+/g)
    .map(capitalize)
    .join("");
}

function sanitizePropertyName(name) {
  name = name.replace(/#[^#]+$/g, "");
  return downcase(capitalizedNameFromName(name).replace(/^\d+/g, ""));
}

function getExportJSON() {
  const data = {};
  const components = figma.currentPage.parent.findAllWithCriteria({
    types: ["COMPONENT", "COMPONENT_SET"],
  });
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
  const components = figma.currentPage.parent.findAllWithCriteria({
    types: ["COMPONENT", "COMPONENT_SET"],
  });
  const data = components.reduce((into, component) => {
    if (component.parent.type !== "COMPONENT_SET") {
      const lineage = [];
      let node = component.parent;
      while (node.type !== "PAGE") {
        lineage.push(node.name);
        node = node.parent;
      }
      lineage.reverse();
      into[component.key] = {
        name: component.name,
        description: component.description,
        lineage: lineage.join("/"),
      };
    }
    return into;
  }, {});
  return JSON.stringify(data, null, 2);
}

async function getNodeDataJSON() {
  const nodes = figma.currentPage.selection;
  const data = {};
  await Promise.all(
    nodes.map(async (node) => {
      data[`${node.name} ${node.type} ${node.id}`] = await paramsFromNode(node);
      return;
    })
  );
  return JSON.stringify(data, null, 2);
}

function getComponentsInFileByKey() {
  const components = figma.currentPage.parent.findAllWithCriteria({
    types: ["COMPONENT", "COMPONENT_SET"],
  });
  const data = components.reduce((into, component) => {
    into[component.key] = component;
    return into;
  }, {});
  return data;
}
