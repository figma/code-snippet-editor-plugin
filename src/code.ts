import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "./config";
import { hydrateSnippets } from "./hydrateSnippets";
import { paramsFromNode } from "./params";

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
      const { detailsMode, defaultSnippet } =
        figma.codegen.preferences.customSettings;
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
          language: "JSON",
        });
        snippets.push({
          title: "Node Params (Raw)",
          code: JSON.stringify(paramsMap.raw, null, 2),
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
  paramsMap: CodeSnippetParamsMap
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

function getComponentsInFileByKey() {
  const components =
    figma.currentPage.parent?.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    }) || [];
  const data: { [k: string]: ComponentNode | ComponentSetNode } = {};
  components.forEach((component) => (data[component.key] = component));
  return data;
}
