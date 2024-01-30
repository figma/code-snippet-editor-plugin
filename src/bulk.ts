import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "./config";
import { paramsFromNode } from "./params";

export function bulkImport(eventData: string) {
  const componentsByKey = getComponentsInFileByKey();
  const data = JSON.parse(eventData);
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

export function bulkExport() {
  const jsonString = getExportJSON();
  figma.ui.postMessage({
    type: "EXPORT",
    code: jsonString,
  });
}

export function bulkGetComponentData() {
  const jsonString = getComponentDataJSON();
  figma.ui.postMessage({
    type: "COMPONENT_DATA",
    code: jsonString,
  });
}

export async function bulkGetNodeData() {
  const jsonString = await getNodeDataJSON();
  figma.ui.postMessage({
    type: "NODE_DATA",
    code: jsonString,
  });
}

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

function keyFromNode(node: SceneNode) {
  return `${node.name} ${node.type} ${node.id}`;
}

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

function getComponentsInFileByKey() {
  const components = findComponentNodesInFile();
  const data: { [k: string]: ComponentNode | ComponentSetNode } = {};
  components.forEach((component) => (data[component.key] = component));
  return data;
}

function getComponentDataJSON() {
  const components = findComponentNodesInFile();
  const componentData: {
    [k: string]: { name: string; description: string; lineage: string };
  } = {};
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

function getExportJSON() {
  const data: { [k: string]: CodegenResult[] } = {};
  const components = findComponentNodesInFile();
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
