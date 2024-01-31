import { bulk } from "./bulk";
import { getPluginData, setPluginData } from "./pluginData";
import { paramsFromNode } from "./params";
import { nodeSnippetTemplateDataArrayFromNode } from "./snippets";

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
      setPluginData(figma.currentPage.selection[0], event.data);
    } else {
      console.log("UNKNOWN EVENT", event);
    }
  });

  figma.on("selectionchange", () => handleCurrentSelection);

  figma.codegen.on("generate", async () => {
    try {
      const { detailsMode, defaultSnippet } =
        figma.codegen.preferences.customSettings;
      const isDetailsMode = detailsMode === "on";
      const hasDefaultMessage = defaultSnippet === "message";
      const currentNode = handleCurrentSelection();

      const paramsMap = await paramsFromNode(currentNode);
      const nodeSnippetTemplateDataArray =
        await nodeSnippetTemplateDataArrayFromNode(currentNode, paramsMap);

      const snippets = codegenResultsFromNodeSnippetTemplateDataArray(
        nodeSnippetTemplateDataArray,
        isDetailsMode
      );

      if (isDetailsMode) {
        snippets.push({
          title: "Node Params",
          code: JSON.stringify(paramsMap.params, null, 2),
          language: "JSON",
        });
        snippets.push({
          title: "Node Params (Raw)",
          code: JSON.stringify(paramsMap.paramsRaw, null, 2),
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
      bulk.performGetComponentData();
    } else if (event.type === "NODE_DATA") {
      await bulk.performGetNodeData();
    } else if (event.type === "EXPORT") {
      bulk.performExport();
    } else if (event.type === "IMPORT") {
      bulk.performImport(event.data);
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

function codegenResultsFromNodeSnippetTemplateDataArray(
  nodeSnippetTemplateDataArray: NodeSnippetTemplateData[],
  isDetailsMode: boolean
) {
  const codegenResult: CodegenResult[] = [];
  nodeSnippetTemplateDataArray.forEach((nodeSnippetTemplateData) => {
    const { codegenResultArray, codegenResultRawTemplatesArray } =
      nodeSnippetTemplateData;
    if (isDetailsMode) {
      /**
       * If details mode, interleave raw template between rendered snippets
       */
      codegenResultArray.forEach((result, i) => {
        codegenResult.push(codegenResultRawTemplatesArray[i]);
        codegenResult.push(result);
      });
    } else {
      codegenResult.push(...codegenResultArray);
    }
  });
  return codegenResult;
}

function handleCurrentSelection() {
  const node = figma.currentPage.selection[0];
  try {
    const nodePluginData = node ? getPluginData(node) : null;
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
