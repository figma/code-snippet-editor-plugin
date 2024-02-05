import {
  getCodegenResultsFromPluginData,
  setCodegenResultsInPluginData,
} from "./pluginData";
import { paramsFromNode } from "./params";

/**
 * Bulk operations when run in design mode.
 * https://github.com/figma/code-snippet-editor-plugin?#bulk-operations
 */
export const bulk = {
  performImport,
  performExport,
  performGetComponentData,
  performGetNodeData,
};

/**
 * Import code snippet templates into components in bulk via JSON.
 * https://github.com/figma/code-snippet-editor-plugin#importexport
 * @param data CodegenResultTemplatesByComponentKey
 * @returns void
 */
function performImport(data: CodegenResultTemplatesByComponentKey) {
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

/**
 * Export code snippet templates, posting stringified CodegenResultTemplatesByComponentKey to UI
 * https://github.com/figma/code-snippet-editor-plugin#importexport
 * @returns void
 */
function performExport() {
  const data: CodegenResultTemplatesByComponentKey = {};
  const components = findComponentNodesInFile();
  components.forEach((component) => {
    const codegenResults = getCodegenResultsFromPluginData(component);
    if (codegenResults) {
      data[component.key] = codegenResults;
    }
  });
  const message: EventToBulk = {
    type: "EXPORT",
    code: JSON.stringify(data, null, 2),
  };
  figma.ui.postMessage(message);
}

/**
 * Export component data, posting stringified ComponentDataByComponentKey to UI
 * https://github.com/figma/code-snippet-editor-plugin#component-data
 * @returns void
 */
function performGetComponentData() {
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
  const message: EventToBulk = {
    type: "COMPONENT_DATA",
    code: JSON.stringify(data, null, 2),
  };
  figma.ui.postMessage(message);
}

/**
 * Get node params for all nodes in a selection and posting data to UI
 * https://github.com/figma/code-snippet-editor-plugin#node-params
 * @returns Promise<void>
 */
async function performGetNodeData() {
  const nodes = figma.currentPage.selection;
  const data: { [k: string]: CodeSnippetParamsMap } = {};
  await Promise.all(
    nodes.map(async (node) => {
      data[keyFromNode(node)] = await paramsFromNode(node);
      return;
    })
  );
  const message: EventToBulk = {
    type: "NODE_DATA",
    code: JSON.stringify(data, null, 2),
  };
  figma.ui.postMessage(message);
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
