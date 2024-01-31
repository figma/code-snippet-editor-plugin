import { getPluginData, setPluginData } from "./pluginData";
import { paramsFromNode } from "./params";

export const bulk = {
  performImport,
  performExport,
  performGetComponentData,
  performGetNodeData,
};

/**
 * Import code snippet templates into components in bulk via JSON.
 * @param eventData stringified CodegenResultTemplatesByComponentKey
 * @returns void
 */
function performImport(eventData: string) {
  const componentsByKey = getComponentsInFileByKey();
  const data: CodegenResultTemplatesByComponentKey = JSON.parse(eventData);
  let componentCount = 0;
  for (let componentKey in data) {
    const dataToSave = JSON.stringify(data[componentKey]);
    const component = componentsByKey[componentKey];
    if (component) {
      componentCount++;
      setPluginData(component, dataToSave);
    }
  }
  const s = componentCount === 1 ? "" : "s";
  figma.notify(`Updated ${componentCount} Component${s}`);
}

/**
 * Export code snippet templates, posting stringified CodegenResultTemplatesByComponentKey to UI
 * @returns void
 */
function performExport() {
  const jsonString = getExportJSON();
  figma.ui.postMessage({
    type: "EXPORT",
    code: jsonString,
  });
}

/**
 * Export component data, posting stringified ComponentDataByComponentKey to UI
 * @returns void
 */
function performGetComponentData() {
  const jsonString = getComponentDataJSON();
  figma.ui.postMessage({
    type: "COMPONENT_DATA",
    code: jsonString,
  });
}

/**
 * Get node params for all nodes in a selection and posting data to UI
 * @returns Promise<void>
 */
async function performGetNodeData() {
  const jsonString = await getNodeDataJSON();
  figma.ui.postMessage({
    type: "NODE_DATA",
    code: jsonString,
  });
}

/**
 * Get node params for all nodes in a selection
 * @returns Promise<string> where string is stringified CodeSnippetParamsMap
 */
async function getNodeDataJSON() {
  const nodes = figma.currentPage.selection;
  const data: { [k: string]: CodeSnippetParamsMap } = {};
  await Promise.all(
    nodes.map(async (node) => {
      data[keyFromNode(node)] = await paramsFromNode(node);
      return;
    })
  );
  return JSON.stringify(data, null, 2);
}

/**
 * Generate a key descriptive and unique to the node for indexing node data
 * @param node node to generate a key from
 * @returns a unique key for indexing the node data
 */
function keyFromNode(node: SceneNode) {
  return `${node.name} ${node.type} ${node.id}`;
}

/**
 * Find all component and component set nodes in a file
 * @returns array of all components and component sets in a file.
 */
function findComponentNodesInFile() {
  if (figma.currentPage.parent) {
    return (
      figma.currentPage.parent.findAllWithCriteria({
        types: ["COMPONENT", "COMPONENT_SET"],
      }) || []
    );
  }
  return [];
}

/**
 * Find all components and component sets in a file and return object of them by key.
 * @returns ComponentsByComponentKey
 */
function getComponentsInFileByKey() {
  const components = findComponentNodesInFile();
  const data: ComponentsByComponentKey = {};
  components.forEach((component) => (data[component.key] = component));
  return data;
}

/**
 * Get all component data in a file as a JSON string
 * @returns stringified ComponentDataByComponentKey
 */
function getComponentDataJSON() {
  const components = findComponentNodesInFile();
  const componentData: ComponentDataByComponentKey = {};
  const data = components.reduce((into, component) => {
    if (component.parent && component.parent.type !== "COMPONENT_SET") {
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

/**
 * Get all component templates in the current file and return data as stringified JSON
 * @returns stringified CodegenResultTemplatesByComponentKey
 */
function getExportJSON() {
  const data: CodegenResultTemplatesByComponentKey = {};
  const components = findComponentNodesInFile();
  components.forEach((component) => {
    const pluginData = getPluginData(component);
    if (pluginData) {
      data[component.key] = JSON.parse(pluginData) as CodegenResult[];
    }
  });
  return JSON.stringify(data, null, 2);
}
