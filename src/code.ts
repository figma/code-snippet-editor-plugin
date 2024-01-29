import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "./config";

type CodeSnippetParams = { [k: string]: string };

interface PluginDataAndParams {
  codeArray: string[];
  pluginDataArray: CodegenResult[];
  nodeType: string;
}

const regexQualifierSingle = "([^}&|]+)";
const regexQualifierOr = "([^}&]+)";
const regexQualifierAnd = "([^}|]+)";
const regexQualifiers = [
  regexQualifierSingle,
  regexQualifierOr,
  regexQualifierAnd,
].join("|");
const regexQualifier = new RegExp(`\{\{([\?\!])(${regexQualifiers})\}\}`, "g");

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
    } catch (e) {
      return [
        { language: "JSON", code: JSON.stringify(e, null, 2), title: "Error" },
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
    themeColors: true,
  });
}

function snippetsFromSnippetData(
  snippetData: PluginDataAndParams[],
  isDetailsMode: boolean
) {
  const snippets: CodegenResult[] = [];
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

async function findAndGenerateSelectionSnippetData(
  currentNode: SceneNode,
  params: CodeSnippetParams,
  raw: CodeSnippetParams
) {
  const data: PluginDataAndParams[] = [];
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
        params,
        raw
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
  } else if (
    currentNode.type === "COMPONENT" &&
    currentNode.parent?.type === "COMPONENT_SET"
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

async function hydrateSnippets(
  pluginData: string,
  params: CodeSnippetParams,
  raw: CodeSnippetParams
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
          );
          if (param in params) {
            const value = filterString(params[param], raw[param], filter);
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

function filterString(string: string, rawString: string, filter: string) {
  if (!filter) filter = "hyphen";
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

function isComponentPropertyDefinitionsObject(
  object: ComponentProperties | ComponentPropertyDefinitions
): object is ComponentPropertyDefinitions {
  return (
    object[Object.keys(object)[0]] &&
    "defaultValue" in object[Object.keys(object)[0]]
  );
}

async function paramsFromNode(node: BaseNode, propertiesOnly = false) {
  const valueObject = valueObjectFromNode(node);
  const object: {
    [k: string]: {
      VARIANT?: string;
      TEXT?: string;
      INSTANCE_SWAP?: string;
      BOOLEAN?: any;
    };
  } = {};
  const isDefinitions = isComponentPropertyDefinitionsObject(valueObject);
  const instanceProperties: {
    [k: string]: { params: CodeSnippetParams; raw: CodeSnippetParams };
  } = {};
  for (let propertyName in valueObject) {
    const value = isDefinitions
      ? valueObject[propertyName].defaultValue
      : valueObject[propertyName].value;
    const type = valueObject[propertyName].type;
    const cleanName = sanitizePropertyName(propertyName);
    if (value !== undefined) {
      object[cleanName] = object[cleanName] || {};
      if (typeof value === "string") {
        if (type === "VARIANT") object[cleanName].VARIANT = value;
        if (type === "TEXT") object[cleanName].TEXT = value;
        if (type === "INSTANCE_SWAP") {
          const foundNode = await figma.getNodeById(value);
          const nodeName =
            foundNode &&
            foundNode.parent &&
            foundNode.parent.type === "COMPONENT_SET"
              ? foundNode.parent.name
              : foundNode?.name;
          object[cleanName].INSTANCE_SWAP = nodeName || "";
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
  const params: CodeSnippetParams = {};
  const raw: CodeSnippetParams = {};
  const initial = await initialParamsFromNode(node);
  for (let key in object) {
    const item = object[key];
    const itemKeys = Object.keys(item) as (
      | "VARIANT"
      | "TEXT"
      | "INSTANCE_SWAP"
      | "BOOLEAN"
    )[];
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
    if (itemKeys.includes("INSTANCE_SWAP") && instanceProperties[key]) {
      const keyPrefix =
        itemKeys.length > 1 ? `property.${key}.i` : `property.${key}`;
      for (let k in instanceProperties[key].params) {
        params[`${keyPrefix}.${k}`] = splitString(
          instanceProperties[key].params[k]
        );
        raw[`${keyPrefix}.${k}`] = instanceProperties[key].raw[k];
      }
    }
  }

  return propertiesOnly
    ? {
        params,
        raw,
      }
    : {
        params: Object.assign(params, initial.params),
        raw: Object.assign(raw, initial.raw),
      };
}

async function initialParamsFromNode(node: BaseNode) {
  const componentNode = getComponentNodeFromNode(node);
  const css = await node.getCSSAsync();
  const autolayout =
    "inferredAutoLayout" in node ? node.inferredAutoLayout : undefined;
  // const boundVariables: {[k:string]: VariableAlias|undefined; }|undefined =
  //   "boundVariables" in node ? node.boundVariables : undefined;
  const raw: CodeSnippetParams = {
    "node.name": node.name,
    "node.type": node.type,
  };
  const params: CodeSnippetParams = {
    "node.name": splitString(node.name),
    "node.type": splitString(node.type),
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
    const k = filterString(key, key, "camel");
    params[`css.${k}`] = css[key];
    raw[`css.${k}`] = css[key];
  }
  if ("boundVariables" in node && node.boundVariables) {
    const boundVariables: SceneNodeMixin["boundVariables"] =
      node.boundVariables;
    for (let key in boundVariables) {
      let vars: VariableAlias | VariableAlias[] | undefined =
        boundVariables[key as keyof SceneNodeMixin["boundVariables"]];
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
              const syntaxName = syntax as "WEB" | "ANDROID" | "iOS";
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
    const props: (keyof InferredAutoLayoutResult)[] = [
      "layoutMode",
      "layoutWrap",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
      "itemSpacing",
      "counterAxisSpacing",
      "primaryAxisAlignItems",
      "counterAxisAlignItems",
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

function getComponentNodeFromNode(node: BaseNode) {
  const { type, parent } = node;
  const parentType = parent ? parent.type : "";
  const isVariant = parentType === "COMPONENT_SET";
  if (type === "COMPONENT_SET" || (type === "COMPONENT" && !isVariant)) {
    return node;
  } else if (type === "COMPONENT" && isVariant) {
    return parent;
  } else if (type === "INSTANCE") {
    const { mainComponent } = node;
    return mainComponent
      ? mainComponent.parent?.type === "COMPONENT_SET"
        ? mainComponent.parent
        : mainComponent
      : null;
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

function valueObjectFromNode(
  node: BaseNode
): ComponentProperties | ComponentPropertyDefinitions {
  if (node.type === "INSTANCE") return node.componentProperties;
  if (node.type === "COMPONENT_SET") return node.componentPropertyDefinitions;
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

function capitalize(name: string) {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function downcase(name: string) {
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

function sanitizePropertyName(name: string) {
  name = name.replace(/#[^#]+$/g, "");
  return downcase(capitalizedNameFromName(name).replace(/^\d+/g, ""));
}

function getExportJSON() {
  const data: { [k: string]: CodegenResult[] } = {};
  const components =
    figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    }) || [];
  components.forEach((component) => {
    const pluginData = component.getSharedPluginData(
      PLUGIN_DATA_NAMESPACE,
      PLUGIN_DATA_KEY
    );
    if (pluginData) {
      data[component.key] = JSON.parse(pluginData) as CodegenResult[];
    }
  });
  return JSON.stringify(data, null, 2);
}

function getComponentDataJSON() {
  const components =
    figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    }) || [];
  const componentData: {
    [k: string]: { name: string; description: string; lineage: string };
  } = {};
  const data = components.reduce((into, component) => {
    if (component.parent?.type !== "COMPONENT_SET") {
      const lineage = [];
      let node: BaseNode | null = component.parent;
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
        lineage: lineage.join("/"),
      };
    }
    return into;
  }, componentData);
  return JSON.stringify(data, null, 2);
}

async function getNodeDataJSON() {
  const nodes = figma.currentPage.selection;
  const data: {
    [k: string]: { raw: CodeSnippetParams; params: CodeSnippetParams };
  } = {};
  await Promise.all(
    nodes.map(async (node) => {
      data[keyFromNode(node)] = await paramsFromNode(node);
      return;
    })
  );
  return JSON.stringify(data, null, 2);
}

function keyFromNode(node: SceneNode) {
  return `${node.name} ${node.type} ${node.id}`;
}

function getComponentsInFileByKey() {
  const components =
    figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    }) || [];
  const data: { [k: string]: ComponentNode | ComponentSetNode } = {};
  components.forEach((component) => (data[component.key] = component));
  return data;
}
