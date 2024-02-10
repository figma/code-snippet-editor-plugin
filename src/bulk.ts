import {
  getCodegenResultsFromPluginData,
  setCodegenResultsInPluginData,
} from "./pluginData";

/**
 * Bulk operations when run in design mode.
 * https://github.com/figma/code-snippet-editor-plugin?#bulk-operations
 */
export const bulk = {
  performImport,
  performExport,
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
    if (codegenResults && codegenResults.length) {
      data[component.key] = codegenResults;
    }
  });
  const message: EventToBulk = {
    type: "BULK_EXPORT",
    code: JSON.stringify(data, null, 2),
  };
  figma.ui.postMessage(message);
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
