import { formatStringWithFilter } from "./snippets";

export async function paramsFromNode(node: BaseNode, propertiesOnly = false) {
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
  const instanceProperties: { [k: string]: CodeSnippetParamsMap } = {};
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

function nameFromFoundInstanceSwapNode(node: BaseNode | null) {
  return node && node.parent && node.parent.type === "COMPONENT_SET"
    ? node.parent.name
    : node
    ? node.name
    : "";
}

async function initialParamsFromNode(node: BaseNode) {
  const componentNode = getComponentNodeFromNode(node);
  const css = await node.getCSSAsync();
  const autolayout =
    "inferredAutoLayout" in node ? node.inferredAutoLayout : undefined;
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
    const k = formatStringWithFilter(key, key, "camel");
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

function isComponentPropertyDefinitionsObject(
  object: ComponentProperties | ComponentPropertyDefinitions
): object is ComponentPropertyDefinitions {
  return (
    object[Object.keys(object)[0]] &&
    "defaultValue" in object[Object.keys(object)[0]]
  );
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
      ? mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET"
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
