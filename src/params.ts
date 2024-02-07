import { transformStringWithFilter } from "./snippets";

/**
 * Return the code snippet params for a node.
 * https://github.com/figma/code-snippet-editor-plugin#params
 * @param node the node we want params for
 * @param propertiesOnly a boolean flag to only return component property params
 *  (only true when getting instance swap child properties)
 * @returns Promise that resolves a CodeSnippetParamsMap
 */
export async function paramsFromNode(
  node: BaseNode,
  propertiesOnly = false
): Promise<CodeSnippetParamsMap> {
  const { componentPropValuesMap, instanceParamsMap } =
    await componentPropertyDataFromNode(node);
  const params: CodeSnippetParams = {};
  const paramsRaw: CodeSnippetParams = {};
  for (let key in componentPropValuesMap) {
    const item = componentPropValuesMap[key];
    const itemKeys = Object.keys(item) as ComponentPropertyType[];
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
      const keyPrefix =
        itemKeys.length > 1 ? `property.${key}.i` : `property.${key}`;
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
    paramsRaw: Object.assign(paramsRaw, initial.paramsRaw),
  };
}

/**
 * Given a node, find all the relevant component property data, including from instance swap property instances.
 * @param node the node to get component property data from
 * @returns componentPropValuesMap containing component property values
 *  and instanceParamsMap object containing property params for instances
 */
async function componentPropertyDataFromNode(node: BaseNode) {
  const componentPropObject = componentPropObjectFromNode(node);
  const componentPropValuesMap: ComponentPropValuesMap = {};
  const isDefinitions =
    isComponentPropertyDefinitionsObject(componentPropObject);
  const instanceParamsMap: { [k: string]: CodeSnippetParamsMap } = {};
  for (let propertyName in componentPropObject) {
    const value = isDefinitions
      ? componentPropObject[propertyName].defaultValue
      : componentPropObject[propertyName].value;
    const type = componentPropObject[propertyName].type;
    const cleanName = sanitizePropertyName(propertyName);
    if (value !== undefined) {
      componentPropValuesMap[cleanName] =
        componentPropValuesMap[cleanName] || {};
      if (typeof value === "string") {
        if (type === "VARIANT")
          componentPropValuesMap[cleanName].VARIANT = value;
        if (type === "TEXT") componentPropValuesMap[cleanName].TEXT = value;
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

/**
 * Find the appropriate component name for an instance swap instance node
 * @param node implicitly an instance node to find a name for
 * @returns a name as a string
 */
function nameFromFoundInstanceSwapNode(node: BaseNode | null) {
  return node && node.parent && node.parent.type === "COMPONENT_SET"
    ? node.parent.name
    : node
    ? node.name
    : "";
}

/**
 * Generate initial CodeSnippetParamsMap for a node, including autolayout, node, component, css, and variables.
 * Component property params are combined with this map later.
 * @param node node to generate initial params for
 * @returns Promise resolving an initial CodeSnippetParamsMap for the provided node
 */
async function initialParamsFromNode(
  node: BaseNode
): Promise<CodeSnippetParamsMap> {
  const componentNode = getComponentNodeFromNode(node);
  const css = await node.getCSSAsync();
  const autolayout =
    "inferredAutoLayout" in node ? node.inferredAutoLayout : undefined;
  const paramsRaw: CodeSnippetParams = {
    "node.name": node.name,
    "node.type": node.type,
  };
  const params: CodeSnippetParams = {
    "node.name": safeString(node.name),
    "node.type": safeString(node.type),
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
    // Only supporting single style text nodes. figma.mixed means multiple in text block.
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
            paramsRaw[`variables.${key}`] = va.name;
            params[`variables.${key}`] = safeString(va.name);
            for (let syntax in va.codeSyntax) {
              const syntaxKey = syntax.charAt(0).toLowerCase();
              const syntaxName = syntax as "WEB" | "ANDROID" | "iOS";
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
        paramsRaw[`autolayout.${p}`] = val;
        params[`autolayout.${p}`] = safeString(val);
      }
    });
  }
  return { params, paramsRaw };
}

/**
 * A util for typesafety that determines if an object
 *  that can be ComponentProperties or ComponentPropertyDefinitions is the latter
 * @param object the object in question, ComponentProperties or ComponentPropertyDefinitions
 * @returns whether or not the object is ComponentProperties or ComponentPropertyDefinitions
 */
function isComponentPropertyDefinitionsObject(
  object: ComponentProperties | ComponentPropertyDefinitions
): object is ComponentPropertyDefinitions {
  return (
    object[Object.keys(object)[0]] &&
    "defaultValue" in object[Object.keys(object)[0]]
  );
}

/**
 * Finding the right component property value object from the current node.
 * @param node the node in question, ignored if not component-like.
 * @returns ComponentProperties or ComponentPropertyDefinitions
 */
function componentPropObjectFromNode(
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

/**
 * Uppercase the first character in a string
 * @param name the string to capitalize
 * @returns capitalized string
 */
function capitalize(name: string) {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * Lowercase the first character in a string
 * @param name the string to downcase
 * @returns downcased string
 */
function downcase(name: string) {
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/**
 * Ensure a string does not start with a number
 * @param name the string to guard that can start with a number
 * @returns string that starts with a letter
 */
function numericGuard(name = "") {
  if (name.charAt(0).match(/\d/)) {
    name = `N${name}`;
  }
  return name;
}

/**
 * Transform a string into a proper capitalized string that cannot start with a number
 * @param name the string to capitalize
 * @returns capitalized name
 */
function capitalizedNameFromName(name = "") {
  name = numericGuard(name);
  return name
    .split(/[^a-zA-Z\d]+/g)
    .map(capitalize)
    .join("");
}

/**
 * A clean property name from a potentially gross string
 * @param name the name to sanitize
 * @returns a sanitized string
 */
function sanitizePropertyName(name: string) {
  name = name.replace(/#[^#]+$/g, "");
  return downcase(capitalizedNameFromName(name).replace(/^\d+/g, ""));
}

/**
 * Get the appropriate topmost component node for a given node
 * @param node node to find the right component node for
 * @returns a component or component set node if it exists, otherwise null
 */
function getComponentNodeFromNode(
  node: BaseNode
): ComponentNode | ComponentSetNode | null {
  const { type, parent } = node;
  const parentType = parent ? parent.type : "";
  const isVariant = parentType === "COMPONENT_SET";
  if (type === "COMPONENT_SET" || (type === "COMPONENT" && !isVariant)) {
    return node;
  } else if (
    node.type === "COMPONENT" &&
    node.parent &&
    node.parent.type === "COMPONENT_SET"
  ) {
    return node.parent;
  } else if (type === "INSTANCE") {
    const { mainComponent } = node;
    return mainComponent
      ? mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET"
        ? mainComponent.parent
        : mainComponent
      : null;
  }
  return null;
}

/**
 * Turn any string into a safe, hyphenated lowercase string
 * @param string the string to transform
 * @returns the safe string
 */
function safeString(string = "") {
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
